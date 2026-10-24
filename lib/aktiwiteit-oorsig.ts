// Bou een tydlyn van alles wat onderwysers gedoen het: die ouditlog, KI-reëlhandelinge,
// en (vir die tyd vóór die ouditlog bestaan het) wat uit bestaande data herlei kan word.

import { db } from "./db";
import { getTemplate } from "./werkboeke/sjablone";

export type Item = {
  key: string;
  at: Date;
  teacherId: string | null;
  teacherName: string;
  type: string;
  summary: string;
  link?: string | null;
  details?: unknown;
  rule?: { eventId: string; ruleId: string; action: string; oldText: string | null; newText: string | null; reviewed: boolean; reviewedByName: string | null; current: string; active: boolean; deleted: boolean; scope: string };
  herlei?: boolean;
};

type HistoryEntry = { action?: string; by?: string; comment?: string; at?: string };

export async function buildTimeline(schoolId: string, opts: { teacherId?: string; since?: Date; type?: string }) {
  const teachers = await db.teacher.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
  const teacher = opts.teacherId ? teachers.find((t) => t.id === opts.teacherId) : undefined;
  const since = opts.since ?? new Date(0);
  const firstLog = await db.teacherActivity.findFirst({ where: { schoolId }, orderBy: { at: "asc" }, select: { at: true } });
  const logStart = firstLog?.at ?? new Date();
  const items: Item[] = [];
  const want = (type: string) => !opts.type || opts.type === type;

  if (want("reel") || !opts.type) {
    const events = await db.aiRuleEvent.findMany({
      where: { schoolId, at: { gte: since }, ...(teacher ? { byId: teacher.id } : {}) },
      orderBy: { at: "desc" },
      take: 500,
      include: { rule: true }
    });
    for (const e of events) {
      if (!want("reel")) break;
      const tpl = safeTemplate(e.rule.templateKey);
      const s = e.rule.sheet ? tpl?.sheets.find((x) => x.key === e.rule.sheet) : null;
      const c = e.rule.criterionId ? s?.criteria.find((x) => x.id === e.rule.criterionId) : null;
      const scope = e.rule.templateKey === "*" ? "Alle werkboeke (gees)" : `${tpl?.label ?? e.rule.templateKey} · ${s ? `WB${s.number}${c ? ` · ${c.title}` : ""}` : "hele werkboek"}`;
      items.push({
        key: `r-${e.id}`,
        at: e.at,
        teacherId: e.byId,
        teacherName: e.byName,
        type: "reel",
        summary: `KI-reël ${e.action}`,
        link: `/onderwyser/ki-reels?werkboek=${encodeURIComponent(e.rule.templateKey)}`,
        details: e.note ? { note: e.note } : undefined,
        rule: { eventId: e.id, ruleId: e.ruleId, action: e.action, oldText: e.oldText, newText: e.newText, reviewed: Boolean(e.reviewedAt), reviewedByName: e.reviewedByName, current: e.rule.text, active: e.rule.active, deleted: Boolean(e.rule.deletedAt), scope }
      });
    }
  }

  if (opts.type !== "reel") {
    const acts = await db.teacherActivity.findMany({
      where: { schoolId, at: { gte: since }, ...(teacher ? { teacherId: teacher.id } : {}), ...(opts.type ? { type: opts.type } : {}) },
      orderBy: { at: "desc" },
      take: 1000
    });
    for (const a of acts) items.push({ key: `a-${a.id}`, at: a.at, teacherId: a.teacherId, teacherName: a.teacherName, type: a.type, summary: a.summary, link: a.link, details: a.details ?? undefined });

    // ---- Herlei uit bestaande data vir die tyd vóór die ouditlog
    if (since < logStart) {
      const before = { gte: since, lt: logStart };
      if (want("pdf")) {
        const pdfs = await db.pdfComparison.findMany({ where: { schoolId, createdAt: before, ...(teacher ? { teacherId: teacher.id } : {}) }, select: { id: true, createdAt: true, teacherId: true, teacherName: true, fileName: true, model: true } });
        for (const p of pdfs) items.push({ key: `hp-${p.id}`, at: p.createdAt, teacherId: p.teacherId, teacherName: p.teacherName, type: "pdf", summary: `${p.model?.startsWith("handmatig") ? "Werkboek ingevoer" : "PDF opgelaai"}: ${p.fileName}`, link: `/onderwyser/pdf-vergelyking/${p.id}`, herlei: true });
      }
      if (want("duim")) {
        const votes = await db.pdfVote.findMany({ where: { updatedAt: before, comparison: { schoolId }, ...(teacher ? { teacherId: teacher.id } : {}) }, include: { comparison: { select: { fileName: true } } } });
        for (const v of votes) {
          const t = teachers.find((x) => x.id === v.teacherId);
          items.push({ key: `hv-${v.id}`, at: v.updatedAt, teacherId: v.teacherId, teacherName: t?.name ?? "?", type: "duim", summary: `${v.vote === 1 ? "👍" : "👎"} by werkblad ${v.sheet}, kriterium ${v.criterionId} · ${v.comparison.fileName}${v.reason ? ` – “${v.reason.slice(0, 200)}”` : ""}`, link: `/onderwyser/pdf-vergelyking/${v.comparisonId}`, details: v.chat ? { kind: "gesprekslog", chat: v.chat } : undefined, herlei: true });
        }
      }
      if (want("kontrolepunt") || want("kommentaar")) {
        const groups = await db.group.findMany({ where: { project: { schoolId } }, select: { id: true, name: true, klas: true, code: true, checkpoints: true, responses: { select: { sheet: true, teacherNotes: true } } } });
        for (const g of groups) {
          const label = [g.name, g.klas ? `klas ${g.klas}` : null, g.code].filter(Boolean).join(" · ");
          if (want("kontrolepunt")) {
            for (const cp of g.checkpoints) {
              const hist = (Array.isArray(cp.history) ? cp.history : []) as unknown as HistoryEntry[];
              hist.forEach((h, i) => {
                if (!h.by || !h.at) return;
                const at = new Date(h.at);
                if (!(at >= since && at < logStart)) return;
                const t = teachers.find((x) => x.name === h.by);
                if (teacher && t?.id !== teacher.id) return;
                items.push({ key: `hc-${cp.id}-${i}`, at, teacherId: t?.id ?? null, teacherName: h.by, type: "kontrolepunt", summary: `${h.action ?? "?"}: kontrolepunt ${cp.number} · ${label}${h.comment ? ` – “${h.comment}”` : ""}`, link: `/onderwyser/groep/${g.id}#kp${cp.number}`, herlei: true });
              });
            }
          }
          if (want("kommentaar")) {
            for (const r of g.responses) {
              const notes = (r.teacherNotes ?? {}) as Record<string, { text?: string; by?: string; at?: string }>;
              for (const [field, n] of Object.entries(notes)) {
                if (!n?.by || !n.at) continue;
                const at = new Date(n.at);
                if (!(at >= since && at < logStart)) continue;
                const t = teachers.find((x) => x.name === n.by);
                if (teacher && t?.id !== teacher.id) continue;
                items.push({ key: `hn-${g.id}-${r.sheet}-${field}`, at, teacherId: t?.id ?? null, teacherName: n.by, type: "kommentaar", summary: `Kommentaar op werkblad ${r.sheet} · ${label}: “${(n.text ?? "").slice(0, 300)}”`, link: `/onderwyser/groep/${g.id}/${encodeURIComponent(r.sheet)}`, herlei: true });
              }
            }
          }
        }
      }
    }
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return { items, teachers, logStart };
}

function safeTemplate(key: string) {
  try {
    return getTemplate(key);
  } catch {
    return null;
  }
}

/** Per onderwyser: laaste aanmelding, handelinge, reëlveranderinge en hoeveel nog nagegaan moet word. */
export async function teacherSummaries(schoolId: string, since: Date) {
  const [teachers, acts, ruleEvents, open] = await Promise.all([
    db.teacher.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    db.teacherActivity.groupBy({ by: ["teacherId"], where: { schoolId, at: { gte: since } }, _count: { _all: true }, _max: { at: true } }),
    db.aiRuleEvent.groupBy({ by: ["byId"], where: { schoolId, at: { gte: since } }, _count: { _all: true } }),
    db.aiRuleEvent.groupBy({ by: ["byId"], where: { schoolId, reviewedAt: null }, _count: { _all: true } })
  ]);
  return teachers.map((t) => ({
    id: t.id,
    name: t.name,
    role: t.role,
    active: t.active,
    lastLoginAt: t.lastLoginAt,
    actions: acts.find((a) => a.teacherId === t.id)?._count._all ?? 0,
    lastAction: acts.find((a) => a.teacherId === t.id)?._max.at ?? null,
    ruleChanges: ruleEvents.find((r) => r.byId === t.id)?._count._all ?? 0,
    unreviewed: open.find((r) => r.byId === t.id)?._count._all ?? 0
  }));
}
