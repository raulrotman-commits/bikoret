"""
בניית מאגר הליקויים של האפליקציה מתוך המאגר של ראול + מיפוי מספרי התקנות.

קלט:  data/src/inspectorc-catalog.json, data/regmap.json
פלט:  shared/catalog.json         — המאגר שהאפליקציה טוענת
      data/catalog-changes.json   — מה תוקן/אוחד/הוסר, לדוח לראול

הרצה:  python3 -I scripts/build_catalog.py data shared
"""
import json
import re
import sys
from collections import OrderedDict, defaultdict
from datetime import datetime, timezone
from pathlib import Path

DATA = Path(sys.argv[1])
OUT = Path(sys.argv[2])

src = json.loads((DATA / "src" / "inspectorc-catalog.json").read_text(encoding="utf-8"))
regmap = json.loads((DATA / "regmap.json").read_text(encoding="utf-8"))

CATEGORY = OrderedDict([
    ("עבודות בניה", ("construction", "עבודות בנייה", "🏗️")),
    ("עבודה בגובה", ("height", "עבודה בגובה", "🪜")),
    ("עגורנים", ("cranes", "עגורנים והרמה", "🏗")),
    ("חשמל", ("electricity", "חשמל", "⚡")),
    ("הדרכות ומסירת מידע", ("training", "הדרכות ומסירת מידע", "📜")),
    ("ציוד מגן", ("ppe", "ציוד מגן אישי", "🦺")),
    ("ממונים", ("officers", "ממונים על הבטיחות", "👮")),
])

# שם התקנות כפי שמופיע במאגר → מפתח (משמש רק כשאין התאמת נוסח חזקה)
LABEL_REG = {
    "תקנות הבטיחות בעבודות בנייה": "construction",
    "עבודה בגובה": "height",
    "תקנות הבטיחות בעבודה בחשמל": "electricity",
    "תקנות עגורני צריח": "towerCranes",
    "תקנות עגורנאים ומפעילי מכונות הרמה": "craneOperators",
    "תקנות ציוד מגן אישי": "ppe",
    "מסירת מידע והדרכה": "training",
    "תקנות הממונים על הבטיחות": "safetyOfficers",
}

# תיקוני כתיב/ניסוח שנמצאו במאגר. (מחרוזת, תחליף)
FIXES = [
    ("מהל עבודה", "מנהל עבודה"),
    ("לעבודים", "לעובדים"),
    ("ממונה הטיחות", "ממונה הבטיחות"),
    ("מבצע הבנייה לא הודיעה", "מבצע הבנייה לא הודיע"),
    ("בטיחות,שימוש", "בטיחות, שימוש"),
    ("( מעסיק )שאינו", "(מעסיק) שאינו"),
    ("  ", " "),
    (" ,", ","),
]


def fix_text(t: str, changes: list, item_id: int, field: str) -> str:
    orig = t
    for a, b in FIXES:
        t = t.replace(a, b)
    t = t.strip()
    if t != orig.strip():
        changes.append({"id": item_id, "field": field, "from": orig.strip(), "to": t})
    return t


def unify_bniya(t: str) -> str:
    """'בניה' כמילה בודדת → 'בנייה' (הכתיב בתקנות המעודכנות)"""
    return re.sub(r"(?<![א-ת])(ו?ה?)בניה(?![א-ת])", r"\1בנייה", t)


# ---- תגיות לנושאי מיקוד ----
def tags_for(it, reg, reg_no):
    title = it["title"]
    text = title + " " + (it.get("description") or "") + " " + it["topic"] + " " + it["subtopic"]
    no = reg_no or ""
    tags = set()
    if reg == "construction" and (no.startswith("1א") or it["subtopic"] == "מזמין העבודה" or "מזמין" in title):
        tags.add("client")
    if reg == "construction" and (no.startswith("2ב") or it["subtopic"] == "מנהל אתר" or re.search(r"מנהל (ה)?אתר", title)):
        tags.add("site-manager")
    if reg == "construction" and (no.startswith("2א") or it["subtopic"] == "בקר בטיחות" or "בקר הבטיחות" in title or "בקר בטיחות" in title):
        tags.add("controller")
    if re.search(r"מנהל (ה)?עבודה", title) and reg == "construction":
        tags.add("work-manager")
    if re.search(r"ת(ו)?כני(ו)?ת הנדסי", text):
        tags.add("eng-plans")
    if re.search(r"ת(ו)?כנית (ה)?בטיחות|ארגון בטיחות|לניהול (ה)?בטיחות|מענ(ה|ים) לסיכו", text):
        tags.add("safety-plan")
    if re.search(r"מפקח (ה)?עבודה|טופס מקוון", title) or no.startswith("6א"):
        tags.add("notices")
    if re.search(r"בשפה|שפה (ה)?מובנת|עברית וערבית|בשפות", text):
        tags.add("training-language")
    if reg == "height" and re.search(r"מדריך|אישור (ה)?הדרכה|פנקס הדרכה", title):
        tags.add("height-instructor")
    return sorted(tags)


