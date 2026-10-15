"use client";

import { useState } from "react";

export default function RapporteerKi({ feedbackId, sheet, existing }: { feedbackId: string; sheet: string; existing: { status: string; resolution: string | null } | null }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(form: FormData) {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/terugvoer/rapporteer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId, sheet, category: form.get("category"), message })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Die verslag kon nie gestuur word nie.");
      setDone(true);
      setOpen(false);
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die verslag kon nie gestuur word nie.");
    } finally {
      setPending(false);
    }
  }

  if (done) return <div className="alert ok" style={{ fontSize: ".86rem" }}>Dankie. Julle onderwyser en die ontwikkelaar kan die KI-antwoord nou ondersoek.</div>;
  if (existing) {
    return (
      <div className={`alert ${existing.status === "verwerk" ? "ok" : "warn"}`} style={{ fontSize: ".86rem" }}>
        Hierdie KI-antwoord is reeds gerapporteer. Status: <b>{existing.status}</b>.
        {existing.resolution ? <div style={{ marginTop: 5 }}><b>Uitkoms:</b> {existing.resolution}</div> : null}
      </div>
    );
  }

  return (
    <div className="ai-report no-print">
      <button type="button" className="btn ghost sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        ⚑ Rapporteer hierdie KI-antwoord
      </button>
      {open ? (
        <form action={submit} style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <label className="lbl" htmlFor={`report-${feedbackId}`}>Wat het verkeerd geloop?</label>
          <select id={`report-${feedbackId}`} name="category" defaultValue="verkeerd" required>
            <option value="onveilig">Onveilige raad</option>
            <option value="onvanpas">Onvanpaste of vernederende taal</option>
            <option value="verkeerd">Verkeerde inligting</option>
            <option value="antwoord_weggegee">Die KI gee die antwoord weg</option>
            <option value="privaatheid">Privaatheidsprobleem</option>
            <option value="ander">Ander probleem</option>
          </select>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={1200} placeholder="Verduidelik kortliks wat julle bekommer. Moenie persoonlike inligting insluit nie." />
          <div className="btn-row">
            <button className="btn sm" disabled={pending}>{pending ? "Stuur…" : "Stuur verslag"}</button>
            <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>Kanselleer</button>
          </div>
          {error ? <small style={{ color: "var(--red)" }}>{error}</small> : null}
        </form>
      ) : null}
    </div>
  );
}
