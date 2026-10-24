import Link from "next/link";
import { createRule, deleteRule, restoreRule, revertRule, toggleRule, updateRule } from "@/app/onderwyser/reel-aksies";
import ReelInvoer from "@/components/ReelInvoer";
import { db } from "@/lib/db";
import { ALL_WORKBOOKS } from "@/lib/ki-reels";
import { isAdminRole, requireTeacher } from "@/lib/sessie";
import { getTemplate, listTemplates } from "@/lib/werkboeke/sjablone";

export const metadata = { title: "KI-reëls" };

export default async function KiReels({ searchParams }: { searchParams: Promise<{ werkboek?: string }> }) {
  const t = await requireTeacher();
  const sp = await searchParams;
  const templates = listTemplates();
  const isGlobal = sp.werkboek === ALL_WORKBOOKS;
  const current = isGlobal ? { key: ALL_WORKBOOKS, label: "Alle werkboeke (algemene gees)" } : templates.find((x) => x.key === sp.werkboek) ?? templates[templates.length - 1];
  const admin = isAdminRole(t.role);
  const all = await db.aiRule.findMany({
    where: { schoolId: t.schoolId, templateKey: current.key },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: { events: { orderBy: { at: "desc" } } }
  });
  const rules = all.filter((r) => !r.deletedAt);
  const deleted = all.filter((r) => r.deletedAt && (admin || r.createdById === t.id));
  const recent = admin ? await db.aiRuleEvent.findMany({ where: { schoolId: t.schoolId }, orderBy: { at: "desc" }, take: 60, include: { rule: { select: { templateKey: true, text: true } } } }) : [];
  const tpl = isGlobal ? null : getTemplate(current.key);
  const scopeLabel = (sheetKey: string | null, criterionId: string | null) => {
    if (isGlobal) return "Alle werkboeke";
    if (!sheetKey || !tpl) return "Hele werkboek";
    const s = tpl.sheets.find((x) => x.key === sheetKey);
    const c = criterionId ? s?.criteria.find((x) => x.id === criterionId) : null;
    return `WB${s?.number ?? "?"}${c ? ` · ${c.title}` : " · hele werkblad"}`;
  };
  const scopes = tpl ? tpl.sheets.filter((s) => s.feedback && !s.perMember) : [];

  return (
    <div className="container">
      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <h1 className="grow" style={{ margin: 0 }}>KI-reëls</h1>
        {isAdminRole(t.role) ? <a className="btn sm" href="/api/oudit/uitvoer" download>⬇ Laai alles af (JSON)</a> : null}
      </div>
      <p className="muted" style={{ maxWidth: "80ch" }}>
        Reëls wat onderwysers by die KI-terugvoer gevoeg het, meestal uit ’n gesprek ná ’n 👎 by die PDF-vergelyking. Aktiewe reëls geld <b>dadelik</b> vir alle KI-terugvoer op hierdie werkboek, ook in die leerders se app. Elke handeling word aangeteken en kan teruggedraai word; geskrapte reëls kan herstel word.
      </p>
      <div className="tabs">
        <Link href={`/onderwyser/ki-reels?werkboek=${encodeURIComponent(ALL_WORKBOOKS)}`} className={isGlobal ? "on" : ""}>🌐 Alle werkboeke (gees)</Link>
        {templates.map((x) => (
          <Link key={x.key} href={`/onderwyser/ki-reels?werkboek=${x.key}`} className={x.key === current.key ? "on" : ""}>{x.label}</Link>
        ))}
      </div>

      <details className="pv-acc" style={{ marginBottom: 18 }}>
        <summary><span className="t">➕ Nuwe reël byvoeg</span></summary>
        <div className="body">
          <form action={createRule} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="templateKey" value={current.key} />
            <select name="scope" defaultValue="" disabled={isGlobal}>
              <option value="">{isGlobal ? "Alle werkboeke" : "Hele werkboek"}</option>
              {scopes.map((s) => (
                <optgroup key={s.key} label={`WB${s.number} · ${s.title}`}>
                  <option value={s.key}>WB{s.number} · hele werkblad</option>
                  {s.criteria.map((c) => <option key={c.id} value={`${s.key}|${c.id}`}>WB{s.number} · {c.title}</option>)}
                </optgroup>
              ))}
            </select>
            <textarea name="text" rows={2} maxLength={1200} required minLength={8} placeholder="bv. By “Wie sê dit is ’n behoefte?”: aanvaar ook ’n bron soos ’n artikel of statistiek, nie net Moeggesukkel nie." />
            <div className="btn-row"><button className="btn sm primary">Voeg by (geld dadelik)</button></div>
          </form>
        </div>
      </details>

      {isAdminRole(t.role) ? (
        <details className="pv-acc" style={{ marginBottom: 18 }}>
          <summary><span className="t">📥 Voer reëls in (JSON-lêer)</span></summary>
          <div className="body"><ReelInvoer /></div>
        </details>
      ) : null}

      {rules.length === 0 ? (
        <div className="card empty">Nog geen reëls vir hierdie werkboek nie.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rules.map((r) => {
            const mayEdit = r.createdById === t.id || isAdminRole(t.role);
            return (
              <article key={r.id} className="card" style={{ margin: 0, opacity: r.active ? 1 : 0.6 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <span className={`badge ${r.active ? "ok" : "plain"}`}>{r.active ? "Aktief" : "Af"}</span>
                  <span className="badge plain blue">{scopeLabel(r.sheet, r.criterionId)}</span>
                  <span className="grow" />
                  <small className="muted">{r.createdByName} · {r.createdAt.toLocaleDateString("af-ZA")}</small>
                </div>
                {mayEdit ? (
                  <form action={updateRule} style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <input type="hidden" name="id" value={r.id} />
                    <textarea name="text" rows={2} maxLength={1200} defaultValue={r.text} />
                    <div className="btn-row">
                      <button className="btn sm">Stoor wysiging</button>
                      <button className="btn sm" formAction={toggleRule}>{r.active ? "Skakel af" : "Skakel aan"}</button>
                      <button className="btn sm danger" formAction={deleteRule}>Skrap (kan herstel)</button>
                      {r.sourceComparisonId ? <Link className="btn sm ghost" href={`/onderwyser/pdf-vergelyking/${r.sourceComparisonId}`}>Bron</Link> : null}
                    </div>
                  </form>
                ) : (
                  <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{r.text}</p>
                )}
                <Geskiedenis events={r.events} ruleId={r.id} mayEdit={mayEdit} current={r.text} />
              </article>
            );
          })}
        </div>
      )}

      {deleted.length ? (
        <details className="pv-acc" style={{ marginTop: 18 }}>
          <summary><span className="t">🗑 Geskrapte reëls ({deleted.length}) – kan herstel word</span></summary>
          <div className="body" style={{ display: "grid", gap: 10 }}>
            {deleted.map((r) => (
              <div key={r.id} className="pv-box">
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <span className="badge plain blue">{scopeLabel(r.sheet, r.criterionId)}</span>
                  <span className="grow" />
                  <small className="muted">geskrap {r.deletedAt!.toLocaleString("af-ZA", { dateStyle: "medium", timeStyle: "short" })}</small>
                </div>
                <p style={{ margin: "8px 0", whiteSpace: "pre-wrap" }}>{r.text}</p>
                <form action={restoreRule}><input type="hidden" name="id" value={r.id} /><button className="btn sm">Herstel</button></form>
                <Geskiedenis events={r.events} ruleId={r.id} mayEdit={false} current={r.text} />
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {admin ? (
        <details className="pv-acc" style={{ marginTop: 18 }}>
          <summary><span className="t">🕑 Ouditspoor: wie het wat gedoen (laaste {recent.length})</span></summary>
          <div className="body" style={{ overflowX: "auto" }}>
            {recent.length === 0 ? <p className="muted">Nog niks nie.</p> : (
              <table className="dtable">
                <thead><tr><th>Wanneer</th><th>Wie</th><th>Wat</th><th>Reël</th></tr></thead>
                <tbody>
                  {recent.map((e) => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{e.at.toLocaleString("af-ZA", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td>{e.byName}</td>
                      <td><span className={`badge ${ACTION_CLS[e.action] ?? "plain"}`}>{e.action}</span></td>
                      <td style={{ fontSize: ".88rem" }}>
                        {e.newText ?? e.oldText ?? e.rule.text}
                        {e.note ? <div className="muted">{e.note}</div> : null}
                        <div className="muted">{e.rule.templateKey === ALL_WORKBOOKS ? "Alle werkboeke" : getTemplate(e.rule.templateKey).label}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}

const ACTION_CLS: Record<string, string> = { aangemaak: "ok", gewysig: "blue", teruggedraai: "blue", afgeskakel: "warn", aangeskakel: "ok", geskrap: "red", herstel: "ok" };

function Geskiedenis({ events, ruleId, mayEdit, current }: { events: { id: string; at: Date; byName: string; action: string; oldText: string | null; newText: string | null; note: string | null }[]; ruleId: string; mayEdit: boolean; current: string }) {
  if (!events.length) return null;
  return (
    <details style={{ marginTop: 10 }}>
      <summary className="muted" style={{ fontSize: ".85rem" }}>Geskiedenis ({events.length})</summary>
      <ul className="versions" style={{ marginTop: 8 }}>
        {events.map((e) => {
          const older = e.oldText && e.oldText !== current ? e.oldText : null;
          return (
            <li key={e.id} style={{ display: "block" }}>
              <span className="muted">{e.at.toLocaleString("af-ZA", { dateStyle: "short", timeStyle: "short" })}</span> · <b>{e.action}</b> deur {e.byName}
              {e.note ? <div className="muted" style={{ fontSize: ".85rem" }}>{e.note}</div> : null}
              {e.action === "gewysig" || e.action === "teruggedraai" ? (
                <div style={{ fontSize: ".85rem" }}>
                  <div><s className="muted">{e.oldText}</s></div>
                  <div>{e.newText}</div>
                </div>
              ) : null}
              {mayEdit && older ? (
                <form action={revertRule} style={{ marginTop: 4 }}>
                  <input type="hidden" name="id" value={ruleId} />
                  <input type="hidden" name="eventId" value={e.id} />
                  <button className="btn sm ghost">↩ Draai terug na die ou teks</button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
