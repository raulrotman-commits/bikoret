"""
מיפוי כל ליקוי במאגר למספר התקנה, לפי השוואת נוסח הדרישה (description) לנוסח המשולב של התקנות.

קלט:  data/src/inspectorc-catalog.json + קובצי הנוסח המשולב (ויקיטקסט) ב-data/src
פלט:  data/regmap.json  — לכל פריט: מפתח התקנות, מספר תקנה, ציונים, סטטוס, ומסקנת אימות
      data/regmap-review.csv — פריטים שדורשים בדיקה אנושית

הרצה:  python3 -I scripts/map_regulations.py data/src data
"""
import csv
import json
import re
import sys
from pathlib import Path

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])

FILES = {
    "construction": "ויקיטקסט_תקנות_הבטיחות_בעבודה_עבודות_בניה_נוסח_משולב.txt",
    "height": "ויקיטקסט_תקנות_הבטיחות_בעבודה_עבודה_בגובה_נוסח_משולב.txt",
    "electricity": "ויקיטקסט_תקנות_חשמל_נוסח_משולב.txt",
    "towerCranes": "ויקיטקסט_תקנות_עגורני_צריח_נוסח_משולב.txt",
    "craneOperators": "ויקיטקסט_תקנות_עגורנאים_ומפעילי_מכונות_הרמה_נוסח_משולב.txt",
    "ppe": "ויקיטקסט_תקנות_ציוד_מגן_אישי_נוסח_משולב.txt",
    "training": "ויקיטקסט_תקנות_מסירת_מידע_והדרכת_עובדים_נוסח_משולב.txt",
    "safetyOfficers": "ויקיטקסט_תקנות_ממונים_על_הבטיחות_נוסח_משולב.txt",
    "safetyPlan": "ויקיטקסט_תקנות_ארגון_הפיקוח_תכנית_לניהול_הבטיחות_2013.txt",
}

REG_RE = re.compile(r"^(\d{1,3}[א-ת]{0,2})\.$")
MARK_RE = re.compile(r"^\(([א-ת]{1,2}\d?|\d{1,2}[א-ת]?)\)$")
SCHED_RE = re.compile(r"^תוספת (ראשונה|שנייה|שניה|שלישית|רביעית|חמישית|שישית|שביעית)")
HEB_ORD = {c: i + 1 for i, c in enumerate("אבגדהוזחטי")}
HEB_ORD.update({"יא": 11, "יב": 12, "יג": 13, "יד": 14, "טו": 15, "טז": 16, "יז": 17, "יח": 18, "יט": 19, "כ": 20,
                "כא": 21, "כב": 22, "כג": 23, "כד": 24, "כה": 25})


def marker_info(m: str):
    """(type, ordinal) — type 'h' לאות עברית, 'd' לספרה. סימון כמו 1א מקבל את הבסיס."""
    if m[0].isdigit():
        base = re.match(r"\d+", m).group(0)
        return "d", int(base), m != base
    base = re.match(r"[א-ת]+", m).group(0)
    if base in HEB_ORD:
        return "h", HEB_ORD[base], m != base
    return "h", HEB_ORD.get(base[0], 1), True


class Node:
    __slots__ = ("key", "label", "mtype", "ord", "parent", "children", "lines", "heading", "repealed", "reg")

    def __init__(self, key, label, mtype, ordv, parent, reg):
        self.key = key          # מפתח מלא, למשל 9(א)(1)
        self.label = label      # הסימון בלבד, למשל (1)
        self.mtype = mtype
        self.ord = ordv
        self.parent = parent
        self.children = []
        self.lines = []         # [(text, kind)] kind: old | new | repealed | plain
        self.heading = ""
        self.repealed = False
        self.reg = reg


def line_kind(t: str):
    if t.startswith("(החל מיום"):
        return "new"
    if t.startswith("(תבוטל") or t.startswith("(תימחק"):
        return "repealed"
    return "plain"


