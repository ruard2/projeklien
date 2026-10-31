import Link from "next/link";
import { notFound } from "next/navigation";
import AksieVorm from "@/components/AksieVorm";
import { SheetBadge } from "@/components/Kentekens";
import { fmtWhen, Kriteria, TerugvoerInhoud } from "@/components/Terugvoer";
import PdfKriteriumRy from "@/components/PdfKriteriumRy";
import { fbAddRule, fbChatVote, fbRerun, fbSetVote } from "@/app/onderwyser/groep-ki-aksies";
import type { ChatMsg } from "@/lib/pdf-vergelyking/gesprek";
import { OORDEEL_LABEL } from "@/lib/pdf-vergelyking/status";
import WerkbladVorm, { type TeacherNotes } from "@/components/WerkbladVorm";
import { markReady, teacherNote } from "@/app/onderwyser/actions";
import { db } from "@/lib/db";
import { DiensFout, getSheetState } from "@/lib/diens";
import { dataHash } from "@/lib/hash";
import type { FeedbackResult } from "@/lib/ki";
import { requireTeacher } from "@/lib/sessie";
import { parseSheetKey } from "@/lib/werkboeke/sjablone";
import { cpStatus } from "@/lib/werkboeke/toegang";
import type { SheetData } from "@/lib/werkboeke/tipes";

const REASON: Record<string, string> = { outostoor: "Outomaties gestoor", terugvoer: "Terugvoer gevra", ingedien: "Ingedien", goedgekeur: "Goedgekeur", papier: "Ingelees uit papierwerkboek" };

