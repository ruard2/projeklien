"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePdfSheet } from "@/app/onderwyser/pdf-aksies";
import type { JufKommentaar } from "@/lib/pdf-vergelyking/skema";
import type { Sheet, SheetData } from "@/lib/werkboeke/tipes";
import WerkbladVorm from "./WerkbladVorm";

function Lys({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>{empty}</p>;
  return <ul className="pv-list">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

/** Een uitgelese werkblad: leerders se werk in die app se eie vorm, juf se kommentaar apart, met “Wysig”. */
export default function PdfWerkblad(p: {
  comparisonId: string;
  sheet: Sheet;
  data: SheetData;
  juf: JufKommentaar;
  members: string[];
  foto: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState<SheetData>(p.data);
  const [kommentaar, setKommentaar] = useState(p.juf.kommentaar.join("\n"));
  const [vorige, setVorige] = useState(p.juf.kommentaar_vorige.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await savePdfSheet({ id: p.comparisonId, sheet: p.sheet.key, data, kommentaar: kommentaar.split("\n"), vorige: vorige.split("\n") });
      if (res.error) return setError(res.error);
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setData(p.data);
    setKommentaar(p.juf.kommentaar.join("\n"));
    setVorige(p.juf.kommentaar_vorige.join("\n"));
    setEditing(false);
    setError(null);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="pv-box lln">
        <h4>Leerders</h4>
        <div className="pv-form">
          <WerkbladVorm sheet={p.sheet} sheetKey={p.sheet.key} data={editing ? data : p.data} onChange={setData} readOnly={!editing} members={p.members} />
        </div>
        {p.foto ? <p className="muted" style={{ margin: "6px 0 0", fontSize: ".88rem" }}>🖼 Daar is ’n tekening/foto op hierdie bladsy (word nie na die KI gestuur nie).</p> : null}
      </div>

      <div className="pv-box juf">
        <h4>Juf</h4>
        {editing ? (
          <div style={{ display: "grid", gap: 8 }}>
            <label className="lbl" style={{ margin: 0 }}>Kommentaar op die finale weergawe (een opmerking per reël)</label>
            <textarea rows={Math.max(3, kommentaar.split("\n").length + 1)} value={kommentaar} onChange={(e) => setKommentaar(e.target.value)} />
            <label className="lbl" style={{ margin: 0 }}>Kommentaar op ’n vroeëre weergawe</label>
            <textarea rows={Math.max(2, vorige.split("\n").length + 1)} value={vorige} onChange={(e) => setVorige(e.target.value)} />
          </div>
        ) : (
          <>
            <Lys items={p.juf.kommentaar} empty="Geen kommentaar op die finale weergawe nie." />
            {p.juf.kommentaar_vorige.length ? (
              <>
                <h4 style={{ marginTop: 12 }}>Op ’n vroeëre weergawe</h4>
                <Lys items={p.juf.kommentaar_vorige} empty="" />
              </>
            ) : null}
          </>
        )}
        <p style={{ margin: "10px 0 0", fontSize: ".9rem" }}>{p.juf.afgeteken ? `✔ Kontrolepunt afgeteken${p.juf.afteken_datum ? ` (${p.juf.afteken_datum})` : ""}` : "Nie afgeteken nie."}</p>
      </div>

      {p.editable ? (
        <div className="btn-row">
          {editing ? (
            <>
              <button type="button" className="btn primary sm" onClick={save} disabled={pending}>
                {pending ? <span className="spinner" /> : null} Stoor regstellings
              </button>
              <button type="button" className="btn sm" onClick={cancel} disabled={pending}>Kanselleer</button>
            </>
          ) : (
            <button type="button" className="btn sm" onClick={() => setEditing(true)}>✏️ Wysig (stel leesfoute reg)</button>
          )}
        </div>
      ) : null}
      {error ? <div className="alert err">{error}</div> : null}
    </div>
  );
}
