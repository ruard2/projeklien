"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PdfOplaai({ projects }: { projects: { id: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
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
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <div className="field" style={{ margin: 0 }}>
        <label className="lbl" htmlFor="pdf-projek">Projek (werkboek)</label>
        <select id="pdf-projek" name="projectId" required defaultValue={projects.length === 1 ? projects[0].id : ""}>
          <option value="" disabled>— kies —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label className="lbl" htmlFor="pdf-leer">Gescande werkboek (PDF, hoogstens 30 MB)</label>
        <input id="pdf-leer" type="file" name="file" accept="application/pdf,.pdf" required />
      </div>
      <div className="alert warn" style={{ fontSize: ".9rem" }}>
        <b>Let wel:</b> die hele skandering, mét die leerders se name en handskrif, word na OpenAI gestuur om dit uit te lees. Die KI-terugvoer daarna is weer geanonimiseer, en die PDF word geskrap sodra jy die uitlees goedkeur.
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: ".93rem" }}>
        <input type="checkbox" name="consent" value="1" required style={{ marginTop: 3 }} />
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
