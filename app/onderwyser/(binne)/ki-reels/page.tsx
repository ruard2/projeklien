import Link from "next/link";
import { createRule, deleteRule, toggleRule, updateRule } from "@/app/onderwyser/reel-aksies";
import { db } from "@/lib/db";
import { isAdminRole, requireTeacher } from "@/lib/sessie";
import { getTemplate, listTemplates } from "@/lib/werkboeke/sjablone";

export const metadata = { title: "KI-reëls" };

export default async function KiReels({ searchParams }: { searchParams: Promise<{ werkboek?: string }> }) {
  const t = await requireTeacher();
  const sp = await searchParams;
  const templates = listTemplates();
  const current = templates.find((x) => x.key === sp.werkboek) ?? templates[templates.length - 1];
  const rules = await db.aiRule.findMany({ where: { schoolId: t.schoolId, templateKey: current.key }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
  const tpl = getTemplate(current.key);
  const scopeLabel = (sheetKey: string | null, criterionId: string | null) => {
    if (!sheetKey) return "Hele werkboek";
    const s = tpl.sheets.find((x) => x.key === sheetKey);
    const c = criterionId ? s?.criteria.find((x) => x.id === criterionId) : null;
    return `WB${s?.number ?? "?"}${c ? ` · ${c.title}` : " · hele werkblad"}`;
  };
  const scopes = tpl.sheets.filter((s) => s.feedback && !s.perMember);

  return (
    <div className="container">
      <h1>KI-reëls</h1>
      <p className="muted" style={{ maxWidth: "80ch" }}>
        Reëls wat onderwysers by die KI-terugvoer gevoeg het, meestal uit ’n gesprek ná ’n 👎 by die PDF-vergelyking. Aktiewe reëls geld <b>dadelik</b> vir alle KI-terugvoer op hierdie werkboek, ook in die leerders se app.
      </p>
      <div className="tabs">
        {templates.map((x) => (
          <Link key={x.key} href={`/onderwyser/ki-reels?werkboek=${x.key}`} className={x.key === current.key ? "on" : ""}>{x.label}</Link>
        ))}
      </div>

      <details className="pv-acc" style={{ marginBottom: 18 }}>
        <summary><span className="t">➕ Nuwe reël byvoeg</span></summary>
        <div className="body">
          <form action={createRule} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="templateKey" value={current.key} />
            <select name="scope" defaultValue="">
              <option value="">Hele werkboek</option>
              {scopes.map((s) => (
                <optgroup key={s.key} label={`WB${s.number} · ${s.title}`}>
                  <option value={s.key}>WB{s.number} · hele werkblad</option>
                  {s.criteria.map((c) => <option key={c.id} value={`${s.key}|${c.id}`}>WB{s.number} · {c.title}</option>)}
                </optgroup>
              ))}
            </select>
            <textarea name="text" rows={2} maxLength={500} required minLength={8} placeholder="bv. By “Wie sê dit is ’n behoefte?”: aanvaar ook ’n bron soos ’n artikel of statistiek, nie net Moeggesukkel nie." />
            <div className="btn-row"><button className="btn sm primary">Voeg by (geld dadelik)</button></div>
          </form>
        </div>
      </details>

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
                    <textarea name="text" rows={2} maxLength={500} defaultValue={r.text} />
                    <div className="btn-row">
                      <button className="btn sm">Stoor wysiging</button>
                      <button className="btn sm" formAction={toggleRule}>{r.active ? "Skakel af" : "Skakel aan"}</button>
                      <button className="btn sm danger" formAction={deleteRule}>Skrap</button>
                      {r.sourceComparisonId ? <Link className="btn sm ghost" href={`/onderwyser/pdf-vergelyking/${r.sourceComparisonId}`}>Bron</Link> : null}
                    </div>
                  </form>
                ) : (
                  <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{r.text}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