def parse(regkey: str, path: Path):
    lines = [l.strip() for l in path.read_text(encoding="utf-8").splitlines()]
    nodes = []
    # דילוג על תוכן העניינים: מתחילים בשורת "1." הראשונה
    start = next(i for i, l in enumerate(lines) if REG_RE.match(l))
    top = None
    stack = []
    expect_heading = False
    for l in lines[start:]:
        if not l:
            continue
        m = REG_RE.match(l)
        if m:
            top = Node(m.group(1), m.group(1), "r", 0, None, regkey)
            nodes.append(top)
            stack = [top]
            expect_heading = True
            continue
        s = SCHED_RE.match(l)
        if s:
            top = Node(f"התוספת ה{s.group(1)}", l, "s", 0, None, regkey)
            nodes.append(top)
            stack = [top]
            expect_heading = False
            continue
        if top is None:
            continue
        if l.startswith("פרק ") or l.startswith("סימן "):
            continue
        mk = MARK_RE.match(l)
        if mk:
            mtype, ordv, inserted = marker_info(mk.group(1))
            # מיקום בעץ: אח של צומת מאותו סוג עם מספר סידורי קודם, אחרת ילד של הצומת העליון
            parent = None
            for depth in range(len(stack) - 1, 0, -1):
                n = stack[depth]
                if n.mtype == mtype and (n.ord == ordv - 1 or (inserted and n.ord == ordv) or n.ord == ordv):
                    parent = n.parent
                    stack = stack[:depth]
                    break
            if parent is None:
                parent = stack[-1]
            node = Node(parent.key + f"({mk.group(1)})", f"({mk.group(1)})", mtype, ordv, parent, regkey)
            parent.children.append(node)
            nodes.append(node)
            stack.append(node)
            expect_heading = False
            continue
        cur = stack[-1]
        if expect_heading and cur.mtype == "r":
            cur.heading = re.sub(r"\[.*?\]", "", l).strip()
            expect_heading = False
            continue
        kind = line_kind(l)
        if kind == "repealed" and not cur.lines and not cur.children:
            cur.repealed = True
        cur.lines.append((l, kind))
    return nodes


# ---------- נרמול טקסט ----------
NIQQUD = re.compile(r"[֑-ׇ]")
FINALS = str.maketrans({"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"})
STOP = set("של את על אל עם או אם כי לא כל זה זו אלה הוא היא הם הן גם רק אשר כאמור לפי בין יהיה יהיו תהיה ידי".split())


