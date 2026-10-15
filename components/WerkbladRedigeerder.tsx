"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Sheet, SheetData } from "@/lib/werkboeke/tipes";
import type { PhotoInfo } from "./FotoVeld";
import { Kriteria, TerugvoerInhoud, type FeedbackView } from "./Terugvoer";
import WerkbladVorm, { type TeacherNotes } from "./WerkbladVorm";

type CheckpointInfo = {
  number: number;
  statement: string;
  status: "OPEN" | "SUBMITTED" | "APPROVED" | "RETURNED";
  canSubmit: boolean;
  reason?: string;
  comment: string | null;
  teacherName: string | null;
  decidedAt: string | null;
};

type Props = {
  sheet: Sheet;
  sheetKey: string;
  initialData: SheetData;
  initialRevision: number;
  initialStatus: "NOT_STARTED" | "IN_PROGRESS" | "NOT_READY" | "READY";
  readyBy: string | null;
  editable: boolean;
  lockReason?: string;
  members: string[];
  photos: PhotoInfo[];
  teacherNotes: TeacherNotes;
  feedback: FeedbackView | null;
  feedbackCount: number;
  checkpoint: CheckpointInfo | null;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict" | "locked";

const ICON_OK = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const ICON_DOTS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="6" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="18" cy="12" r="2" />
  </svg>
);
const ICON_LOCK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function WerkbladRedigeerder(p: Props) {
  const router = useRouter();
  const [data, setData] = useState<SheetData>(p.initialData);
  const [photos, setPhotos] = useState<PhotoInfo[]>(p.photos);
  const [status, setStatus] = useState(p.initialStatus);
  const [save, setSave] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [fb, setFb] = useState<FeedbackView | null>(p.feedback);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  const revision = useRef(p.initialRevision);
  const latest = useRef(data);
  const dirty = useRef(false);
  const inflight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editable = p.editable && save !== "conflict" && save !== "locked";

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    if (!dirty.current) return true;
    dirty.current = false;
    setSave("saving");
    let ok = true;
    const run = (async () => {
      try {
        const res = await fetch(`/api/werkblad/${encodeURIComponent(p.sheetKey)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: latest.current, revision: revision.current })
        });
        const json = await res.json().catch(() => ({}));
        if (res.status === 409) {
          ok = false;
          setSave("conflict");
          return;
        }
        if (res.status === 423) {
          ok = false;
          setSave("locked");
          return;
        }
        if (!res.ok) throw new Error(json.error ?? "Stoor het misluk");
        revision.current = json.revision;
        setStatus(json.status);
        setSavedAt(new Date());
        setSave(dirty.current ? "dirty" : "saved");
      } catch {
        ok = false;
        dirty.current = true;
        setSave("error");
      }
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
    return ok;
  }, [p.sheetKey]);

  const onChange = (next: SheetData) => {
    setData(next);
    latest.current = next;
    dirty.current = true;
    setSave("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  };

  // Herprobeer na ’n netwerkfout.
  useEffect(() => {
    if (save !== "error") return;
    const t = setTimeout(() => void flush(), 5000);
    return () => clearTimeout(t);
  }, [save, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const hide = () => {
      if (dirty.current && document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [flush]);

  async function askFeedback() {
    setAskError(null);
    setAsking(true);
    try {
      const ok = await flush();
      if (!ok) throw new Error("Stoor eers julle werk voordat julle terugvoer vra.");
      const res = await fetch(`/api/werkblad/${encodeURIComponent(p.sheetKey)}/terugvoer`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Terugvoer het misluk.");
      setFb({ ...json.feedback, stale: false });
      setStatus(json.feedback.ready ? "READY" : "NOT_READY");
      setMissing((json.feedback.result.ontbrekend ?? []).map((m: { key: string }) => m.key));
      router.refresh();
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Terugvoer het misluk.");
    } finally {
      setAsking(false);
    }
  }

  async function submit() {
    if (!p.checkpoint) return;
    if (!confirm(`Dien kontrolepunt ${p.checkpoint.number} in? Die werkblaaie word gesluit totdat die onderwyser dit nagegaan het.`)) return;
    setSubmitting(true);
    const res = await fetch(`/api/kontrolepunt/${p.checkpoint.number}`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      alert(json.error ?? "Indien het misluk.");
      return;
    }
    router.refresh();
    window.location.reload();
  }

  const stale = fb && status !== "READY" && fb.ready;
  const feedbackView = fb ? { ...fb, stale: Boolean(stale) } : null;

  return (
    <div className="editor">
      <div>
        {!p.editable && p.lockReason ? (
          <div className={`lockbar ${p.checkpoint?.status === "APPROVED" ? "ok" : p.checkpoint?.status === "SUBMITTED" ? "wait" : ""}`}>
            {ICON_LOCK} <span>{p.lockReason}</span>
          </div>
        ) : null}
        {save === "conflict" ? (
          <div className="alert warn" style={{ marginBottom: 16 }}>
            Iemand anders in julle groep het intussen hierdie werkblad verander. <b>Julle laaste veranderinge is nie gestoor nie.</b>{" "}
            <button className="btn sm" onClick={() => window.location.reload()}>
              Laai nuutste weergawe
            </button>
          </div>
        ) : null}
        {save === "locked" ? <div className="alert warn" style={{ marginBottom: 16 }}>Hierdie werkblad is intussen gesluit. Laai die bladsy weer.</div> : null}

        <WerkbladVorm
          sheet={p.sheet}
          sheetKey={p.sheetKey}
          data={data}
          onChange={onChange}
          readOnly={!editable}
          members={p.members}
          photos={photos}
          photosEditable={editable}
          onPhotosChange={setPhotos}
          teacherNotes={p.teacherNotes}
          missing={missing}
        />
      </div>

      <aside className="side">
        <div className="panel">
          <div className="pb" style={{ display: "grid", gap: 12 }}>
            <StatusBlock status={status} editable={p.editable} cp={p.checkpoint} readyBy={p.readyBy} hasFeedback={p.sheet.feedback} />
            {p.editable ? (
              <div className={`savebar ${save === "saving" || save === "dirty" ? "saving" : save === "error" || save === "conflict" ? "err" : ""}`}>
                <span className="dot" />
                {save === "saving" || save === "dirty"
                  ? "Stoor…"
                  : save === "error"
                    ? "Kon nie stoor nie – probeer weer…"
                    : save === "conflict"
                      ? "Nie gestoor nie"
                      : savedAt
                        ? `Gestoor ${savedAt.toLocaleTimeString("af-ZA", { hour: "2-digit", minute: "2-digit" })}`
                        : "Alles word outomaties gestoor"}
              </div>
            ) : null}
            {p.sheet.feedback && editable ? (
              <>
                <button className="btn primary lg" onClick={askFeedback} disabled={asking}>
                  {asking ? (
                    <>
                      <span className="spinner" /> Lees julle werk…
                    </>
                  ) : fb ? (
                    "Vra weer terugvoer"
                  ) : (
                    "Vra terugvoer"
                  )}
                </button>
                {asking ? <small>Dit kan tot ’n halfminuut neem.</small> : null}
                {askError ? <div className="alert err">{askError}</div> : null}
              </>
            ) : null}
            {p.checkpoint && p.checkpoint.canSubmit && p.editable ? (
              <button className="btn ok" onClick={submit} disabled={submitting}>
                {submitting ? <span className="spinner" /> : null} Dien in vir kontrolepunt {p.checkpoint.number}
              </button>
            ) : null}
            {p.checkpoint && !p.checkpoint.canSubmit && p.checkpoint.status !== "APPROVED" && p.checkpoint.status !== "SUBMITTED" && status === "READY" ? (
              <small>{p.checkpoint.reason}</small>
            ) : null}
          </div>
        </div>

        {p.checkpoint?.status === "RETURNED" && p.checkpoint.comment ? (
          <div className="panel">
            <div className="ph">
              <h3>Van die onderwyser</h3>
            </div>
            <div className="pb">
              <div className="teacher-comment">{p.checkpoint.comment}</div>
              <small>
                — {p.checkpoint.teacherName}
                {p.checkpoint.decidedAt ? `, ${new Date(p.checkpoint.decidedAt).toLocaleDateString("af-ZA")}` : ""}
              </small>
            </div>
          </div>
        ) : null}

        {p.sheet.feedback ? (
          <div className="panel">
            <div className="ph">
              <h3>{feedbackView ? "Terugvoer" : "Waarna kyk die terugvoer?"}</h3>
              {p.feedbackCount > 1 ? <small style={{ marginLeft: "auto" }}>{p.feedbackCount}× gevra</small> : null}
            </div>
            <div className="pb">
              {feedbackView ? (
                <TerugvoerInhoud fb={feedbackView} criteria={p.sheet.criteria} reportSheet={p.sheetKey} />
              ) : (
                <>
                  <p className="muted" style={{ fontSize: ".9rem" }}>
                    Wanneer julle gereed voel, vra terugvoer. Die KI kyk na hierdie kriteria – dieselfde vir elke groep. Dit wys aan wat ontbreek en vra vrae, maar skryf nie julle antwoorde nie.
                  </p>
                  <Kriteria criteria={p.sheet.criteria} />
                </>
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function StatusBlock({
  status,
  editable,
  cp,
  readyBy,
  hasFeedback
}: {
  status: Props["initialStatus"];
  editable: boolean;
  cp: CheckpointInfo | null;
  readyBy: string | null;
  hasFeedback: boolean;
}) {
  if (cp?.status === "APPROVED")
    return (
      <div className="status-big ok">
        <span className="ic">{ICON_OK}</span>
        <div>
          Afgeteken<small>Kontrolepunt {cp.number} deur {cp.teacherName}</small>
        </div>
      </div>
    );
  if (cp?.status === "SUBMITTED")
    return (
      <div className="status-big wait">
        <span className="ic">{ICON_DOTS}</span>
        <div>
          Ingedien<small>Wag vir die onderwyser se aftekening</small>
        </div>
      </div>
    );
  if (!editable)
    return (
      <div className="status-big lock">
        <span className="ic">{ICON_LOCK}</span>
        <div>
          Gesluit<small>Nog nie beskikbaar nie</small>
        </div>
      </div>
    );
  if (!hasFeedback) return null;
  if (status === "READY")
    return (
      <div className="status-big ok">
        <span className="ic">{ICON_OK}</span>
        <div>
          Gereed vir onderwyser<small>{readyBy && readyBy !== "KI" ? `Goedgekeur deur ${readyBy}` : "Al die kriteria is behaal"}</small>
        </div>
      </div>
    );
  return (
    <div className="status-big warn">
      <span className="ic">{ICON_DOTS}</span>
      <div>
        Nog nie gereed nie<small>{status === "NOT_STARTED" ? "Begin om in te vul" : "Verbeter en vra terugvoer"}</small>
      </div>
    </div>
  );
}
