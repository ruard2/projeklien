import Link from "next/link";
import { approveExtraction, deleteComparison, rerunAllAction, retryComparison } from "@/app/onderwyser/pdf-aksies";
import PdfKriteriumRy from "@/components/PdfKriteriumRy";
import { db } from "@/lib/db";
import type { ChatMsg } from "@/lib/pdf-vergelyking/gesprek";
import Herlaai from "@/components/Herlaai";
import PdfWerkblad from "@/components/PdfWerkblad";
import { asExtracted, asResults, beforeAfter, loadOwnComparison, STALE_MS } from "@/lib/pdf-vergelyking/diens";
import VoorNa from "@/components/VoorNa";
import { extractableSheets, jufText, membersFrom, studentOnlySheet } from "@/lib/pdf-vergelyking/skema";
import { OORDEEL_LABEL, OOREENKOMS_LABEL, STATUS_LABEL } from "@/lib/pdf-vergelyking/status";
import { requireDeveloper } from "@/lib/sessie";
import { getTemplate } from "@/lib/werkboeke/sjablone";
import { sheetToText } from "@/lib/werkboeke/teks";

export const metadata = { title: "KI beoordeel" };

function Lys({ items, empty = "—" }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>{empty}</p>;
  return <ul className="pv-list">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

export default async function PdfVergelykingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await requireDeveloper();
  const c = await loadOwnComparison(id, t);
  const template = getTemplate(c.templateKey);
  const extracted = asExtracted(c.extracted);
  const results = asResults(c.results);
  const ba = beforeAfter([results]);
  const members = extracted ? membersFrom(extracted) : [];
  const sheets = extracted ? extractableSheets(template).filter((s) => extracted.sheets[s.key]) : [];
  const st = STATUS_LABEL[c.status] ?? { text: c.status, cls: "plain" };
  const busy = c.status === "uitlees" || c.status === "ki";
  const stale = busy && Date.now() - c.updatedAt.getTime() > STALE_MS;
  const mine = c.votes.filter((v) => v.teacherId === t.id);
  const myVotes = new Map(mine.map((v) => [`${v.sheet}|${v.criterionId}`, v.vote]));
  const myVoteRows = new Map(mine.map((v) => [`${v.sheet}|${v.criterionId}`, v]));
  const paperGroup = c.groupId ? await db.group.findFirst({ where: { id: c.groupId, paperImport: true }, select: { name: true, code: true } }) : null;
  const ruleIds = mine.map((v) => v.ruleId).filter((x): x is string => Boolean(x));
  const scopeRuleRows = await db.aiRule.findMany({ where: { schoolId: c.schoolId, templateKey: c.templateKey, active: true, deletedAt: null, NOT: { sheet: null } }, orderBy: { createdAt: "asc" }, select: { sheet: true, criterionId: true, text: true } });
  const existingRules = new Map(scopeRuleRows.map((r) => [`${r.sheet}|${r.criterionId ?? ""}`, r.text]));
  const ruleTexts = new Map((ruleIds.length ? await db.aiRule.findMany({ where: { id: { in: ruleIds } }, select: { id: true, text: true } }) : []).map((r) => [r.id, r.text]));

  return (
    <div className="container">
      {busy && !stale ? <Herlaai seconds={5} /> : null}
      <p>
        <Link href="/onderwyser/pdf-vergelyking">← KI beoordeel</Link>
        {c.groupId ? <> · <Link href={`/onderwyser/groep/${c.groupId}`}>Groep in die app</Link></> : null}
      </p>
      {paperGroup ? (
        <div className="alert info">📱 Digitale werkboek gemaak: <strong>{paperGroup.name}</strong> · kode <code style={{ fontWeight: 700 }}>{paperGroup.code}</code>. Die groep werk hiermee in die app verder.</div>
      ) : null}
      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <h1 className="grow" style={{ margin: 0 }}>{template.label}</h1>
        <span className={`badge ${st.cls}`}>{st.text}</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {c.fileName} · {c.createdAt.toLocaleString("af-ZA", { dateStyle: "medium", timeStyle: "short" })}
        {c.model && c.status !== "uitlees" ? <> · {c.model.startsWith("handmatig") ? c.model : `uitgelees met ${c.model}`}</> : null}
        {extracted ? <> · {[extracted.groepnaam, extracted.klas].filter(Boolean).join(" · ")} · {extracted.lede.filter(Boolean).join(", ")}</> : null}
      </p>

      {c.status === "uitlees" && !stale ? (
        <div className="card"><p style={{ margin: 0 }}><span className="spinner dark" /> Die werkboek word uitgelees. Dit kan ’n paar minute duur; hierdie bladsy herlaai self.</p></div>
      ) : null}
      {c.status === "ki" && !stale ? (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <span className="spinner dark" /> Die KI gee nou terugvoer op elke werkblad ({Object.keys(results).length} van {sheets.filter((s) => s.feedback).length} klaar). Hierdie bladsy herlaai self.
        </div>
      ) : null}
      {c.status === "fout" || stale ? (
        <div className="alert err" style={{ marginBottom: 16 }}>
          {stale ? "Dit neem te lank; die bediener is moontlik intussen herbegin." : c.error ?? "Iets het verkeerd geloop."}
          <form action={retryComparison} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn sm">Probeer weer</button>
          </form>
        </div>
      ) : null}

      {/* ---------------- Stap 2: nagaan */}
      {c.status === "nagaan" && extracted ? (
        <>
          <div className="alert warn" style={{ marginBottom: 16 }}>
            Maak elke werkblad oop en gaan na of die leerders se antwoorde en jou kommentaar reg gelees en reg geskei is. Sien jy ’n leesfout, klik <b>✏️ Wysig</b> en stel dit reg. As alles klop, klik onderaan <b>Akkoord</b>: dan gaan die leerders se antwoorde, geanonimiseer, na die gewone KI-terugvoer.
          </div>
          {sheets.map((s) => {
            const e = extracted.sheets[s.key];
            return (
              <details className="pv-acc" key={s.key}>
                <summary>
                  <span className="t">Werkblad {s.number} · {s.title}</span>
                  {e.juf.kommentaar.length || e.juf.kommentaar_vorige.length ? <span className="badge red">{e.juf.kommentaar.length + e.juf.kommentaar_vorige.length} juf-opmerking(s)</span> : null}
                  {e.juf.afgeteken ? <span className="badge ok">afgeteken</span> : null}
                  {e.onseker.length ? <span className="badge warn">{e.onseker.length} onseker</span> : null}
                </summary>
                <div className="body">
                  <PdfWerkblad comparisonId={c.id} sheet={studentOnlySheet(s)} data={e.data} juf={e.juf} members={members} foto={e.foto} editable />
                  {e.onseker.length ? <div className="alert info" style={{ marginTop: 10, fontSize: ".88rem" }}><b>Onseker:</b> {e.onseker.join(" · ")}</div> : null}
                </div>
              </details>
            );
          })}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="btn-row">
              <form action={approveExtraction}><input type="hidden" name="id" value={c.id} /><button className="btn ok lg">Akkoord – gee aan die KI</button></form>
              {c.pdf ? <form action={retryComparison}><input type="hidden" name="id" value={c.id} /><button className="btn">Lees weer uit</button></form> : null}
            </div>
          </div>
        </>
      ) : null}

      {/* ---------------- Stap 3: vergelyking */}
      {(c.status === "ki" || c.status === "klaar" || (c.status === "fout" && Object.keys(results).length > 0)) && extracted ? (
        <>
          <p className="muted" style={{ fontSize: ".9rem" }}>Klik op ’n werkblad om jou kommentaar, die KI se terugvoer en die oordeel per kriterium te sien.</p>
          {c.status === "klaar" ? (
            <div className="stats">
              {Object.entries(OOREENKOMS_LABEL).map(([k, v]) => (
                <div className="stat" key={k}><div className="v">{Object.values(results).filter((r) => r.vergelyking?.ooreenkoms === k).length}</div><div className="l">{v.text}</div></div>
              ))}
            </div>
          ) : null}
          {ba.sheets > 0 ? <VoorNa ba={ba} /> : null}
          {c.status === "klaar" || c.status === "fout" ? (
            <form action={rerunAllAction} style={{ marginBottom: 14 }}>
              <input type="hidden" name="id" value={c.id} />
              <button className="btn sm">🔄 Beoordeel alles weer met die huidige reëls</button>
              <small className="muted" style={{ marginLeft: 8 }}>Die huidige uitslag word bewaar sodat jy voor en ná kan vergelyk.</small>
            </form>
          ) : null}
          {sheets.filter((s) => s.feedback).map((s) => {
            const e = extracted.sheets[s.key];
            const r = results[s.key];
            const v = r?.vergelyking;
            const ov = v ? OOREENKOMS_LABEL[v.ooreenkoms] : null;
            const up = (r?.result?.kriteria ?? []).filter((k) => myVotes.get(`${s.key}|${k.id}`) === 1).length;
            const down = (r?.result?.kriteria ?? []).filter((k) => myVotes.get(`${s.key}|${k.id}`) === -1).length;
            return (
              <details className="pv-acc" key={s.key}>
                <summary>
                  <span className="t">Werkblad {s.number} · {s.title}</span>
                  {!r ? <span className="badge wait">word verwerk…</span> : r.fout ? <span className="badge red">fout</span> : null}
                  {ov ? <span className={`badge ${ov.cls}`}>{ov.text}</span> : null}
                  {r?.voorheen?.ooreenkoms && r.voorheen.ooreenkoms !== v?.ooreenkoms ? <span className="badge plain">was: {OOREENKOMS_LABEL[r.voorheen.ooreenkoms]?.text ?? r.voorheen.ooreenkoms}</span> : null}
                  {r?.result ? <span className={`badge plain ${r.gereed ? "ok" : ""}`}>{r.gereed ? "KI: gereed" : "KI: nog nie gereed"}</span> : null}
                  {up || down ? <span className="muted" style={{ fontSize: ".85rem", fontWeight: 500 }}>{up}👍 {down}👎</span> : null}
                </summary>
                <div className="body">
                {r?.herbeoordeel ? <div className="alert info" style={{ fontSize: ".88rem", marginBottom: 10 }}>🔄 Weer beoordeel op {new Date(r.herbeoordeel).toLocaleString("af-ZA", { dateStyle: "medium", timeStyle: "short" })} met die huidige onderwyserreëls.</div> : null}
                {!r ? <p className="muted" style={{ margin: 0 }}><span className="spinner dark" /> Word verwerk…</p> : r.fout ? <div className="alert err">{r.fout}</div> : (
                  <>
                    {v ? <p style={{ margin: "10px 0" }}>{v.opsomming}</p> : null}
                    <div className="pv-cols">
                      <div className="pv-box juf">
                        <h4>Juf sê</h4>
                        <pre className="pv-pre">{jufText(e, []) || "(geen kommentaar)"}</pre>
                      </div>
                      <div className="pv-box ki">
                        <h4>KI sê</h4>
                        <p className="pv-pre" style={{ marginBottom: 8 }}>{r.result!.opsomming}</p>
                        {r.result!.vrae.length ? <><h4>Vrae aan die groep</h4><Lys items={r.result!.vrae} /></> : null}
                        {r.result!.reelkwessies.length ? <><h4 style={{ marginTop: 10 }}>Reëlkwessies</h4><Lys items={r.result!.reelkwessies.map((q) => `${q.reel}: ${q.beskrywing}`)} /></> : null}
                      </div>
                    </div>
                    {v ? (
                      <div className="pv-cols" style={{ marginTop: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                        <div className="pv-box"><h4>Albei</h4><Lys items={v.albei} /></div>
                        <div className="pv-box"><h4>Net die juf</h4><Lys items={v.net_juf} /></div>
                        <div className="pv-box"><h4>Net die KI (ekstra)</h4><Lys items={v.net_ki} /></div>
                      </div>
                    ) : null}
                    <h3 style={{ marginTop: 18 }}>KI-oordeel per kriterium</h3>
                    <table className="pv-crit">
                      <thead><tr><th>Kriterium</th><th>KI</th><th>Terugvoer</th><th>Klop dit?</th></tr></thead>
                      <tbody>
                        {r.result!.kriteria.map((k) => {
                          const crit = s.criteria.find((x) => x.id === k.id);
                          const v = myVoteRows.get(`${s.key}|${k.id}`);
                          return (
                            <PdfKriteriumRy
                              key={`${k.id}-${r.herbeoordeel ?? ""}`}
                              id={c.id}
                              sheet={s.key}
                              criterionId={k.id}
                              title={crit?.title ?? k.id}
                              verdict={OORDEEL_LABEL[k.oordeel] ?? { text: k.oordeel, cls: "plain" }}
                              feedback={k.terugvoer}
                              vote={v?.vote ?? null}
                              chat={(v?.chat as ChatMsg[] | null) ?? []}
                              ruleText={v?.ruleId ? ruleTexts.get(v.ruleId) ?? null : null}
                              existingRule={existingRules.get(`${s.key}|${k.id}`) ?? null}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
                </div>
              </details>
            );
          })}
        </>
      ) : null}

      <div className="card flat" style={{ marginTop: 24 }}>
        <form action={deleteComparison}>
          <input type="hidden" name="id" value={c.id} />
          <button className="btn sm danger">Skrap hierdie vergelyking</button>
        </form>
      </div>
    </div>
  );
}
