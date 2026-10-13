import AksieVorm from "@/components/AksieVorm";
import DrukKnoppie from "@/components/DrukKnoppie";
import { archiveGroup, createGroups } from "@/app/onderwyser/actions";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/sessie";

export const metadata = { title: "Groepkodes" };

export default async function Groepkodes({ searchParams }: { searchParams: Promise<{ argief?: string }> }) {
  const t = await requireTeacher();
  const sp = await searchParams;
  const showArchived = sp.argief === "1";
  const projects = await db.project.findMany({
    where: { schoolId: t.schoolId, active: true },
    orderBy: [{ year: "desc" }, { grade: "asc" }],
    include: {
      groups: { where: { archived: showArchived }, orderBy: [{ klas: "asc" }, { createdAt: "asc" }], select: { id: true, code: true, klas: true, name: true, archived: true } }
    }
  });

  return (
    <div className="container">
      <div className="row no-print" style={{ marginBottom: 18 }}>
        <h1 className="grow" style={{ margin: 0 }}>
          Groepkodes
        </h1>
        <a className="btn sm" href={showArchived ? "/onderwyser/groepe" : "/onderwyser/groepe?argief=1"}>
          {showArchived ? "Wys aktiewe groepe" : "Wys geargiveerde groepe"}
        </a>
        <DrukKnoppie />
      </div>

      <div className="card no-print" style={{ marginBottom: 22 }}>
        <h2>Skep nuwe groepe</h2>
        <p className="muted">Elke groep kry ’n unieke kode waarmee hulle aanmeld. Die groep vul self hulle naam en lede in.</p>
        <AksieVorm action={createGroups} submit="Skep kodes">
          <div className="grid-2" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
            <div>
              <label className="lbl" htmlFor="projectId">
                Projek
              </label>
              <select id="projectId" name="projectId" required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} {p.year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="klas">
                Klas
              </label>
              <input id="klas" name="klas" type="text" placeholder="bv. 9A" />
            </div>
            <div>
              <label className="lbl" htmlFor="count">
                Aantal groepe
              </label>
              <input id="count" name="count" type="number" min={1} max={30} defaultValue={8} />
            </div>
          </div>
        </AksieVorm>
      </div>

      {projects.map((p) => (
        <section key={p.id} style={{ marginBottom: 28 }}>
          <h2>
            {p.title} {p.year} <small className="muted">({p.groups.length})</small>
          </h2>
          {p.groups.length ? (
            <div className="codes">
              {p.groups.map((g) => (
                <div className="codecard" key={g.id}>
                  <div className="s">
                    VOL-projek · {p.title}
                    {g.klas ? ` · ${g.klas}` : ""}
                  </div>
                  <div className="c mono">{g.code}</div>
                  <div className="s">{g.name ?? "Meld aan by die VOL-webwerf met hierdie kode"}</div>
                  <form action={archiveGroup} className="no-print" style={{ marginTop: 8 }}>
                    <input type="hidden" name="groupId" value={g.id} />
                    <button className="btn ghost sm">{g.archived ? "Herstel" : "Argiveer"}</button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Geen groepe nie.</p>
          )}
        </section>
      ))}
    </div>
  );
}
