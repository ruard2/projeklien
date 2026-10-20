"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProjectOption = { id: string; grade: number; title: string; sub: string };

export default function PdfOplaai({ projects, group }: { projects: ProjectOption[]; group?: { id: string; projectId: string; label: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<"beste" | "vinnig">("beste");
  const [projectId, setProjectId] = useState(group?.projectId ?? (projects.length === 1 ? projects[0].id : ""));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!projectId) return setError("Kies eers graad 8 of graad 9.");
    setBusy(true);
    try {
      const res = await fetch("/api/pdf-vergelyking", { method: "POST", body: new FormData(e.currentTarget) });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error || "Oplaai het misluk.");
      router.push(`/onderwyser/pdf-vergelyking/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Oplaai het misluk.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="projectId" value={projectId} />
      {group ? <input type="hidden" name="groupId" value={group.id} /> : null}

      <div>
        <div className="lbl">1. Watter werkboek?</div>
        {group ? (
          <div className="pv-choice on" style={{ cursor: "default" }}>
            <b>{projects.find((p) => p.id === group.projectId)?.title ?? "Werkboek"}</b>
            <span>{group.label}</span>
          </div>
        ) : (
          <div className="pv-choices">
            {projects.map((p) => (
              <button type="button" key={p.id} className={`pv-choice ${projectId === p.id ? "on" : ""}`} aria-pressed={projectId === p.id} onClick={() => setProjectId(p.id)}>
                <b>Graad {p.grade}</b>
                <span>{p.title}</span>
                <small>{p.sub}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="lbl" htmlFor="pdf-leer">2. Gescande werkboek (PDF, hoogstens 30 MB)</label>
        <input id="pdf-leer" type="file" name="file" accept="application/pdf,.pdf" required />
      </div>

      <div>
        <div className="lbl">3. Uitlees-kwaliteit</div>
        <div className="pv-choices">
          <label className={`pv-choice ${quality === "beste" ? "on" : ""}`}>
            <input type="radio" name="kwaliteit" value="beste" checked={quality === "beste"} onChange={() => setQuality("beste")} style={{ display: "none" }} />
            <b>Beste (aanbeveel)</b>
            <small>Groot model, lees handskrif die beste. ’n Paar minute.</small>
          </label>
          <label className={`pv-choice ${quality === "vinnig" ? "on" : ""}`}>
            <input type="radio" name="kwaliteit" value="vinnig" checked={quality === "vinnig"} onChange={() => setQuality("vinnig")} style={{ display: "none" }} />
            <b>Vinniger</b>
            <small>Dieselfde model as die gewone terugvoer; meer leesfoute.</small>
          </label>
        </div>
      </div>

      <div className="alert warn" style={{ fontSize: ".9rem" }}>
        <b>Let wel:</b> die hele skandering, mét die leerders se name en handskrif, word na OpenAI gestuur om dit uit te lees. Die KI-terugvoer daarna is weer geanonimiseer, en die PDF word geskrap sodra jy die uitlees goedkeur.
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: ".93rem" }}>
        <input type="checkbox" name="consent" value="1" required style={{ marginTop: 3, width: "auto" }} />
        <span>Ek verstaan dit en mag hierdie werkboek vir hierdie doel gebruik.</span>
      </label>
      <div className="btn-row">
        <button className="btn primary" disabled={busy}>
          {busy ? <span className="spinner" /> : null} Laai op en lees uit
        </button>
      </div>
      {error ? <div className="alert err">{error}</div> : null}
    </form>
  );
}
