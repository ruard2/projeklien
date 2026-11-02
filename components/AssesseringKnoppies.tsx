"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

async function runOne(groupId: string, force: boolean, fotos: boolean): Promise<void> {
  const res = await fetch(`/api/assessering/${groupId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force, fotos })
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Beoordeling het misluk.");
}

const CONCURRENCY = 3;

function FotoToestemming({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: ".88rem", maxWidth: "70ch", textAlign: "left" }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, width: "auto", flex: "none" }} />
      <span>
        <b>Laat die KI ook die foto’s sien.</b> Die foto’s van werkblad 1–14 gaan dan na OpenAI, ook enige gesigte of name daarop. Merk dit net as die skool dit toelaat.
      </span>
    </label>
  );
}

export type AssessGroup = { id: string; name: string; pending: boolean; photosDue: boolean };

/** Beoordeel al die groepe wat nog nie ’n KI-voorstel vir hulle huidige werkboek het nie. */
export function BeoordeelAlles({ groups }: { groups: AssessGroup[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [fotos, setFotos] = useState(false);
  const [total, setTotal] = useState(0);
  const stop = useRef(false);
  const targets = groups.filter((g) => g.pending || (fotos && g.photosDue));
  const canShowPhotos = groups.some((g) => g.photosDue);

  async function start() {
    setBusy(true);
    setDone(0);
    setFailed([]);
    setTotal(targets.length);
    stop.current = false;
    const queue = [...targets];
    const worker = async () => {
      for (let g = queue.shift(); g && !stop.current; g = queue.shift()) {
        try {
          await runOne(g.id, false, fotos);
        } catch {
          try {
            await runOne(g.id, false, fotos);
          } catch {
            const name = g.name;
            setFailed((f) => [...f, name]);
          }
        }
        setDone((d) => d + 1);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setBusy(false);
    router.refresh();
  }

  if (!groups.length && !busy) return <span className="badge ok">Alle ingevulde werkboeke is deur die KI beoordeel</span>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="btn-row">
        {busy ? (
          <>
            <button className="btn primary" disabled>
              <span className="spinner" /> Beoordeel… {done} van {total}
            </button>
            <button className="btn sm" onClick={() => (stop.current = true)}>
              Stop ná huidige groepe
            </button>
          </>
        ) : targets.length ? (
          <button className="btn primary" onClick={start}>
            Beoordeel {targets.length} groep{targets.length === 1 ? "" : "e"} met die KI{fotos ? " en foto’s" : ""}
          </button>
        ) : (
          <span className="badge ok">Alle ingevulde werkboeke is deur die KI beoordeel</span>
        )}
      </div>
      {canShowPhotos ? <FotoToestemming checked={fotos} onChange={setFotos} disabled={busy} /> : null}
      {busy ? <small className="muted">Hou hierdie bladsy oop. Elke groep neem sowat ’n minuut of twee; drie word gelyk gedoen. Jy kan later net weer klik: wat klaar is, word nie oorgedoen nie.</small> : null}
      {failed.length ? <div className="alert err">Nie gelukkig nie: {failed.join(", ")}. Klik weer om dit oor te probeer.</div> : null}
    </div>
  );
}

/** Een groep (weer) deur die KI laat beoordeel. Bestaande finale punte bly staan. */
export function BeoordeelEen({ groupId, again, photoCount }: { groupId: string; again: boolean; photoCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fotos, setFotos] = useState(false);
  return (
    <div style={{ display: "grid", gap: 6 }} className="no-print">
      {photoCount ? <FotoToestemming checked={fotos} onChange={setFotos} disabled={busy} /> : null}
      <button
        className={`btn sm ${again ? "" : "primary"}`}
        disabled={busy}
        onClick={async () => {
          if (again && !confirm("Laat die KI hierdie werkboek weer beoordeel? Julle gestoorde punte bly staan.")) return;
          setBusy(true);
          setError(null);
          try {
            await runOne(groupId, again, fotos);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Beoordeling het misluk.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <span className={`spinner ${again ? "dark" : ""}`} /> : null} {busy ? "KI lees die werkboek…" : again ? "Laat KI weer beoordeel" : "Beoordeel met die KI"}
      </button>
      {error ? <div className="alert err">{error}</div> : null}
    </div>
  );
}