export default async function OnderwyserWerkblad({
  params,
  searchParams
}: {
  params: Promise<{ id: string; sleutel: string }>;
  searchParams: Promise<{ v?: string; t?: string }>;
}) {
  const teacher = await requireTeacher();
  const { id, sleutel } = await params;
  const sp = await searchParams;
  const sheetKey = decodeURIComponent(sleutel);
  const owns = await db.group.findFirst({ where: { id, project: { schoolId: teacher.schoolId } }, select: { id: true } });
  if (!owns) notFound();

  let state;
  try {
    state = await getSheetState(id, sheetKey);
  } catch (e) {
    if (e instanceof DiensFout) notFound();
    throw e;
  }
  const { group, members, sheet, response } = state;
  const { member } = parseSheetKey(sheetKey);

  const [photos, feedbacks, versions] = await Promise.all([
    db.photo.findMany({ where: { groupId: id, sheet: sheetKey }, select: { id: true, field: true, caption: true }, orderBy: { createdAt: "asc" } }),
    db.feedback.findMany({ where: { groupId: id, sheet: sheetKey }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.responseVersion.findMany({ where: { groupId: id, sheet: sheetKey }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, reason: true, createdAt: true, revision: true } })
  ]);

  const version = sp.v ? await db.responseVersion.findFirst({ where: { id: sp.v, groupId: id, sheet: sheetKey } }) : null;
  const data = ((version ? version.data : response?.data) ?? {}) as SheetData;
  const selectedFb = (sp.t ? feedbacks.find((f) => f.id === sp.t) : null) ?? feedbacks[0] ?? null;

  const selResult = selectedFb && selectedFb.source !== "volledigheid" ? (selectedFb.result as unknown as FeedbackResult) : null;
  const [myVotes, scopeRuleRows] = selResult
    ? await Promise.all([
        db.feedbackVote.findMany({ where: { feedbackId: selectedFb!.id, teacherId: teacher.id } }),
        db.aiRule.findMany({ where: { schoolId: teacher.schoolId, templateKey: group.project.templateKey, sheet: sheet.key, active: true, deletedAt: null }, select: { criterionId: true, text: true, id: true } })
      ])
    : [[], []];
  const voteRuleTexts = new Map(scopeRuleRows.map((r) => [r.id, r.text]));
  const critRule = new Map(scopeRuleRows.filter((r) => r.criterionId).map((r) => [r.criterionId!, r.text]));

  const currentHash = dataHash((response?.data ?? {}) as SheetData);
  const ready = response?.status === "READY" && response.readyHash === currentHash;
  const cpState = sheet.checkpoint ? cpStatus(group.checkpoints.map((c) => ({ number: c.number, status: c.status })), sheet.checkpoint) : null;
  const hasNote = sheet.sections.some((s) => s.fields.some((f) => f.type === "teacherNote"));
  const notes = (response?.teacherNotes ?? {}) as TeacherNotes;
  const base = `/onderwyser/groep/${id}/${encodeURIComponent(sheetKey)}`;

  return (
    <div className="container">
      <div className="sheet-head">
        <div>
          <div className="crumb">
            <Link href={`/onderwyser/groep/${id}`}>{group.name ?? group.code}</Link>
            {sheet.checkpoint ? ` · Kontrolepunt ${sheet.checkpoint}` : ""}
          </div>
          <div className="sheet-num">{sheet.number ? `Werkblad ${sheet.number}` : "Voorblad"}</div>
          <h1 style={{ marginBottom: 6 }}>
            {sheet.title}
            {member ? ` – ${members[member - 1] || `Lid ${member}`}` : ""}
          </h1>
        </div>
        <div className="right">
          <SheetBadge status={response?.status ?? "NOT_STARTED"} ready={ready} />
          {ready && response?.readyBy && response.readyBy !== "KI" ? <small>Gereed verklaar deur {response.readyBy}</small> : null}
        </div>
      </div>

      <div className="editor">
        <div>
          {version ? (
            <div className="lockbar wait">
              <span>
                Jy kyk na ’n vorige weergawe: <b>{REASON[version.reason] ?? version.reason}</b>, {fmtWhen(version.createdAt.toISOString())}.
              </span>
              <Link className="btn sm" href={base} style={{ marginLeft: "auto" }}>
                Wys huidige
              </Link>
            </div>
          ) : null}
          {(notes as Record<string, { text?: string }>)._papier?.text ? (
            <div className="card" style={{ borderLeft: "4px solid #c0392b", marginBottom: 14 }}>
              <h3 style={{ marginTop: 0 }}>✍️ Papierkommentaar (soos die groep dit sien)</h3>
              <div style={{ whiteSpace: "pre-wrap" }}>{(notes as Record<string, { text?: string }>)._papier?.text}</div>
            </div>
          ) : null}
          <WerkbladVorm sheet={sheet} sheetKey={sheetKey} data={data} readOnly members={members} photos={photos} teacherNotes={notes} />
          {selResult?.kriteria?.length ? (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Klop die KI se oordeel?</h3>
              <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
                Gee 👍 of 👎 per kriterium{feedbacks.length > 1 ? " (vir die terugvoer wat regs gekies is)" : ""}. By 👎 verduidelik jy kort wat jy wou sien; die KI stel ’n reël voor wat dadelik vir alle groepe geld as jy dit byvoeg.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="pv-crit">
                  <thead><tr><th>Kriterium</th><th>KI</th><th>Terugvoer</th><th>Klop dit?</th></tr></thead>
                  <tbody>
                    {selResult.kriteria.map((k) => {
                      const crit = sheet.criteria.find((c) => c.id === k.id);
                      const v = myVotes.find((x) => x.criterionId === k.id);
                      return (
                        <PdfKriteriumRy
                          key={`${selectedFb!.id}-${k.id}`}
                          id={selectedFb!.id}
                          sheet={sheet.key}
                          criterionId={k.id}
                          title={crit?.title ?? k.id}
                          verdict={OORDEEL_LABEL[k.oordeel] ?? { text: k.oordeel, cls: "plain" }}
                          feedback={k.terugvoer}
                          vote={v?.vote ?? null}
                          chat={(v?.chat as ChatMsg[] | null) ?? []}
                          ruleText={v?.ruleId ? voteRuleTexts.get(v.ruleId) ?? null : null}
                          existingRule={critRule.get(k.id) ?? null}
                          actions={{ setVote: fbSetVote, chatVote: fbChatVote, addRule: fbAddRule, rerun: fbRerun }}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="side">
          {sheet.checkpoint && !ready && cpState !== "APPROVED" && response ? (
            <div className="panel">
              <div className="ph">
                <h3>Onderwyser se besluit</h3>
              </div>
              <div className="pb">
                <p className="muted" style={{ fontSize: ".88rem" }}>
                  Die KI kan foute maak. As jy oortuig is dat die werk aan die kriteria voldoen, kan jy dit self gereed verklaar.
                </p>
                <AksieVorm action={markReady} submit="Verklaar gereed" variant="plain" confirmText="Verklaar hierdie werkblad gereed vir die kontrolepunt?">
                  <input type="hidden" name="groupId" value={id} />
                  <input type="hidden" name="sheet" value={sheetKey} />
                </AksieVorm>
              </div>
            </div>
          ) : null}

          {hasNote ? (
            <div className="panel">
              <div className="ph">
                <h3>Onderwyser se kommentaar</h3>
              </div>
              <div className="pb">
                {sheet.sections
                  .flatMap((s) => s.fields)
                  .filter((f) => f.type === "teacherNote")
                  .map((f) => (
                    <AksieVorm key={f.key} action={teacherNote} submit="Stoor kommentaar">
                      <input type="hidden" name="groupId" value={id} />
                      <input type="hidden" name="sheet" value={sheetKey} />
                      <input type="hidden" name="field" value={f.key} />
                      <textarea name="text" rows={4} defaultValue={notes[f.key]?.text ?? ""} placeholder="Jou kommentaar oor die veiligheidsplan" />
                    </AksieVorm>
                  ))}
              </div>
            </div>
          ) : null}

          <div className="panel">
            <div className="ph">
              <h3>KI-terugvoer</h3>
              <small style={{ marginLeft: "auto" }}>{feedbacks.length}× gevra</small>
            </div>
            <div className="pb">
              {selectedFb ? (
                <TerugvoerInhoud
                  fb={{
                    id: selectedFb.id,
                    result: selectedFb.result as unknown as FeedbackResult,
                    ready: selectedFb.ready,
                    source: selectedFb.source,
                    createdAt: selectedFb.createdAt.toISOString(),
                    stale: selectedFb.revision !== response?.revision
                  }}
                  criteria={sheet.criteria}
                />
              ) : sheet.feedback ? (
                <>
                  <p className="muted" style={{ fontSize: ".9rem" }}>
                    Die groep het nog nie terugvoer gevra nie. Kriteria:
                  </p>
                  <Kriteria criteria={sheet.criteria} />
                </>
              ) : (
                <p className="muted">Geen terugvoer vir hierdie bladsy nie.</p>
              )}
              {feedbacks.length > 1 ? (
                <details style={{ marginTop: 14 }}>
                  <summary className="muted" style={{ fontSize: ".88rem" }}>
                    Vorige terugvoer
                  </summary>
                  <ul className="versions" style={{ marginTop: 6 }}>
                    {feedbacks.map((f) => (
                      <li key={f.id}>
                        <span className={`badge ${f.ready ? "ok" : "warn"}`} style={{ padding: "1px 8px" }}>
                          {f.ready ? "gereed" : "nie"}
                        </span>
                        <Link className={f.id === selectedFb?.id ? "on" : ""} href={`${base}?t=${f.id}${sp.v ? `&v=${sp.v}` : ""}`}>
                          {fmtWhen(f.createdAt.toISOString())}
                        </Link>
                        <span className="muted">{f.source === "volledigheid" ? "onvolledig" : ""}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <h3>Weergawegeskiedenis</h3>
            </div>
            <div className="pb">
              {versions.length ? (
                <ul className="versions">
                  {versions.map((v) => (
                    <li key={v.id}>
                      <Link className={v.id === sp.v ? "on" : ""} href={`${base}?v=${v.id}`}>
                        {fmtWhen(v.createdAt.toISOString())}
                      </Link>
                      <span className="muted">{REASON[v.reason] ?? v.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nog geen weergawes nie.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
