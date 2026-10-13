import Link from "next/link";
import { requireTeacher } from "@/lib/sessie";
import { listTemplates } from "@/lib/werkboeke/sjablone";

export const metadata = { title: "Kriteria" };

export default async function KriteriaBladsy({ searchParams }: { searchParams: Promise<{ boek?: string }> }) {
  await requireTeacher();
  const sp = await searchParams;
  const templates = listTemplates();
  const t = templates.find((x) => x.key === sp.boek) ?? templates[templates.length - 1];

  return (
    <div className="container narrow">
      <h1>Kriteria per werkblad</h1>
      <p className="muted">
        Die KI beoordeel elke werkblad teen hierdie vaste kriteria – dieselfde vir elke groep. ’n Werkblad is eers “gereed vir onderwyser” as álle kriteria
        behaal is, die verpligte dele volledig is en daar geen kwessies met die reëls is nie. Die onderwyser neem steeds die finale besluit by elke kontrolepunt.
      </p>
      <div className="tabs">
        {templates.map((x) => (
          <Link key={x.key} href={`/onderwyser/kriteria?boek=${x.key}`} className={x.key === t.key ? "on" : ""}>
            {x.label}
          </Link>
        ))}
      </div>
      <p className="muted" style={{ fontSize: ".85rem" }}>
        Sjabloon <span className="mono">{t.key}</span>, weergawe {t.version}
      </p>
      {t.sheets
        .filter((s) => s.criteria.length)
        .map((s) => (
          <div className="card" key={s.key}>
            <div className="sheet-num">
              Werkblad {s.number}
              {s.checkpoint ? ` · Kontrolepunt ${s.checkpoint}` : ""}
            </div>
            <h2>{s.title}</h2>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              {s.criteria.map((c) => (
                <li key={c.id} style={{ margin: "8px 0" }}>
                  <b>{c.title}.</b> {c.description}
                </li>
              ))}
            </ol>
          </div>
        ))}
    </div>
  );
}
