import Link from "next/link";
import { markAllRuleEventsReviewed, markRuleEventReviewed, rejectRuleEvent } from "@/app/onderwyser/oudit-aksies";
import { ACTIVITY_LABEL } from "@/lib/aktiwiteit";
import { buildTimeline, teacherSummaries, type Item } from "@/lib/aktiwiteit-oorsig";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ChatMsg } from "@/lib/pdf-vergelyking/gesprek";
import { requireAdmin } from "@/lib/sessie";
import { getTemplate } from "@/lib/werkboeke/sjablone";
import { sheetToText } from "@/lib/werkboeke/teks";
import type { SheetData } from "@/lib/werkboeke/tipes";

export const metadata = { title: "Aktiwiteit" };

const PERIODS: Record<string, { label: string; days: number | null }> = {
  "7": { label: "7 dae", days: 7 },
  "30": { label: "30 dae", days: 30 },
  "90": { label: "90 dae", days: 90 },
  alles: { label: "Alles", days: null }
};

const fmt = (d: Date) => d.toLocaleString("af-ZA", { dateStyle: "medium", timeStyle: "short" });

function qs(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return `/onderwyser/aktiwiteit${s ? `?${s}` : ""}`;
}

export default async function Aktiwiteit({ searchParams }: { searchParams: Promise<{ wie?: string; tipe?: string; tyd?: string }> }) {
  const a = await requireAdmin();
  const sp = await searchParams;
  const period = PERIODS[sp.tyd ?? "30"] ?? PERIODS["30"];
  const since = period.days ? new Date(Date.now() - period.days * 86400_000) : undefined;
  const base = { wie: sp.wie, tipe: sp.tipe, tyd: sp.tyd };

  const pendingChats = await db.pdfVote.findMany({
    where: { vote: -1, ruleId: null, NOT: { chat: { equals: Prisma.DbNull } }, comparison: { schoolId: a.schoolId }, ...(sp.wie ? { teacherId: sp.wie } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { comparison: { select: { fileName: true, templateKey: true } } }
  });
  const [summaries, { items, teachers, logStart }, openEvents] = await Promise.all([
    teacherSummaries(a.schoolId, since ?? new Date(0)),
    buildTimeline(a.schoolId, { teacherId: sp.wie, since, type: sp.tipe }),
    db.aiRuleEvent.findMany({ where: { schoolId: a.schoolId, reviewedAt: null, ...(sp.wie ? { byId: sp.wie } : {}) }, orderBy: { at: "desc" }, include: { rule: true }, take: 100 })
  ]);
  const who = teachers.find((t) => t.id === sp.wie);
  const types = ["reel", "kontrolepunt", "kommentaar", "gereed", "pdf", "duim", "groepe", "terugvoer", "bestuur", "rekening", "aanmeld", "ontwikkelaar"];

  return (
    <div className="container">
      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <h1 className="grow" style={{ margin: 0 }}>Aktiwiteit{who ? `: ${who.name}` : ""}</h1>
        <a className="btn sm" href="/api/oudit/uitvoer" download>⬇ Laai alles af (JSON)</a>
      </div>
      <p className="muted" style={{ maxWidth: "85ch" }}>
        Alles wat onderwysers in die program doen, met <b>KI-reëlveranderinge</b> apart om na te gaan. Reëls geld dadelik; hier kan jy elke verandering goedkeur (“Nagegaan”) of afkeur (word teruggedraai). Volledige aantekening loop sedert {fmt(logStart)}; vroeër items is uit bestaande data herlei (gemerk “herlei”).
      </p>

      {/* ---------------- Oorsig per onderwyser */}
      <div className="card" style={{ overflowX: "auto" }}>
        <h2>Onderwysers ({period.label})</h2>
        <table className="dtable">
          <thead><tr><th>Naam</th><th>Laaste aanmelding</th><th>Handelinge</th><th>Reëlveranderinge</th><th>Nog na te gaan</th><th /></tr></thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.id} style={sp.wie === s.id ? { background: "var(--blue-soft)" } : undefined}>
                <td><b>{s.name}</b>{!s.active ? <span className="badge plain" style={{ marginLeft: 6 }}>onaktief</span> : null}<div className="muted" style={{ fontSize: ".8rem" }}>{s.role}</div></td>
                <td className="muted">{s.lastLoginAt ? fmt(s.lastLoginAt) : "—"}</td>
                <td>{s.actions}</td>
                <td>{s.ruleChanges}</td>
                <td>{s.unreviewed ? <span className="badge red">{s.unreviewed}</span> : <span className="muted">0</span>}</td>
                <td><Link className="btn sm" href={qs(base, { wie: s.id })}>Wys</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {sp.wie ? <p style={{ marginBottom: 0 }}><Link href={qs(base, { wie: undefined })}>← Alle onderwysers</Link></p> : null}
      </div>

      {/* ---------------- Reëlveranderinge om na te gaan */}
      <div className="card" style={openEvents.length ? { borderLeft: "4px solid var(--red)" } : undefined}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <h2 className="grow" style={{ margin: 0 }}>KI-reëlveranderinge om na te gaan ({openEvents.length})</h2>
          {openEvents.length ? (
            <form action={markAllRuleEventsReviewed}>
              <input type="hidden" name="teacherId" value={sp.wie ?? ""} />
              <button className="btn sm">✓ Merk almal as nagegaan</button>
            </form>
          ) : null}
        </div>
        {openEvents.length === 0 ? <p className="muted" style={{ marginBottom: 0 }}>Alles is nagegaan. 👍</p> : (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {openEvents.map((e) => {
              const tpl = e.rule.templateKey === "*" ? { label: "Alle werkboeke (gees)", sheets: [] as ReturnType<typeof getTemplate>["sheets"] } : getTemplate(e.rule.templateKey);
              const s = e.rule.sheet ? tpl.sheets.find((x) => x.key === e.rule.sheet) : null;
              const c = e.rule.criterionId ? s?.criteria.find((x) => x.id === e.rule.criterionId) : null;
              return (
                <div key={e.id} className="pv-box" style={{ borderLeft: "4px solid var(--warn)" }}>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="badge warn">{e.action}</span>
                    <b>{e.byName}</b>
                    <span className="muted">{fmt(e.at)}</span>
                    <span className="grow" />
                    <span className="badge plain blue">{tpl.label} · {s ? `WB${s.number}${c ? ` · ${c.title}` : ""}` : "hele werkboek"}</span>
                  </div>
                  <RuleDiff action={e.action} oldText={e.oldText} newText={e.newText} current={e.rule.text} />
                  {e.note ? <p className="muted" style={{ margin: "6px 0 0", fontSize: ".88rem" }}>{e.note}</p> : null}
                  <p className="muted" style={{ margin: "6px 0 0", fontSize: ".85rem" }}>
                    Nou: {e.rule.deletedAt ? "geskrap" : e.rule.active ? "aktief" : "af"}
                  </p>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <form action={markRuleEventReviewed}><input type="hidden" name="eventId" value={e.id} /><button className="btn sm ok">✓ Nagegaan – goed so</button></form>
                    <form action={rejectRuleEvent}><input type="hidden" name="eventId" value={e.id} /><button className="btn sm danger">✗ Afkeur – {rejectLabel(e.action)}</button></form>
                    <Link className="btn sm ghost" href={`/onderwyser/ki-reels?werkboek=${encodeURIComponent(e.rule.templateKey)}`}>Na reëls</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------- Gesprekke wat nog nie ’n reël geword het nie */}
      {pendingChats.length ? (
        <details className="pv-acc" style={{ margin: "18px 0", borderLeft: "4px solid var(--warn)" }}>
          <summary><span className="t">💬 Gesprekke ná 👎 sonder reël ({pendingChats.length}) – die KI onthou dit nie</span></summary>
          <div className="body" style={{ display: "grid", gap: 10 }}>
            <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>Hier het ’n onderwyser met die KI gepraat, maar nie op “Voeg reël by” gedruk nie. Die KI se gedrag het dus nie verander nie.</p>
            {pendingChats.map((v) => {
              const chat = (v.chat as ChatMsg[] | null) ?? [];
              const proposal = [...chat].reverse().find((m) => m.van === "ki" && m.reel)?.reel;
              let where = `${v.sheet} · ${v.criterionId}`;
              try {
                const s2 = getTemplate(v.comparison.templateKey).sheets.find((x) => x.key === v.sheet);
                const c2 = s2?.criteria.find((x) => x.id === v.criterionId);
                where = `WB${s2?.number} · ${c2?.title ?? v.criterionId}`;
              } catch {}
              return (
                <div key={v.id} className="pv-box">
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <b>{teachers.find((x) => x.id === v.teacherId)?.name ?? "?"}</b>
                    <span className="badge plain blue">{where}</span>
                    <span className="muted">{fmt(v.updatedAt)}</span>
                  </div>
                  {v.reason ? <p style={{ margin: "6px 0 0" }}>“{v.reason}”</p> : null}
                  {proposal ? <p className="muted" style={{ margin: "6px 0 0", fontSize: ".9rem" }}>Laaste voorstel van die KI: {proposal}</p> : null}
                  <Link className="btn sm" style={{ marginTop: 8 }} href={`/onderwyser/pdf-vergelyking/${v.comparisonId}`}>Open en voeg reël by</Link>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      {/* ---------------- Tydlyn */}
      <div className="card">
        <h2>Tydlyn{who ? ` van ${who.name}` : ""} ({items.length})</h2>
        <div className="tabs" style={{ marginBottom: 8 }}>
          {Object.entries(PERIODS).map(([k, v]) => <Link key={k} href={qs(base, { tyd: k })} className={(sp.tyd ?? "30") === k ? "on" : ""}>{v.label}</Link>)}
        </div>
        <div className="tabs" style={{ marginBottom: 14 }}>
          <Link href={qs(base, { tipe: undefined })} className={!sp.tipe ? "on" : ""}>Alles</Link>
          {types.map((t) => <Link key={t} href={qs(base, { tipe: t })} className={sp.tipe === t ? "on" : ""}>{ACTIVITY_LABEL[t] ?? t}</Link>)}
        </div>
        {items.length === 0 ? <p className="muted">Niks in hierdie tydperk nie.</p> : (
          <ul className="versions">
            {items.slice(0, 600).map((it) => <TimelineRow key={it.key} it={it} showWho={!who} />)}
          </ul>
        )}
        {items.length > 600 ? <p className="muted">Net die nuutste 600 word gewys; kies ’n korter tydperk of ’n tipe.</p> : null}
      </div>
    </div>
  );
}

function rejectLabel(action: string) {
  if (action === "gewysig" || action === "teruggedraai") return "draai terug";
  if (action === "geskrap") return "herstel";
  if (action === "afgeskakel") return "skakel weer aan";
  return "skakel af";
}

function RuleDiff({ action, oldText, newText, current }: { action: string; oldText: string | null; newText: string | null; current: string }) {
  if ((action === "gewysig" || action === "teruggedraai") && oldText) {
    return (
      <div style={{ marginTop: 8, fontSize: ".92rem" }}>
        <div className="muted"><s>{oldText}</s></div>
        <div>→ {newText}</div>
      </div>
    );
  }
  return <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{newText ?? oldText ?? current}</p>;
}

function TimelineRow({ it, showWho }: { it: Item; showWho: boolean }) {
  const d = (it.details ?? null) as Record<string, unknown> | null;
  return (
    <li style={{ display: "block", padding: "10px 0" }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <span className="muted" style={{ whiteSpace: "nowrap" }}>{fmt(it.at)}</span>
        {showWho ? <b>{it.teacherName}</b> : null}
        <span className={`badge ${it.type === "reel" ? (it.rule?.reviewed ? "ok" : "red") : "plain"}`}>{ACTIVITY_LABEL[it.type] ?? it.type}</span>
        {it.herlei ? <span className="badge plain">herlei</span> : null}
      </div>
      <div style={{ marginTop: 4 }}>
        {it.rule ? (
          <>
            <b>{it.rule.action}</b> · <span className="muted">{it.rule.scope}</span>
            <RuleDiff action={it.rule.action} oldText={it.rule.oldText} newText={it.rule.newText} current={it.rule.current} />
            <div className="muted" style={{ fontSize: ".82rem" }}>{it.rule.reviewed ? `Nagegaan deur ${it.rule.reviewedByName}` : "Nog nie nagegaan nie"}</div>
          </>
        ) : it.summary}
        {it.link ? <> · <Link href={it.link}>open</Link></> : null}
      </div>
      {d?.note ? <div className="muted" style={{ fontSize: ".85rem" }}>{String(d.note)}</div> : null}
      {d?.kind === "wysig" ? <EditDiff d={d} /> : null}
      {d?.kind === "gesprek" ? (
        <details style={{ marginTop: 4 }}>
          <summary className="muted" style={{ fontSize: ".85rem" }}>Gesprek</summary>
          <div className="pv-msgs" style={{ marginTop: 6 }}>
            <div className="pv-msg juf"><small>{it.teacherName}</small><div>{String(d.juf ?? "")}</div></div>
            <div className="pv-msg ki"><small>KI</small><div>{String(d.ki ?? "")}{d.reel ? `\n\nVoorgestelde reël: ${String(d.reel)}` : ""}</div></div>
          </div>
        </details>
      ) : null}
      {d?.kind === "gesprekslog" && Array.isArray(d.chat) ? (
        <details style={{ marginTop: 4 }}>
          <summary className="muted" style={{ fontSize: ".85rem" }}>Gesprek ({d.chat.length})</summary>
          <div className="pv-msgs" style={{ marginTop: 6 }}>
            {(d.chat as { van: string; teks: string }[]).map((m, i) => <div key={i} className={`pv-msg ${m.van}`}><small>{m.van === "juf" ? it.teacherName : "KI"}</small><div>{m.teks}</div></div>)}
          </div>
        </details>
      ) : null}
    </li>
  );
}

function EditDiff({ d }: { d: Record<string, unknown> }) {
  let before = "";
  let after = "";
  try {
    const sheet = getTemplate(String(d.templateKey)).sheets.find((s) => s.key === d.sheet);
    const b = d.before as { data: SheetData; juf?: { kommentaar?: string[] } };
    const a = d.after as { data: SheetData; juf?: { kommentaar?: string[] } };
    if (sheet) {
      before = sheetToText(sheet, b.data, { members: [], anonymise: false }) + (b.juf?.kommentaar?.length ? `\n\nJUF: ${b.juf.kommentaar.join(" | ")}` : "");
      after = sheetToText(sheet, a.data, { members: [], anonymise: false }) + (a.juf?.kommentaar?.length ? `\n\nJUF: ${a.juf.kommentaar.join(" | ")}` : "");
    }
  } catch {
    return null;
  }
  return (
    <details style={{ marginTop: 4 }}>
      <summary className="muted" style={{ fontSize: ".85rem" }}>Wat is verander (voor → ná)</summary>
      <div className="pv-cols" style={{ marginTop: 6 }}>
        <div className="pv-box"><h4>Voor</h4><pre className="pv-pre" style={{ fontFamily: "inherit" }}>{before}</pre></div>
        <div className="pv-box"><h4>Ná</h4><pre className="pv-pre" style={{ fontFamily: "inherit" }}>{after}</pre></div>
      </div>
    </details>
  );
}
