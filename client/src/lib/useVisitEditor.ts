import { useCallback, useEffect, useRef, useState } from "react";
import { vanilla } from "./trpc";
import {
  isDirty,
  loadLocal,
  onSync,
  putPhoto,
  saveLocal,
  syncVisit,
  type LocalFinding,
  type LocalVisit,
  type SyncState,
} from "./visitStore";
import { compressImage } from "./photos";
import { uuid } from "./format";

type Status = "loading" | "ready" | "missing";

/** עורך ביקור: קורא מהמכשיר, מעדכן מהשרת כשאין שינויים מקומיים, ושומר כל שינוי מיד */
export function useVisitEditor(id: string) {
  const [lv, setLv] = useState<LocalVisit | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [sync, setSync] = useState<SyncState>("saved");
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<LocalVisit | null>(null);

  useEffect(() => onSync((vid, s) => vid === id && setSync(s)), [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = await loadLocal(id);
      if (!alive) return;
      if (local) {
        latest.current = local;
        setLv(local);
        setStatus("ready");
        setSync(isDirty(local) ? (navigator.onLine ? "pending" : "offline") : local.visit.status === "final" ? "locked" : "saved");
      }
      if (!navigator.onLine) {
        if (!local) setStatus("missing");
        return;
      }
      try {
        const server = await vanilla.visits.get.query({ id });
        if (!alive) return;
        const fresh = (await loadLocal(id)) ?? local;
        if (!fresh || !isDirty(fresh)) {
          const v: LocalVisit = {
            visit: {
              id: server.visit.id,
              siteId: server.visit.siteId,
              visitDate: server.visit.visitDate,
              authorName: server.visit.authorName,
              authorRole: server.visit.authorRole,
              authorLicense: server.visit.authorLicense,
              contractorRepName: server.visit.contractorRepName,
              contractorRepRole: server.visit.contractorRepRole,
              recipients: server.visit.recipients,
              generalNotes: server.visit.generalNotes ?? "",
              previousVisitId: server.visit.previousVisitId,
              status: server.visit.status,
            },
            findings: server.findings.map((f) => ({
              id: f.id,
              catalogId: f.catalogId,
              customTitle: f.customTitle,
              customReg: f.customReg,
              customRegNo: f.customRegNo,
              location: f.location,
              note: f.note ?? "",
              likelihood: f.likelihood,
              severity: f.severity,
              workStopped: f.workStopped,
              stopReason: f.stopReason ?? null,
              regulatorNotifiedAt: f.regulatorNotifiedAt ?? null,
              deadlineDays: f.deadlineDays,
              carriedFromId: f.carriedFromId,
              followStatus: f.followStatus,
              sortOrder: f.sortOrder,
              photoIds: f.photoIds,
            })),
            rev: fresh?.rev ?? 1,
            syncedRev: fresh?.rev ?? 1,
            savedAt: server.visit.updatedAt,
            siteSnap: fresh?.siteSnap,
          };
          await saveLocal(v);
          if (!alive) return;
          latest.current = v;
          setLv(v);
          setSync(v.visit.status === "final" ? "locked" : "saved");
        } else {
          void syncVisit(id);
        }
        setStatus("ready");
      } catch (e) {
        const code = (e as { data?: { code?: string } })?.data?.code;
        if (!local) setStatus(code === "NOT_FOUND" ? "missing" : "missing");
        else if (isDirty(local)) void syncVisit(id);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const scheduleSync = useCallback(() => {
    window.clearTimeout(timer.current);
    setSync(navigator.onLine ? "pending" : "offline");
    timer.current = window.setTimeout(() => void syncVisit(id), 1200);
  }, [id]);

  /** שינוי במצב הביקור — נשמר במכשיר מיד ומסונכרן ברקע */
  const update = useCallback(
    (fn: (draft: LocalVisit) => LocalVisit) => {
      const cur = latest.current;
      if (!cur || cur.visit.status === "final") return;
      const next = fn(structuredClone(cur));
      next.rev = cur.rev + 1;
      latest.current = next;
      setLv(next);
      void saveLocal(next);
      scheduleSync();
    },
    [scheduleSync],
  );

  const setSiteSnap = useCallback((snap: LocalVisit["siteSnap"]) => {
    const cur = latest.current;
    if (!cur || JSON.stringify(cur.siteSnap) === JSON.stringify(snap)) return;
    const next = { ...cur, siteSnap: snap };
    latest.current = next;
    setLv(next);
    void saveLocal(next);
  }, []);

  const updateFinding = useCallback(
    (fid: string, patch: Partial<LocalFinding>) =>
      update((d) => ({ ...d, findings: d.findings.map((f) => (f.id === fid ? { ...f, ...patch } : f)) })),
    [update],
  );

  const addFinding = useCallback(
    (f: Partial<LocalFinding>) => {
      const id2 = uuid();
      update((d) => ({
        ...d,
        findings: [
          ...d.findings,
          {
            id: id2,
            catalogId: null,
            customTitle: null,
            customReg: null,
            customRegNo: null,
            location: "",
            note: "",
            likelihood: null,
            severity: null,
            workStopped: false,
            stopReason: null,
            regulatorNotifiedAt: null,
            deadlineDays: null,
            carriedFromId: null,
            followStatus: null,
            sortOrder: d.findings.length,
            photoIds: [],
            ...f,
          },
        ],
      }));
      return id2;
    },
    [update],
  );

  const removeFinding = useCallback((fid: string) => update((d) => ({ ...d, findings: d.findings.filter((f) => f.id !== fid) })), [update]);

  const addPhoto = useCallback(
    async (fid: string, file: File) => {
      const blob = await compressImage(file);
      const pid = uuid();
      await putPhoto({ id: pid, visitId: id, findingId: fid, blob, uploaded: false, createdAt: Date.now() });
      update((d) => ({ ...d, findings: d.findings.map((f) => (f.id === fid ? { ...f, photoIds: [...f.photoIds, pid] } : f)) }));
    },
    [id, update],
  );

  const removePhoto = useCallback(
    (fid: string, pid: string) =>
      update((d) => ({ ...d, findings: d.findings.map((f) => (f.id === fid ? { ...f, photoIds: f.photoIds.filter((x) => x !== pid) } : f)) })),
    [update],
  );

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    return syncVisit(id);
  }, [id]);

  const markFinal = useCallback(async () => {
    const cur = latest.current;
    if (!cur) return;
    const next = { ...cur, visit: { ...cur.visit, status: "final" as const } };
    latest.current = next;
    setLv(next);
    await saveLocal(next);
    setSync("locked");
  }, []);

  const markDraft = useCallback(async () => {
    const cur = latest.current;
    if (!cur) return;
    const next = { ...cur, visit: { ...cur.visit, status: "draft" as const } };
    latest.current = next;
    setLv(next);
    await saveLocal(next);
    setSync("saved");
  }, []);

  return { lv, status, sync, update, updateFinding, addFinding, removeFinding, addPhoto, removePhoto, flush, markFinal, markDraft, setSiteSnap };
}
