import Link from "next/link";
import IndienKnoppie from "@/components/IndienKnoppie";
import { CpBadge, SheetBadge } from "@/components/Kentekens";
import { loadWorkbook } from "@/lib/diens";
import { workbookOverview } from "@/lib/oorsig";
import { requireGroup } from "@/lib/sessie";

export const metadata = { title: "Ons werkboek" };

const PHASE_OF_CP: Record<number, string> = { 1: "f1", 2: "f2", 3: "f3", 4: "f4", 5: "f5", 6: "ekspo1" };

export default async function GroepTuis() {
  const g = await requireGroup();
  const { group, template: t, members } = await loadWorkbook(g.id);
  const { checkpoints, approved, current } = workbookOverview(t, group.responses, group.checkpoints, group.paperImport);
  const coverDone = Boolean(group.name && members[0]);
  const nextSheet = current?.sheets.find((s) => !s.ready) ?? current?.sheets[0];
  const personal = t.sheets.find((s) => s.perMember);
  const named = members.map((m, i) => ({ name: m.trim(), i: i + 1 })).filter((m) => m.name);

  return (
    <div className="container">
      <div className="cover">
        <div className="kicker">
          {t.label} · Leerderwerkboek {group.project.year}
        </div>
        <h1>{group.project.phenomenon}</h1>
        <div className="question">“{group.project.question}”</div>
        <div className="meta">
          <span className="chip">{group.name ?? "Groepnaam nog nie ingevul nie"}</span>
          {group.klas ? <span className="chip">Klas {group.klas}</span> : null}
          {named.map((m) => (
            <span className="chip" key={m.i}>
              {m.name}
            </span>
          ))}
          <span className="chip">
            {approved} / {t.checkpoints.length} kontrolepunte afgeteken
          </span>
        </div>
        <div className="actions btn-row">
          {!coverDone ? (
            <Link className="btn" href="/groep/werkblad/voorblad">
              Begin hier: vul julle groep in →
            </Link>
          ) : nextSheet ? (
            <Link className="btn" href={`/groep/werkblad/${nextSheet.key}`}>
              Gaan voort: Werkblad {nextSheet.sheet.number} →
            </Link>
          ) : null}
          {coverDone ? (
            <Link className="btn ghost" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.4)" }} href="/groep/werkblad/voorblad">
              Wysig groep
            </Link>
          ) : null}
        </div>
      </div>

      {group.paperImport ? (
        <div className="alert info" style={{ marginTop: 16 }}>
          📄 Julle papierwerkboek (tot by die laaste afgetekende werkblad) is ingelees. Maak elke werkblad oop om jul juf se kommentaar en die KI-terugvoer te lees; julle mag dit nog verbeter. Gaan dan verder met die volgende werkblad.
        </div>
      ) : null}

      <div className="layout-2">
        <div>
          {checkpoints.map((cp) => {
            const locked = !cp.unlocked;
            const phase = t.phases.find((p) => p.key === PHASE_OF_CP[cp.number]);
            return (
              <div className="cp-block" key={cp.number}>
                <div className={`cp-head ${cp.status === "APPROVED" ? "approved" : locked ? "locked" : ""}`}>
                  <span className="num">{cp.status === "APPROVED" ? "✓" : cp.number}</span>
                  <div>
                    <div className="title">{cp.title}</div>
                    {phase ? (
                      <div className="sub">
                        {phase.label} · {phase.dates}
                      </div>
                    ) : null}
                  </div>
                  <div className="right">
                    <CpBadge status={cp.status} />
                    {locked ? <span className="badge">Gaan oop ná kontrolepunt {cp.number - 1}</span> : null}
                  </div>
                </div>
                {cp.sheets.map((s) =>
                  locked ? (
                    <div className="sheet-row locked" key={s.key}>
                      <span className="n">{s.sheet.number}</span>
                      <span className="t">{s.sheet.title}</span>
                    </div>
                  ) : (
                    <Link className="sheet-row" key={s.key} href={`/groep/werkblad/${s.key}`}>
                      <span className="n">{s.sheet.number}</span>
                      <span className="t">{s.sheet.title}</span>
                      <span className="right">
                        <span className="progress" title={`${Math.round(s.progress * 100)}% ingevul`}>
                          <span style={{ width: `${Math.round(s.progress * 100)}%` }} />
                        </span>
                        {cp.status === "APPROVED" || cp.status === "SUBMITTED" ? null : <SheetBadge status={s.status} ready={s.ready} />}
                      </span>
                    </Link>
                  )
                )}
                {!locked ? (
                  <div className="cp-foot">
                    <span className="statement">“{cp.statement}”</span>
                    <span style={{ marginLeft: "auto" }} />
                    {cp.status === "APPROVED" && cp.record ? (
                      <small>
                        Afgeteken deur <b>{cp.record.teacherName}</b> op {cp.record.decidedAt?.toLocaleDateString("af-ZA", { day: "numeric", month: "long" })}
                      </small>
                    ) : cp.canSubmit ? (
                      <IndienKnoppie n={cp.number} />
                    ) : cp.status === "SUBMITTED" ? (
                      <small>Ingedien – die onderwyser kyk daarna.</small>
                    ) : (
                      <small>Al die werkblaaie moet eers “gereed” wees.</small>
                    )}
                  </div>
                ) : null}
                {cp.status === "RETURNED" && cp.record?.comment ? (
                  <div className="teacher-comment">
                    <b>{cp.record.teacherName}:</b> {cp.record.comment}
                  </div>
                ) : null}
              </div>
            );
          })}

          {personal ? (
            <div className="cp-block">
              <div className="cp-head">
                <span className="num">{personal.number}</span>
                <div>
                  <div className="title">{personal.title}</div>
                  <div className="sub">{personal.intro}</div>
                </div>
              </div>
              {(named.length ? named : [{ name: "Lid 1", i: 1 }]).map((m) => {
                const r = group.responses.find((x) => x.sheet === `${personal.key}:${m.i}`);
                return (
                  <Link className="sheet-row" key={m.i} href={`/groep/werkblad/${personal.key}:${m.i}`}>
                    <span className="n">·</span>
                    <span className="t">{m.name}</span>
                    <span className="right">
                      <SheetBadge status={r?.status ?? "NOT_STARTED"} ready={r?.status === "READY"} />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <aside style={{ display: "grid", gap: 16 }}>
          <div className="card flat">
            <h3>Ons projek in vyf fases</h3>
            <ul className="timeline">
              {t.phases.map((p) => (
                <li key={p.key} className={p.kind ?? ""}>
                  <span className="d">{p.dates}</span>
                  <span>
                    <b>{p.label}.</b> {p.what}
                    <span className="r" style={{ display: "block" }}>
                      {p.ready}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card flat">
            <h3>Waarheen ons werk</h3>
            <p className="muted" style={{ fontSize: ".9rem" }}>
              By die ekspo moet elke groep hierdie ses dinge kan wys:
            </p>
            <ol className="goals">
              {t.intro.expoGoals.map((goal) => (
                <li key={goal.title}>
                  <span>
                    <b>{goal.title}</b> – {goal.text}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {t.rules ? (
            <div className="card flat">
              <h3>Ons vyf reëls</h3>
              <p className="muted" style={{ fontSize: ".9rem" }}>
                {t.rules.intro}
              </p>
              <div className="rules">
                {t.rules.items.map((r) => (
                  <div className="rule" key={r.name} style={{ gridTemplateColumns: "1fr", gap: 2 }}>
                    <b>{r.name}</b>
                    <span>{r.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="card flat">
            <h3>Hoe werk hierdie werkboek?</h3>
            <p style={{ fontSize: ".92rem" }}>{t.intro.how}</p>
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: ".9rem" }}>
              {t.intro.howBullets.map((b) => (
                <li key={b} style={{ margin: "4px 0" }}>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="card flat" style={{ background: "var(--blue-soft)", borderColor: "transparent" }}>
            <h3>Wat ons NIE van julle verwag nie</h3>
            <p style={{ fontSize: ".92rem", margin: 0 }}>{t.intro.notExpected}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
