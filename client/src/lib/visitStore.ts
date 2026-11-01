/**
 * אחסון מקומי־קודם לביקור: כל שינוי נשמר מיד במכשיר (IndexedDB) ומסונכרן לשרת כשיש חיבור.
 * באתר בנייה (מרתף, פיר) אין תמיד קליטה — אסור לאבד ממצא או תמונה.
 */
import { createStore, get, set, del, keys } from "idb-keyval";
import type { FindingInput, VisitInput } from "@shared/visit-types";
import { vanilla } from "./trpc";

const store = createStore("bikoret", "kv");

export type LocalFinding = FindingInput;

export interface LocalVisit {
  visit: VisitInput & { status: "draft" | "final" };
  findings: LocalFinding[];
  /** מונה שינויים מקומיים */
  rev: number;
  /** הגרסה האחרונה שנשמרה בשרת */
  syncedRev: number;
  savedAt?: string;
  /** תמונת מצב של פרטי האתר, לעבודה בלי קליטה */
  siteSnap?: { name: string; unacceptableFrom: number; approvalFrom: number };
}

export interface LocalPhoto {
  id: string;
  visitId: string;
  findingId: string;
  blob: Blob;
  uploaded: boolean;
  createdAt: number;
}

export const isDirty = (v: LocalVisit) => v.rev !== v.syncedRev;

export async function loadLocal(id: string) {
  return (await get(`visit:${id}`, store)) as LocalVisit | undefined;
}

export async function saveLocal(v: LocalVisit) {
  await set(`visit:${v.visit.id}`, v, store);
}

export async function removeLocal(id: string) {
  await del(`visit:${id}`, store);
  for (const k of await keys(store)) {
    if (typeof k === "string" && k.startsWith("photo:")) {
      const p = (await get(k, store)) as LocalPhoto | undefined;
      if (p?.visitId === id) await del(k, store);
    }
  }
}

export async function localVisits(): Promise<LocalVisit[]> {
  const out: LocalVisit[] = [];
  for (const k of await keys(store)) {
    if (typeof k === "string" && k.startsWith("visit:")) {
      const v = (await get(k, store)) as LocalVisit | undefined;
      if (v) out.push(v);
    }
  }
  return out;
}

export async function putPhoto(p: LocalPhoto) {
  await set(`photo:${p.id}`, p, store);
}

export async function getPhoto(id: string) {
  return (await get(`photo:${id}`, store)) as LocalPhoto | undefined;
}

export async function pendingPhotos(visitId?: string): Promise<LocalPhoto[]> {
  const out: LocalPhoto[] = [];
  for (const k of await keys(store)) {
    if (typeof k === "string" && k.startsWith("photo:")) {
      const p = (await get(k, store)) as LocalPhoto | undefined;
      if (p && !p.uploaded && (!visitId || p.visitId === visitId)) out.push(p);
    }
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

export type SyncState = "saved" | "pending" | "offline" | "error" | "locked" | "expired";

const listeners = new Set<(id: string, s: SyncState) => void>();
export function onSync(fn: (id: string, s: SyncState) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const emit = (id: string, s: SyncState) => listeners.forEach((l) => l(id, s));

const chains = new Map<string, Promise<SyncState>>();

/** סנכרון ביקור אחד: קודם נתוני הביקור, אחר כך התמונות שממתינות. רץ בטור לכל ביקור. */
export function syncVisit(id: string): Promise<SyncState> {
  const prev = chains.get(id) ?? Promise.resolve<SyncState>("saved");
  const next = prev.catch(() => "error" as SyncState).then(() => doSync(id));
  chains.set(id, next);
  return next;
}

function isNetworkError(e: unknown) {
  const m = String((e as { message?: string })?.message ?? e);
  return !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network/i.test(m);
}

async function doSync(id: string): Promise<SyncState> {
  const lv = await loadLocal(id);
  if (!lv) return "saved";
  if (!navigator.onLine) {
    emit(id, "offline");
    return "offline";
  }
  if (isDirty(lv) && lv.visit.status === "draft") {
    const rev = lv.rev;
    try {
      const r = await vanilla.visits.save.mutate({ visit: lv.visit, findings: lv.findings });
      const cur = (await loadLocal(id)) ?? lv;
      cur.syncedRev = Math.max(cur.syncedRev, rev);
      cur.savedAt = r.savedAt;
      await saveLocal(cur);
    } catch (e) {
      const code = (e as { data?: { code?: string } })?.data?.code;
      const s: SyncState = isNetworkError(e) ? "offline" : code === "CONFLICT" ? "locked" : code === "FORBIDDEN" ? "expired" : "error";
      emit(id, s);
      return s;
    }
  }
  for (const p of await pendingPhotos(id)) {
    const fd = new FormData();
    fd.append("id", p.id);
    fd.append("findingId", p.findingId);
    fd.append("visitId", p.visitId);
    fd.append("file", p.blob, `${p.id}.jpg`);
    try {
      const res = await fetch("/api/photos", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        emit(id, res.status === 403 ? "expired" : "error");
        return "error";
      }
      p.uploaded = true;
      await putPhoto(p);
    } catch (e) {
      const s: SyncState = isNetworkError(e) ? "offline" : "error";
      emit(id, s);
      return s;
    }
  }
  const after = await loadLocal(id);
  const s: SyncState = after && isDirty(after) ? "pending" : "saved";
  emit(id, s);
  return s;
}

export async function syncAll() {
  for (const v of await localVisits()) {
    const hasPhotos = (await pendingPhotos(v.visit.id)).length > 0;
    if (isDirty(v) || hasPhotos) await syncVisit(v.visit.id);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void syncAll());
  setInterval(() => navigator.onLine && void syncAll(), 45000);
}
