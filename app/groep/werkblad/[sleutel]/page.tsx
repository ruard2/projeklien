import Link from "next/link";
import { notFound } from "next/navigation";
import type { FeedbackView } from "@/components/Terugvoer";
import WerkbladRedigeerder from "@/components/WerkbladRedigeerder";
import type { TeacherNotes } from "@/components/WerkbladVorm";
import { db } from "@/lib/db";
import { DiensFout, getSheetState, sheetStatesFor, cpStates } from "@/lib/diens";
import { dataHash } from "@/lib/hash";
import type { FeedbackResult } from "@/lib/ki";
import { requireGroup } from "@/lib/sessie";
import { parseSheetKey } from "@/lib/werkboeke/sjablone";
import { canSubmit, cpStatus } from "@/lib/werkboeke/toegang";
import type { SheetData } from "@/lib/werkboeke/tipes";

export default async function WerkbladBladsy({ params }: { params: Promise<{ sleutel: string }> }) {
  const g = await requireGroup();
  const sheetKey = decodeURIComponent((await params).sleutel);

  let state;
  try {
    state = await getSheetState(g.id, sheetKey);
  } catch (e) {
    if (e instanceof DiensFout) notFound();
    throw e;
  }
  const { group, template: t, members, sheet, access, response } = state;
  const { member } = parseSheetKey(sheetKey);

  // Navigasie (vorige / volgende werkblad)
  const order = t.sheets.filter((s) => !s.perMember);
  const idx = order.findIndex((s) => s.key === sheet.key);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  if (!access.unlocked) {
    return (
      <div className="container narrow">
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="sheet-num">Werkblad {sheet.number}</div>
          <h1>{sheet.title}</h1>
          <p className="muted">{access.reason}</p>
          <Link className="btn" href="/groep">
            ← Terug na die werkboek
          </Link>
        </div>
      </div>
    );
  }

  const [photos, feedback, feedbackCount] = await Promise.all([
    db.photo.findMany({ where: { groupId: g.id, sheet: sheetKey }, select: { id: true, field: true, caption: true }, orderBy: { createdAt: "asc" } }),
    db.feedback.findFirst({ where: { groupId: g.id, sheet: sheetKey }, orderBy: { createdAt: "desc" } }),
    db.feedback.count({ where: { groupId: g.id, sheet: sheetKey } })
  ]);

  const report = feedback
    ? await db.aiReport.findFirst({ where: { groupId: g.id, sheet: sheetKey, feedbackId: feedback.id }, orderBy: { createdAt: "desc" }, select: { status: true, resolution: true } })
    : null;
  const data = (response?.data ?? {}) as SheetData;
  const currentHash = dataHash(data);
  const fbView: FeedbackView | null = feedback
    ? {
        id: feedback.id,
        result: feedback.result as unknown as FeedbackResult,
        ready: feedback.ready,
        source: feedback.source,
        createdAt: feedback.createdAt.toISOString(),
        stale: feedback.revision !== response?.revision,
        report
      }
    : null;

  let checkpoint = null;
  if (sheet.checkpoint) {
    const def = t.checkpoints.find((c) => c.number === sheet.checkpoint)!;
    const rec = group.checkpoints.find((c) => c.number === def.number) ?? null;
    const check = canSubmit(t, def.number, cpStates(group.checkpoints), sheetStatesFor(t, group.responses));
    checkpoint = {
      number: def.number,
      statement: def.statement,
      status: cpStatus(cpStates(group.checkpoints), def.number),
      canSubmit: check.ok,
      reason: check.reason,
      comment: rec?.comment ?? null,
      teacherName: rec?.teacherName ?? null,
      decidedAt: rec?.decidedAt?.toISOString() ?? null
    };
  }

  const status = response?.status === "READY" && response.readyHash !== currentHash ? "NOT_READY" : (response?.status ?? "NOT_STARTED");

  return (
    <div className="container">
      <div className="sheet-head">
        <div>
          <div className="crumb">
            <Link href="/groep">Werkboek</Link>
            {sheet.checkpoint ? ` · Kontrolepunt ${sheet.checkpoint}` : ""}
          </div>
          <div className="sheet-num">{sheet.number ? `Werkblad ${sheet.number}` : "Voorblad"}</div>
          <h1 style={{ marginBottom: 6 }}>
            {sheet.title}
            {member ? ` – ${members[member - 1]?.trim() || `Lid ${member}`}` : ""}
          </h1>
          {sheet.intro ? <p className="muted" style={{ maxWidth: "70ch", margin: 0 }}>{sheet.intro}</p> : null}
        </div>
        <div className="right no-print">
          <div className="btn-row">
            {prev ? (
              <Link className="btn sm" href={`/groep/werkblad/${prev.key}`}>
                ← {prev.number ? `Werkblad ${prev.number}` : "Voorblad"}
              </Link>
            ) : null}
            {next ? (
              <Link className="btn sm" href={`/groep/werkblad/${next.key}`}>
                Werkblad {next.number} →
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <WerkbladRedigeerder
        key={sheetKey}
        sheet={sheet}
        sheetKey={sheetKey}
        initialData={data}
        initialRevision={response?.revision ?? 0}
        initialStatus={status}
        readyBy={response?.readyBy ?? null}
        editable={access.editable}
        lockReason={access.reason}
        members={members}
        photos={photos}
        teacherNotes={(response?.teacherNotes ?? {}) as TeacherNotes}
        feedback={fbView}
        feedbackCount={feedbackCount}
        checkpoint={checkpoint}
      />
    </div>
  );
}