changes = []
removed = []
items = []
seen = {}
reqs = []
req_index = {}

# פריטים שאינם ליקוי אלא כותרת נושא
NOT_A_DEFECT = {41}

for it in src:
    iid = it["id"]
    if iid in NOT_A_DEFECT:
        removed.append({"id": iid, "title": it["title"], "why": "כותרת נושא ולא ליקוי"})
        continue
    m = regmap.get(str(iid), {})
    strong = (m.get("R", 0) >= 0.8)
    reg = m.get("reg") if strong else LABEL_REG.get(it["regulation"])
    if reg is None:
        reg = m.get("reg") or LABEL_REG.get(it["regulation"])
    reg_no = m.get("regNo") if m.get("verified") else None
    if strong and m.get("reg") and LABEL_REG.get(it["regulation"]) and m["reg"] != LABEL_REG.get(it["regulation"]):
        changes.append({"id": iid, "field": "regulation", "from": it["regulation"], "to": m["reg"],
                        "note": "שם התקנות במאגר לא תאם את נוסח הדרישה"})

    title = fix_text(it["title"], changes, iid, "title")
    req = fix_text(it.get("description") or "", changes, iid, "description")
    topic = unify_bniya(it["topic"]).strip()
    subtopic = unify_bniya(it["subtopic"]).strip()

    cat_key, cat_label, _ = CATEGORY[it["category"]]
    dedupe_key = (cat_key, title, req)
    if dedupe_key in seen:
        removed.append({"id": iid, "title": title, "why": f"כפילות של פריט {seen[dedupe_key]}"})
        continue
    seen[dedupe_key] = iid

    if req not in req_index:
        req_index[req] = len(reqs)
        reqs.append(req)

    items.append({
        "id": iid,
        "code": it.get("clauseNo"),
        "cat": cat_key,
        "topic": topic,
        "sub": subtopic,
        "title": title,
        "rq": req_index[req],
        "reg": reg,
        "no": reg_no,
        "v": bool(m.get("verified")),
        "st": m.get("status", "current"),
        "tags": tags_for({**it, "title": title, "topic": topic, "subtopic": subtopic}, reg, m.get("regNo")),
    })

counts = defaultdict(int)
for x in items:
    counts[x["cat"]] += 1
categories = [{"key": k, "label": lbl, "icon": icon, "count": counts[k]} for _, (k, lbl, icon) in CATEGORY.items()]

tag_counts = defaultdict(int)
for x in items:
    for t in x["tags"]:
        tag_counts[t] += 1

catalog = {
    "version": datetime.now(timezone.utc).strftime("%Y.%m.%d"),
    "builtAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "categories": categories,
    "reqs": reqs,
    "items": items,
}
(OUT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
(DATA / "catalog-changes.json").write_text(json.dumps({"changes": changes, "removed": removed}, ensure_ascii=False, indent=1), encoding="utf-8")

print("items:", len(items), "removed:", len(removed), "text fixes:", sum(1 for c in changes if c["field"] in ("title", "description")),
      "reg relabels:", sum(1 for c in changes if c["field"] == "regulation"))
print("verified numbers:", sum(1 for x in items if x["v"]), "unique requirements:", len(reqs))
print("categories:", {c["key"]: c["count"] for c in categories})
print("tags:", dict(tag_counts))
print("size KB:", round((OUT / "catalog.json").stat().st_size / 1024))
