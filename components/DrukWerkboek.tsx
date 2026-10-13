import { db } from "@/lib/db";
import { loadWorkbook } from "@/lib/diens";
import type { SheetData } from "@/lib/werkboeke/tipes";
import DrukKnoppie from "./DrukKnoppie";
import WerkbladVorm, { type TeacherNotes } from "./WerkbladVorm";

/** Die hele werkboek as een drukbare dokument (groep en onderwyser). */
export default async function DrukWerkboek({ groupId }: { groupId: string }) {
  const { group, template: t, members } = await loadWorkbook(groupId);
  const photos = await db.photo.findMany({ where: { groupId }, select: { id: true, field: true, caption: true, sheet: true }, orderBy: { createdAt: "asc" } });
  const named = members.map((m, i) => ({ name: m.trim(), i: i + 1 })).filter((m) => m.name);

  const blocks = t.sheets.flatMap((s) => (s.perMember ? named.map((m) => ({ sheet: s, key: `${s.key}:${m.i}`, who: m.name })) : [{ sheet: s, key: s.key, who: null as string | null }]));

  return (
    <div className="container narrow">
      <div className="no-print row" style={{ marginBottom: 18 }}>
        <p className="muted grow" style={{ margin: 0 }}>
          Hierdie bladsy wys die hele werkboek. Gebruik “Druk” om dit as PDF te stoor of te druk.
        </p>
        <DrukKnoppie />
      </div>

      <div className="cover" style={{ marginBottom: 22 }}>
        <div className="kicker">Gereformeerde Hoërskool Dirk Postma · Verskynselgebaseerde Ondersoekende Leer</div>
        <h1>
          {t.label} · Leerderwerkboek {group.project.year}
        </h1>
        <div className="question">“{group.project.question}”</div>
        <div className="meta">
          <span className="chip">{group.name ?? "—"}</span>
          {group.klas ? <span className="chip">Klas {group.klas}</span> : null}
          {named.map((m) => (
            <span className="chip" key={m.i}>
              {m.name}
            </span>
          ))}
          <span className="chip">Verskynsel: {group.project.phenomenon}</span>
        </div>
      </div>

      {blocks
        .filter((b) => b.sheet.key !== "voorblad")
        .map((b) => {
          const r = group.responses.find((x) => x.sheet === b.key);
          const cp = b.sheet.checkpoint ? t.checkpoints.find((c) => c.number === b.sheet.checkpoint) : null;
          const isLastOfCp = cp && cp.sheets[cp.sheets.length - 1] === b.sheet.key;
          const rec = cp ? group.checkpoints.find((c) => c.number === cp.number) : null;
          return (
            <div key={b.key} className="print-sheet" style={{ marginBottom: 30 }}>
              <div className="sheet-num">Werkblad {b.sheet.number}</div>
              <h2>
                {b.sheet.title}
                {b.who ? ` – ${b.who}` : ""}
              </h2>
              {b.sheet.intro ? <p className="muted">{b.sheet.intro}</p> : null}
              <WerkbladVorm
                sheet={b.sheet}
                sheetKey={b.key}
                data={(r?.data ?? {}) as SheetData}
                readOnly
                members={members}
                photos={photos.filter((p) => p.sheet === b.key)}
                teacherNotes={(r?.teacherNotes ?? {}) as TeacherNotes}
              />
              {isLastOfCp && cp ? (
                <div className="card flat" style={{ marginTop: 14, borderLeft: `4px solid ${rec?.status === "APPROVED" ? "var(--ok)" : "var(--line-2)"}` }}>
                  <b>{cp.title}</b> – {cp.statement}
                  <div style={{ marginTop: 6, fontSize: ".92rem" }}>
                    {rec?.status === "APPROVED" ? (
                      <>
                        Afgeteken deur <b>{rec.teacherName}</b> op {rec.decidedAt?.toLocaleDateString("af-ZA", { day: "numeric", month: "long", year: "numeric" })}
                      </>
                    ) : (
                      <span className="muted">Nog nie afgeteken nie.</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
    </div>
  );
}