def clean(t: str) -> str:
    t = re.sub(r"\((החל מיום|תבוטל ביום|תימחק ביום)[^)]*\):?", " ", t)
    t = re.sub(r"\[.*?\]", " ", t)
    t = re.sub(r"\(\s*[\u05D0-\u05EA0-9]{1,3}\s*\)", " ", t)  # סימוני פסקאות כמו (1) או (א)
    t = NIQQUD.sub("", t)
    t = t.replace("״", '"').replace("׳", "'").replace("־", " ").replace("–", " ").replace("—", " ")
    t = re.sub(r"[^א-ת0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def skel(w: str) -> str:
    """שלד מילה: בלי ו/י פנימיות ובלי אותיות סופיות — מנטרל הבדלי כתיב מלא/חסר"""
    w = w.translate(FINALS)
    if len(w) <= 2:
        return w
    return w[0] + re.sub("[וי]", "", w[1:])


def words(t: str):
    return [skel(w) for w in clean(t).split()]


def bigrams(ws):
    return {(ws[i], ws[i + 1]) for i in range(len(ws) - 1)}


PREFIXES = ("וה", "שה", "בה", "לה", "מה", "כש", "ו", "ה", "ב", "ל", "מ", "ש", "כ")


def stem(w: str) -> str:
    for p in PREFIXES:
        if w.startswith(p) and len(w) - len(p) >= 3:
            return w[len(p):]
    return w


SUFFIXES = ("ות", "ים", "ת", "ה", "מ", "נ", "ו", "י")


def core(w: str) -> str:
    """צורת בסיס גסה: שלד, בלי תחיליות ובלי סיומות נפוצות (לצורך השוואת ניסוח, לא לבלשנות)"""
    w = skel(w)
    for p in PREFIXES:
        if w.startswith(p) and len(w) - len(p) >= 3:
            w = w[len(p):]
            break
    changed = True
    while changed and len(w) > 3:
        changed = False
        for suf in SUFFIXES:
            if w.endswith(suf) and len(w) - len(suf) >= 3:
                w = w[: -len(suf)]
                changed = True
                break
    return w


def core_set(t: str):
    return {core(raw) for raw in clean(t).split() if len(raw) > 2 and raw not in STOP}


def content_set(t: str):
    out = set()
    for raw in clean(t).split():
        if len(raw) <= 2 or raw in STOP:
            continue
        out.add(stem(skel(raw)))
    return out


# ---------- בניית אינדקס ----------
all_nodes = []
for key, fn in FILES.items():
    p = SRC / fn
    if p.exists():
        all_nodes.extend(parse(key, p))


def own_text(n):
    return " ".join(t for t, _ in n.lines)


def anc_chain(n):
    out = []
    while n is not None:
        out.append(n)
        n = n.parent
    return out[::-1]


def subtree(n):
    out = [n]
    for c in n.children:
        out.extend(subtree(c))
    return out


def is_repealed(n):
    return any(a.repealed for a in anc_chain(n))


index = []
for n in all_nodes:
    chain = anc_chain(n)
    ctx = " ".join(own_text(a) for a in chain[:-1])
    tree = " ".join(own_text(x) for x in subtree(n))
    full = (ctx + " " + tree).strip()
    ws = words(full)
    if len(ws) < 3:
        continue
    kinds = [k for x in subtree(n) for _, k in x.lines]
    index.append({
        "node": n,
        "bg": bigrams(ws),
        "own_bg": bigrams(words(own_text(n))),
        "sub_bg": bigrams(words(tree)),
        "content": content_set(full + " " + " ".join(a.heading for a in chain)),
        "has_new": "new" in kinds,
        "repealed": is_repealed(n),
    })

GENERIC_WORDS = "לא אין נמצא נמצאה בוצע בוצעה ביצע הותקן הותקנו מבצע עובד עובדים באתר אתר בניה בנייה העבודה עבודה במקום מקום כנדרש נדרש".split()
GENERIC_TITLE = {stem(skel(w)) for w in "לא אין נמצא נמצאה בוצע בוצעה ביצע הותקן הותקנו מבצע מבצע עובד עובדים באתר אתר בניה בנייה העבודה עבודה במקום מקום כנדרש נדרש".split()}


def match(desc: str, title: str):
    D = bigrams(words(desc))
    if not D:
        return None
    best = None
    scored = []
    for e in index:
        inter = len(D & e["bg"])
        if not inter:
            continue
        if e["node"].parent is not None and not (D & e["sub_bg"]):
            continue
        R = inter / len(D)
        P = inter / len(e["bg"])
        b2 = 4.0
        F = (1 + b2) * P * R / (b2 * P + R)
        scored.append((F, R, P, e))
    if not scored:
        return None
    scored.sort(key=lambda x: (-x[0], len(x[3]["node"].key)))
    F, R, P, e = scored[0]
    second = scored[1][0] if len(scored) > 1 else 0.0
    node = e["node"]

    # עידון לפי נוסח הליקוי: אם הכותרת מצביעה על פסקה מסוימת בתוך הצומת
    T = content_set(title) - GENERIC_TITLE
    refined = node
    if node.children and T:
        parent_words = content_set(own_text(node))
        cands = []
        for c in subtree(node)[1:]:
            cw = content_set(own_text(c)) - parent_words
            ov = len(T & cw)
            cands.append((ov, -len(c.key), c))
        cands.sort(key=lambda x: (-x[0], -x[1]))
        if cands and cands[0][0] >= 2 and (len(cands) == 1 or cands[0][0] > cands[1][0]):
            refined = cands[0][2]

    # עקביות הכותרת מול נוסח התקנה שנמצאה (כל התקנה, כולל הכותרת שלה)
    top_node = anc_chain(node)[0]
    reg_text = " ".join(own_text(x) for x in subtree(top_node)) + " " + top_node.heading
    TC = {core(w) for w in clean(title).split() if len(w) > 2 and w not in STOP} - {core(g) for g in GENERIC_WORDS}
    target = core_set(reg_text)
    title_cons = (len(TC & target) / len(TC)) if TC else 0.0

    # ניסוח שעודכן: התקנה תוקנה ב-16.10.2026 והדרישה במאגר תואמת בעיקר את הנוסח הקודם
    new_bg = set()
    for x in subtree(node):
        for t, k in x.lines:
            if k == "new":
                new_bg |= bigrams(words(t))
    outdated = bool(new_bg) and (len(D & new_bg) < 0.3 * max(1, len(D & e["bg"])))
    return {
        "reg": node.reg,
        "regNo": refined.key,
        "matchedNo": node.key,
        "F": round(F, 3),
        "R": round(R, 3),
        "P": round(P, 3),
        "margin": round(F - second, 3),
        "titleCons": round(title_cons, 3),
        "repealed": e["repealed"],
        "amended": e["has_new"],
        "outdated": outdated,
        "heading": anc_chain(node)[0].heading,
    }


catalog = json.loads((SRC / "inspectorc-catalog.json").read_text(encoding="utf-8"))
results = {}
review = []
for it in catalog:
    r = match(it.get("description") or "", it.get("title") or "")
    if r is None:
        r = {"reg": None, "regNo": None, "F": 0, "R": 0, "P": 0, "margin": 0, "titleCons": 0,
             "repealed": False, "amended": False, "heading": ""}
    strong = r["R"] >= 0.8 and r["F"] >= 0.45
    verified = bool(strong and r["titleCons"] >= 0.4 and not r["repealed"])
    status = "repealed" if r["repealed"] else ("amended" if r["amended"] else "current")
    if r["reg"] is None:
        reason = "לא נמצא נוסח תואם"
    elif r["repealed"]:
        reason = "התקנה שנמצאה בוטלה ב-16.10.2026"
    elif not strong:
        reason = "התאמה חלשה בין נוסח הדרישה לתקנות"
    elif r["titleCons"] < 0.4:
        reason = "נוסח הליקוי אינו תואם את התקנה שנמצאה לפי הדרישה"
    else:
        reason = ""
    if verified and r.get("outdated"):
        status = "outdated"
    r.update({"verified": verified, "status": status, "reason": reason})
    results[it["id"]] = r
    if not verified or r.get("outdated"):
        if verified:
            reason = "התקנה תוקנה ב-16.10.2026; נוסח הדרישה במאגר לפי הנוסח הקודם"
        review.append([it["id"], it.get("clauseNo") or "", it["category"], it["title"], r["reg"] or "", r["regNo"] or "",
                       r["R"], r["F"], r["titleCons"], reason, (it.get("description") or "")[:160]])

(OUT / "regmap.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
with open(OUT / "regmap-review.csv", "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["id", "קוד", "תחום", "ליקוי", "תקנות", "מספר", "R", "F", "התאמת כותרת", "סיבה", "דרישה"])
    w.writerows(review)

ver = sum(1 for r in results.values() if r["verified"])
print(f"nodes indexed: {len(index)}; items: {len(catalog)}; verified: {ver}; review: {len(review)}")
from collections import Counter
print(Counter(r["reason"] for r in results.values()))
print(Counter(r["reg"] for r in results.values()))
