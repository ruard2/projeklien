"use client";

import { useRef, useState } from "react";

export type PhotoInfo = { id: string; field: string; caption: string | null };

const MAX_SIDE = 1600;

/** Verklein die foto in die blaaier (spaar data en berging), en verwyder so ook EXIF/GPS. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Kon nie die foto verwerk nie."))), "image/jpeg", 0.82));
}

export default function FotoVeld({
  sheetKey,
  field,
  max,
  photos,
  editable,
  onChange
}: {
  sheetKey: string;
  field: string;
  max: number;
  photos: PhotoInfo[];
  editable: boolean;
  onChange: (p: PhotoInfo[]) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    if (!consent) {
      setError("Bevestig eers die toestemming hieronder.");
      return;
    }
    setBusy(true);
    try {
      const blob = await compress(file);
      const fd = new FormData();
      fd.set("sheet", sheetKey);
      fd.set("field", field);
      fd.set("caption", caption.trim());
      fd.set("consent", "1");
      fd.set("file", blob, "foto.jpg");
      const res = await fetch("/api/fotos", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Oplaai het misluk.");
      onChange([...photos, json.photo]);
      setCaption("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oplaai het misluk.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!confirm("Verwyder hierdie foto?")) return;
    const res = await fetch(`/api/fotos/${id}`, { method: "DELETE" });
    if (res.ok) onChange(photos.filter((p) => p.id !== id));
    else setError((await res.json()).error ?? "Kon nie verwyder nie.");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {photos.length ? (
        <div className="photos">
          {photos.map((p) => (
            <figure className="photo" key={p.id} style={{ margin: 0 }}>
              <a href={`/api/fotos/${p.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/fotos/${p.id}`} alt={p.caption ?? "Foto"} loading="lazy" />
              </a>
              {p.caption ? <figcaption className="cap">{p.caption}</figcaption> : null}
              {editable ? (
                <button type="button" className="rm" aria-label="Verwyder foto" onClick={() => remove(p.id)}>
                  ×
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : !editable ? (
        <div className="muted" style={{ fontStyle: "italic" }}>Geen foto’s nie.</div>
      ) : null}

      {editable && photos.length < max ? (
        <div className="upload">
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Daar is <b>geen herkenbare mense</b> op hierdie foto nie, óf die skool het uitdruklike toestemming gereël. Daar is geen name of persoonlike inligting op sigbaar nie.
            </span>
          </label>
          <input type="text" placeholder="Kort beskrywing (opsioneel)" value={caption} maxLength={140} onChange={(e) => setCaption(e.target.value)} />
          <div className="btn-row">
            <label className={`btn ${consent ? "primary" : ""}`} aria-disabled={!consent || busy} style={!consent || busy ? { opacity: 0.6 } : undefined}>
              {busy ? <span className="spinner" /> : "📷"} {busy ? "Laai op…" : "Kies of neem ’n foto"}
              <input
                ref={input}
                type="file"
                accept="image/*"
                hidden
                disabled={!consent || busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
            </label>
            <small>
              {photos.length} / {max}
            </small>
          </div>
          <small>Foto’s word nooit na die KI gestuur nie.</small>
        </div>
      ) : null}
      {error ? <div className="alert err">{error}</div> : null}
    </div>
  );
}
