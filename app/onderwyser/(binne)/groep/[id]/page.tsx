import Link from "next/link";
import { notFound } from "next/navigation";
import AksieVorm from "@/components/AksieVorm";
import { CpBadge, SheetBadge } from "@/components/Kentekens";
import { fmtWhen } from "@/components/Terugvoer";
import { decide, reopen } from "@/app/onderwyser/actions";
import { db } from "@/lib/db";
import { loadWorkbook } from "@/lib/diens";
import type { FeedbackResult } from "@/lib/ki";
import { workbookOverview } from "@/lib/oorsig";
import { hasDeveloperView, requireTeacher } from "@/lib/sessie";
import { STATUS_LABEL } from "@/lib/pdf-vergelyking/status";

type HistoryEntry = { action: string; by?: string; comment?: string; at: string };

export default async function OnderwyserGroep({ params }: { params: Promise<{ id: string }> }) {
  const t = await requireTeacher();
  const { id } = await params;
  const exists = await db.group.findFirst({ where: { id, project: { schoolId: t.schoolId } }, select: { id: true } });
  if (!exists) notFound();

  const { group, template: tpl, members } = await loadWorkbook(id);
  const { checkpoints, approved } = workbookOverview(tpl, group.responses, group.checkpoints, group.paperImport);
  const feedback = await db.feedback.findMany({
    where: { groupId: id },
    select: { sheet: true, ready: true, result: true, createdAt: true, source: true },
    orderBy: { createdAt: "desc" }
  });
  const latestFb = new Map<string, (typeof feedback)[number]>();
  const fbCount = new Map<string, number>();
  for (const f of feedback) {
    if (!latestFb.has(f.sheet)) latestFb.set(f.sheet, f);
    fbCount.set(f.sheet, (fbCount.get(f.sheet) ?? 0) + 1);
  }
  const focusCp = checkpoints.find((c) => c.unlocked && c.status !== "APPROVED")?.number;
  const pdfs = await db.pdfComparison.findMany({
    where: { groupId: id, schoolId: t.schoolId, ...(t.role === "TEACHER" ? { teacherId: t.id } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, status: true, fileName: true }
  });
  const named = members.map((m, i) => ({ name: m.trim(), i: i + 1 })).filter((m) => m.name);
  const personal = tpl.sheets.find((s) => s.perMember);

  return (
    <div className="container">
      <div className="sheet-head">
        <div>
          <div className="crumb">
            <Link href={`/onderwyser?projek=${group.projectId}`}>Groepe</Link> · {group.project.title} {group.project.year}
          </div>
          <h1 style={{ marginBottom: 6 }}>{group.name ?? "(nog geen naam)"}</h1>
          <div className="row" style={{ gap: 8 }}>
            {group.klas ? <span className="badge plain blue">Klas {group.klas}</span> : null}
            <span className="badge plain mono">{group.code}</span>
            <span className="badge plain">
              {approved} / {tpl.checkpoints.length} afgeteken
            </span>
            <span className="muted" style={{ fontSize: ".9rem" }}>
              {named.map((m) => m.name).join(", ") || "Lede nog nie ingevul nie"}
            </span>
          </div>
        </div>
        <div className="right">
          <Link className="btn sm" href={`/onderwyser/groep/${id}/druk`}>
            Hele werkboek / druk
          </Link>
        </div>
      </div>

      {pdfs.length && (await hasDeveloperView(t)) ? (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <b>{group.paperImport ? "Ingelees uit die papierwerkboek." : "Papierwerkboek:"}</b> KI beoordeel:{" "}
          {pdfs.map((p, i) => (
            <span key={p.id}>
              {i ? " · " : ""}
              <Link href={`/onderwyser/pdf-vergelyking/${p.id}`}>{p.createdAt.toLocaleDateString("af-ZA")} ({STATUS_LABEL[p.status]?.text ?? p.status})</Link>
            </span>
          ))}
        </div>
      ) : null}

      <p className="muted" style={{ fontSize: ".88rem", margin: "0 0 10px" }}>Klik op ’n kontrolepunt om sy werkblaaie en die <b>aftekenknoppie</b> te sien.</p>
      {checkpoints.map((cp) => {
        const history = (Array.isArray(cp.record?.history) ? cp.record!.history : []) as unknown as HistoryEntry[];
        return (
          <details className="cp-block cp-acc" key={cp.number} id={`kp${cp.number}`} style={{ scrollMarginTop: 90 }} open={cp.status === "SUBMITTED" || cp.status === "RETURNED" || cp.number === focusCp || (cp.satisfied && cp.status !== "APPROVED")}>
            <summary className={`cp-head ${cp.status === "APPROVED" ? "approved" : !cp.unlocked ? "locked" : ""}`}>
              <span className="num">{cp.status === "APPROVED" ? "✓" : cp.number}</span>
              <div>
                <div className="title">{cp.title}</div>
                <div className="sub">{cp.statement}</div>
              </div>
              <div className="right">
                <CpBadge status={cp.status} />
                {!cp.unlocked ? <span className="badge">Nog gesluit vir die groep</span> : cp.status !== "APPROVED" && cp.satisfied ? <span className="badge ok">KI tevrede</span> : null}
              </div>
            </summary>

            {cp.sheets.map((s) => {
              const fb = latestFb.get(s.key);
              const result = fb?.result as unknown as FeedbackResult | undefined;
              const behaal = result?.kriteria.filter((k) => k.oordeel === "behaal").length ?? 0;
              return (
                <Link className="sheet-row" key={s.key} href={`/onderwyser/groep/${id}/${s.key}`}>
                  <span className="n">{s.sheet.number}</span>
                  <span>
                    <span className="t">{s.sheet.title}</span>
                    <span className="muted" style={{ display: "block", fontSize: ".82rem" }}>
                      {fb
                        ? `Laaste terugvoer ${fmtWhen(fb.createdAt.toISOString())} · ${result?.kriteria.length ? `${behaal}/${result.kriteria.length} kriteria` : "onvolledig"} · ${fbCount.get(s.key)}× gevra`
                        : "Nog geen terugvoer gevra nie"}
                    </span>
                  </span>
                  <span className="right">
                    <span className="progress" title={`${Math.round(s.progress * 100)}% ingevul`}>
                      <span style={{ width: `${Math.round(s.progress * 100)}%` }} />
                    </span>
                    <SheetBadge status={s.status} ready={s.ready} />
                  </span>
                </Link>
              );
            })}

            {cp.status !== "APPROVED" ? (() => {
              const readyCount = cp.sheets.filter((s) => s.ready).length;
              const msg =
                cp.status === "SUBMITTED"
                  ? "Die groep het hierdie kontrolepunt ingedien. Teken af of stuur terug met ’n kommentaar."
                  : cp.satisfied
                    ? "Al die werkblaaie is gereed volgens die KI; die groep kan reeds verder werk. Teken af as jy tevrede is."
                    : !cp.unlocked
                      ? "Die groep is nog nie by hierdie kontrolepunt nie."
                      : `${readyCount} van ${cp.sheets.length} werkblaaie is gereed volgens die KI. Jy kan tog afteken as jy tevrede is.`;
              return (
                <div className="cp-foot" style={{ display: "block" }}>
                  <p className="muted" style={{ margin: "0 0 10px", fontSize: ".9rem" }}>{msg}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "start" }}>
                    <AksieVorm action={decide} submit={`✓ Teken kontrolepunt ${cp.number} af`} variant="ok" confirmText={`Teken kontrolepunt ${cp.number} af as ${t.name}?${cp.status !== "SUBMITTED" ? " Die groep het nog nie self ingedien nie." : ""}`}>
                      <input type="hidden" name="groupId" value={id} />
                      <input type="hidden" name="n" value={cp.number} />
                      <input type="hidden" name="decision" value="APPROVED" />
                      <textarea name="comment" rows={2} placeholder="Opsionele kommentaar vir die groep" />
                    </AksieVorm>
                    {cp.status === "SUBMITTED" ? (
                      <AksieVorm action={decide} submit="Stuur terug na groep" variant="danger">
                        <input type="hidden" name="groupId" value={id} />
                        <input type="hidden" name="n" value={cp.number} />
                        <input type="hidden" name="decision" value="RETURNED" />
                        <textarea name="comment" rows={2} placeholder="Wat moet die groep nog aandag aan gee?" required />
                      </AksieVorm>
                    ) : null}
                  </div>
                </div>
              );
            })() : null}

            {cp.status === "APPROVED" && cp.record ? (
              <div className="cp-foot">
                <span>
                  Afgeteken deur <b>{cp.record.teacherName}</b> op {cp.record.decidedAt?.toLocaleDateString("af-ZA", { day: "numeric", month: "long", year: "numeric" })}
                  {cp.record.comment ? ` – “${cp.record.comment}”` : ""}
                </span>
                <details style={{ marginLeft: "auto" }}>
                  <summary className="muted" style={{ fontSize: ".85rem" }}>
                    Heropen
                  </summary>
                  <AksieVorm action={reopen} submit="Maak weer oop vir die groep" variant="danger" style={{ marginTop: 10, minWidth: 260 }}>
                    <input type="hidden" name="groupId" value={id} />
                    <input type="hidden" name="n" value={cp.number} />
                    <textarea name="comment" rows={2} placeholder="Hoekom? (die groep sien dit)" />
                  </AksieVorm>
                </details>
              </div>
            ) : null}

            {cp.status === "RETURNED" && cp.record?.comment ? (
              <div className="teacher-comment">
                <b>{cp.record.teacherName}:</b> {cp.record.comment}
              </div>
            ) : null}

            {history.length ? (
              <div className="cp-foot" style={{ display: "block" }}>
                <details>
                  <summary className="muted" style={{ fontSize: ".85rem" }}>
                    Geskiedenis ({history.length})
                  </summary>
                  <ul className="versions" style={{ marginTop: 8 }}>
                    {history
                      .slice()
                      .reverse()
                      .map((h, i) => (
                        <li key={i}>
                          <span className="muted">{fmtWhen(h.at)}</span>
                          <b>{h.action}</b>
                          {h.by ? <span>deur {h.by}</span> : null}
                          {h.comment ? <span className="muted">– {h.comment}</span> : null}
                        </li>
                      ))}
                  </ul>
                </details>
              </div>
            ) : null}
          </details>
        );
      })}

      {personal ? (
        <div className="cp-block" style={{ marginTop: 16 }}>
          <div className="cp-head">
            <span className="num">{personal.number}</span>
            <div>
              <div className="title">{personal.title}</div>
              <div className="sub">Elke lid vul dit self in – nie deel van ’n kontrolepunt nie.</div>
            </div>
          </div>
          {named.map((m) => {
            const key = `${personal.key}:${m.i}`;
            const r = group.responses.find((x) => x.sheet === key);
            return (
              <Link className="sheet-row" key={key} href={`/onderwyser/groep/${id}/${key}`}>
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
  );
}
