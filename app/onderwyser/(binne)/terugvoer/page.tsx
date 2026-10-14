import Link from "next/link";
import { setDevFeedbackStatus } from "@/app/onderwyser/actions";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/sessie";
import { devFeedbackRows } from "@/lib/terugvoer-uitvoer";

export const metadata = { title: "Terugvoer" };

const STATUS = [
  { key: "", label: "Alles" },
  { key: "nuut", label: "Nuut" },
  { key: "gelees", label: "Gelees" },
  { key: "verwerk", label: "Verwerk" }
];

const RATING_TONE: Record<string, string> = { Reg: "ok", "Te streng": "warn", "Te sag": "warn", Verkeerd: "red", Fout: "red", Voorstel: "blue", Vraag: "blue" };

export default async function TerugvoerOorsig({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const a = await requireAdmin();
  const sp = await searchParams;
  const status = STATUS.some((s) => s.key === sp.status) ? sp.status : "";
  const [rows, counts] = await Promise.all([
    devFeedbackRows(a.schoolId, { status: status || undefined, take: 300 }),
    db.devFeedback.groupBy({ by: ["status"], where: { schoolId: a.schoolId }, _count: { _all: true } })
  ]);
  const count = (k: string) => counts.find((c) => c.status === k)?._count._all ?? 0;
  const items = await db.devFeedback.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: { id: true, groupId: true, sheet: true } });

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 14 }}>
        <h1 className="grow" style={{ margin: 0 }}>
          Terugvoer aan die ontwikkelaar
        </h1>
        <a className="btn sm" href="/api/terugvoer?formaat=csv">
          ⬇ Excel (CSV)
        </a>
        <a className="btn sm" href="/api/terugvoer?formaat=json">
          ⬇ JSON
        </a>
      </div>
      <p className="muted" style={{ maxWidth: "75ch" }}>
        Alles wat onderwysers via die klets-ikoon of die blok “Is die KI reg?” stuur. Die aflaai bevat ook die KI se oordeel en die groep se teks (sonder name) op daardie
        oomblik, sodat die KI-opdrag en kriteria presies bygestel kan word.
      </p>

      <div className="stats">
        <div className={`stat ${count("nuut") ? "attn" : ""}`}>
          <div className="v">{count("nuut")}</div>
          <div className="l">nuut</div>
        </div>
        <div className="stat">
          <div className="v">{count("gelees")}</div>
          <div className="l">gelees</div>
        </div>
        <div className="stat">
          <div className="v">{count("verwerk")}</div>
          <div className="l">verwerk</div>
        </div>
        <div className="stat">
          <div className="v">{count("nuut") + count("gelees") + count("verwerk")}</div>
          <div className="l">totaal</div>
        </div>
      </div>

      <div className="tabs">
        {STATUS.map((s) => (
          <Link key={s.key} href={s.key ? `/onderwyser/terugvoer?status=${s.key}` : "/onderwyser/terugvoer"} className={status === s.key ? "on" : ""}>
            {s.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card empty">Nog geen terugvoer nie. Gebruik die rooi klets-ikoon regs onder, of die blok “Is die KI reg?” by ’n werkblad.</div>
      ) : (
        rows.map((r) => {
          const it = items.find((x) => x.id === r.id);
          return (
            <div className="card" key={r.id} style={r.status === "nuut" ? { borderLeft: "4px solid var(--red)" } : undefined}>
              <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                <span className="badge plain">{r.soort}</span>
                {r.oordeel ? <span className={`badge ${RATING_TONE[r.oordeel] ?? ""}`}>{r.oordeel}</span> : null}
                <b>{r.onderwyser}</b>
                <small className="muted">{r.datum}</small>
                <span className="grow" />
                <span className={`badge ${r.status === "nuut" ? "red" : r.status === "verwerk" ? "ok" : "plain"}`}>{r.status}</span>
              </div>
              {r.boodskap ? <p style={{ whiteSpace: "pre-wrap", fontSize: "1.02rem" }}>{r.boodskap}</p> : null}
              <div className="muted" style={{ fontSize: ".86rem" }}>
                {[r.projek, r.groep && `${r.groep} (${r.groepkode})`, r.werkblad, r.kriterium && `Kriterium: ${r.kriterium}`].filter(Boolean).join(" · ") || r.bladsy}
                {it?.groupId && it.sheet ? (
                  <>
                    {" · "}
                    <Link href={`/onderwyser/groep/${it.groupId}/${encodeURIComponent(it.sheet)}`}>maak oop</Link>
                  </>
                ) : r.bladsy ? (
                  <>
                    {" · "}
                    <Link href={r.bladsy}>bladsy</Link>
                  </>
                ) : null}
              </div>

              {r.ki_opsomming || r.groep_teks ? (
                <details style={{ marginTop: 10 }}>
                  <summary className="muted" style={{ fontSize: ".88rem" }}>
                    Konteks: wat die KI gesê het en wat die groep geskryf het
                  </summary>
                  <div className="grid-2" style={{ marginTop: 10 }}>
                    <div>
                      <div className="lbl">KI ({r.ki_gereed === "ja" ? "gereed" : "nie gereed nie"})</div>
                      <p style={{ fontSize: ".9rem" }}>{r.ki_opsomming}</p>
                      {r.ki_oor_kriterium ? (
                        <p style={{ fontSize: ".9rem" }}>
                          <b>Oor “{r.kriterium}”:</b> {r.ki_oor_kriterium}
                        </p>
                      ) : null}
                      <p className="mono" style={{ fontSize: ".75rem", color: "var(--muted)" }}>
                        {r.ki_kriteria}
                      </p>
                    </div>
                    <div>
                      <div className="lbl">Groep se teks (sonder name)</div>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: ".82rem", background: "var(--paper)", padding: 10, borderRadius: 8, margin: 0, maxHeight: 320, overflow: "auto" }}>
                        {r.groep_teks}
                      </pre>
                    </div>
                  </div>
                </details>
              ) : null}

              <form action={setDevFeedbackStatus} className="row" style={{ marginTop: 12, gap: 8 }}>
                <input type="hidden" name="id" value={r.id} />
                <input type="text" name="devNote" defaultValue={r.ontwikkelaar_nota} placeholder="Nota van die ontwikkelaar (bv. wat aangepas is)" style={{ flex: 1, minWidth: 200 }} />
                <button className="btn sm" name="status" value="gelees">
                  Gelees
                </button>
                <button className="btn sm ok" name="status" value="verwerk">
                  Verwerk
                </button>
              </form>
            </div>
          );
        })
      )}
    </div>
  );
}
