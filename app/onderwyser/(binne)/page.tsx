import Link from "next/link";
import { goToGroupByCode } from "@/app/onderwyser/actions";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/sessie";
import { getTemplate } from "@/lib/werkboeke/sjablone";

export const metadata = { title: "Groepe" };

function ago(d: Date | null) {
  if (!d) return "—";
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 2) return "nou net";
  if (m < 60) return `${m} min gelede`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} uur gelede`;
  const days = Math.round(h / 24);
  return days === 1 ? "gister" : `${days} dae gelede`;
}

export default async function OnderwyserTuis({ searchParams }: { searchParams: Promise<{ projek?: string; klas?: string; nie?: string }> }) {
  const t = await requireTeacher();
  const sp = await searchParams;
  const projects = await db.project.findMany({ where: { schoolId: t.schoolId, active: true }, orderBy: [{ year: "desc" }, { grade: "asc" }] });

  const waiting = await db.checkpoint.findMany({
    where: { status: "SUBMITTED", group: { archived: false, project: { schoolId: t.schoolId, active: true } } },
    include: { group: { select: { id: true, name: true, klas: true, code: true, project: { select: { title: true } } } } },
    orderBy: { submittedAt: "asc" },
    take: 50
  });

  if (!projects.length) {
    return (
      <div className="container">
        <div className="card empty">
          <h2>Nog geen projekte nie</h2>
          <p>{t.role === "ADMIN" ? <Link href="/onderwyser/beheer">Skep ’n projek →</Link> : "Vra die administrateur om ’n projek te skep."}</p>
        </div>
      </div>
    );
  }

  const project = projects.find((p) => p.id === sp.projek) ?? projects[0];
  const tpl = getTemplate(project.templateKey);
  const groups = await db.group.findMany({
    where: { projectId: project.id, archived: false, ...(sp.klas ? { klas: sp.klas } : {}) },
    select: {
      id: true,
      name: true,
      klas: true,
      code: true,
      members: true,
      lastSeenAt: true,
      checkpoints: { select: { number: true, status: true } },
      responses: { select: { updatedAt: true, status: true, sheet: true } }
    },
    orderBy: [{ klas: "asc" }, { name: "asc" }, { createdAt: "asc" }]
  });
  const klasse = (
    await db.group.findMany({ where: { projectId: project.id, archived: false }, select: { klas: true }, distinct: ["klas"], orderBy: { klas: "asc" } })
  )
    .map((k) => k.klas)
    .filter((k): k is string => Boolean(k));

  const total = groups.length;
  const waitingHere = groups.filter((g) => g.checkpoints.some((c) => c.status === "SUBMITTED")).length;
  const approvedCps = groups.reduce((a, g) => a + g.checkpoints.filter((c) => c.status === "APPROVED").length, 0);
  const weekAgo = Date.now() - 7 * 86400_000;
  const activeWeek = groups.filter((g) => g.responses.some((r) => r.updatedAt.getTime() > weekAgo)).length;

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 18 }}>
        <h1 className="grow" style={{ margin: 0 }}>
          Groepe
        </h1>
        <Link className="btn sm" href="/onderwyser/groepe">Groepkodes</Link>
        <form action={goToGroupByCode} className="row" style={{ gap: 8 }}>
          <input type="text" name="code" placeholder="Soek groepkode" style={{ width: 180 }} aria-label="Soek groepkode" />
          <button className="btn sm">Soek</button>
        </form>
      </div>

      {sp.nie ? <div className="alert warn" style={{ marginBottom: 16 }}>Geen groep met daardie kode nie.</div> : null}

      {waiting.length ? (
        <details open className="pv-acc" style={{ marginBottom: 22, borderColor: "color-mix(in srgb, var(--wait) 35%, var(--line))" }}>
          <summary><span className="t" style={{ color: "var(--wait)" }}>Wag vir jou aftekening ({waiting.length})</span></summary>
          <div className="body">
          <div className="dtable-wrap" style={{ boxShadow: "none" }}>
            <table className="dtable">
              <tbody>
                {waiting.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <span className="cpdot SUBMITTED">{w.number}</span>
                    </td>
                    <td>
                      <b>{w.group.name ?? "(nog geen naam)"}</b>
                      <div className="muted" style={{ fontSize: ".82rem" }}>
                        {w.group.project.title}
                        {w.group.klas ? ` · ${w.group.klas}` : ""} · <span className="mono">{w.group.code}</span>
                      </div>
                    </td>
                    <td className="muted">Ingedien {ago(w.submittedAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="btn sm primary" href={`/onderwyser/groep/${w.group.id}#kp${w.number}`}>
                        Gaan na
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </details>
      ) : null}

      <div className="tabs">
        {projects.map((p) => (
          <Link key={p.id} href={`/onderwyser?projek=${p.id}`} className={p.id === project.id ? "on" : ""}>
            {p.title} {p.year}
          </Link>
        ))}
      </div>

      <div className="stats">
        <div className="stat">
          <div className="v">{total}</div>
          <div className="l">groepe{sp.klas ? ` in ${sp.klas}` : ""}</div>
        </div>
        <div className={`stat ${waitingHere ? "attn" : ""}`}>
          <div className="v">{waitingHere}</div>
          <div className="l">wag vir aftekening</div>
        </div>
        <div className="stat">
          <div className="v">
            {total ? Math.round((approvedCps / (total * tpl.checkpoints.length)) * 100) : 0}%
          </div>
          <div className="l">kontrolepunte afgeteken</div>
        </div>
        <div className="stat">
          <div className="v">{activeWeek}</div>
          <div className="l">aktief in die afgelope week</div>
        </div>
      </div>

      {klasse.length > 1 ? (
        <div className="tabs">
          <Link href={`/onderwyser?projek=${project.id}`} className={!sp.klas ? "on" : ""}>
            Alle klasse
          </Link>
          {klasse.map((k) => (
            <Link key={k} href={`/onderwyser?projek=${project.id}&klas=${encodeURIComponent(k)}`} className={sp.klas === k ? "on" : ""}>
              {k}
            </Link>
          ))}
        </div>
      ) : null}

      {groups.length ? (
        <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Groep</th>
                <th>Klas</th>
                <th>Kode</th>
                <th>Kontrolepunte</th>
                <th>Gereed</th>
                <th>Laaste werk</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const firstOpen = tpl.checkpoints.find((c) => g.checkpoints.find((x) => x.number === c.number)?.status !== "APPROVED");
                const ready = g.responses.filter((r) => r.status === "READY" && !r.sheet.includes(":")).length;
                const last = g.responses.reduce<Date | null>((a, r) => (!a || r.updatedAt > a ? r.updatedAt : a), null);
                const members = (Array.isArray(g.members) ? (g.members as string[]) : []).filter(Boolean);
                return (
                  <tr key={g.id}>
                    <td>
                      <Link href={`/onderwyser/groep/${g.id}`}>
                        <b>{g.name ?? "(nog geen naam)"}</b>
                      </Link>
                      <div className="muted" style={{ fontSize: ".8rem" }}>
                        {members.join(", ") || "—"}
                      </div>
                    </td>
                    <td>{g.klas ?? "—"}</td>
                    <td className="mono">{g.code}</td>
                    <td>
                      <div className="cpdots">
                        {tpl.checkpoints.map((c) => {
                          const st = g.checkpoints.find((x) => x.number === c.number)?.status ?? "OPEN";
                          const cls = st === "OPEN" && firstOpen?.number === c.number ? "ACTIVE" : st;
                          return (
                            <span key={c.number} className={`cpdot ${cls}`} title={`${c.title}: ${st}`}>
                              {c.number}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      {ready} / {tpl.sheets.filter((s) => s.checkpoint).length}
                    </td>
                    <td className="muted">{ago(last)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty">
          <p>Nog geen groepe in hierdie projek nie.</p>
          <Link className="btn primary" href="/onderwyser/groepe">
            Skep groepkodes
          </Link>
        </div>
      )}
    </div>
  );
}
