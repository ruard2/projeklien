"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PdfInvoer() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/pdf-vergelyking/invoer", { method: "POST", body: new FormData(e.currentTarget) });
      const json = (await res.json().catch(() => ({}))) as { ids?: string[]; error?: string };
      if (!res.ok || !json.ids) throw new Error(json.error || "Invoer het misluk.");
      setMsg({ ok: `${json.ids.length} werkboek(e) ingevoer. Maak elkeen hieronder oop om na te gaan en goed te keur.` });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setMsg({ error: err instanceof Error ? err.message : "Invoer het misluk." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
      <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
        Het jy reeds ’n lêer met uitgelese werkboeke (JSON)? Laai dit hier op: elke werkboek verskyn dadelik in die stap “Wag op jou akkoord”, sonder om eers deur die KI uitgelees te word.
      </p>
      <input type="file" name="file" accept="application/json,.json" required />
      <div className="btn-row">
        <button className="btn sm" disabled={busy}>{busy ? <span className="spinner dark" /> : null} Voer in</button>
      </div>
      {msg?.error ? <div className="alert err">{msg.error}</div> : null}
      {msg?.ok ? <div className="alert ok">{msg.ok}</div> : null}
    </form>
  );
}
