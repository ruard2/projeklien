"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

async function runOne(groupId: string, force: boolean): Promise<void> {
  const res = await fetch(`/api/assessering/${groupId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force })
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Beoordeling het misluk.");
}

const CONCURRENCY = 3;

/** Beoordeel al die groepe wat nog nie ’n KI-voorstel vir hulle huidige werkboek het nie. */
export function BeoordeelAlles({ groups }: { groups: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const stop = useRef(false);

  async function start() {
    setBusy(true);
    setDone(0);
    setFailed([]);
    stop.current = false;
    const queue = [...groups];
    const worker = async () => {
      for (let g = queue.shift(); g && !stop.current; g = queue.shift()) {
        try {
          await runOne(g.id, false);
        } catch {
          try {
            await runOne(g.id, false);
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
              <span className="spinner" /> Beoordeel… {done} van {groups.length}
            </button>
            <button className="btn sm" onClick={() => (stop.current = true)}>
              Stop ná huidige groepe
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={start}>
            Beoordeel {groups.length} groep{groups.length === 1 ? "" : "e"} met die KI
          </button>
        )}
      </div>
      {busy ? <small className="muted">Hou hierdie bladsy oop. Elke groep neem sowat ’n minuut of twee; drie word gelyk gedoen. Jy kan later net weer klik: wat klaar is, word nie oorgedoen nie.</small> : null}
      {failed.length ? <div className="alert err">Nie gelukkig nie: {failed.join(", ")}. Klik weer om dit oor te probeer.</div> : null}
    </div>
  );
}

/** Een groep (weer) deur die KI laat beoordeel. Bestaande finale punte bly staan. */
export function BeoordeelEen({ groupId, again }: { groupId: string; again: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 6 }} className="no-print">
      <button
        className={`btn sm ${again ? "" : "primary"}`}
        disabled={busy}
        onClick={async () => {
          if (again && !confirm("Laat die KI hierdie werkboek weer beoordeel? Julle gestoorde punte bly staan.")) return;
          setBusy(true);
          setError(null);
          try {
            await runOne(groupId, again);
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
