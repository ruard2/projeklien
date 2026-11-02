import Link from "next/link";
import { notFound } from "next/navigation";
import AssesseringVorm from "@/components/AssesseringVorm";
import { BeoordeelEen } from "@/components/AssesseringKnoppies";
import DrukKnoppie from "@/components/DrukKnoppie";
import { fmtWhen } from "@/components/Terugvoer";
import { workbookHash, type MarkHistory, type ScoreEntry } from "@/lib/assessering/diens";
import { hasWork, photosToShow, type AssessmentResult } from "@/lib/assessering/ki";
import { rubricFor } from "@/lib/assessering/rubriek";
import { db } from "@/lib/db";
import { loadWorkbook } from "@/lib/diens";
import { requireTeacher } from "@/lib/sessie";

export const metadata = { title: "Assessering" };

export default async function AssesseringGroep({ params }: { params: Promise<{ groep: string }> }) {
  const t = await requireTeacher();
  const { groep } = await params;
  const owns = await db.group.findFirst({ where: { id: groep, project: { schoolId: t.schoolId } }, select: { id: true } });
  if (!owns) notFound();

  const { group, template, members } = await loadWorkbook(groep);
  const rubric = rubricFor(template.key);
  const [assessment, mark, photos] = await Promise.all([
    db.rubricAssessment.findFirst({ where: { groupId: groep, rubricKey: rubric.key }, orderBy: { createdAt: "desc" } }),
    db.rubricMark.findUnique({ where: { groupId_rubricKey: { groupId: groep, rubricKey: rubric.key } } }),
    db.photo.findMany({ where: { groupId: groep }, select: { id: true, sheet: true, caption: true, size: true }, orderBy: { createdAt: "asc" } })
  ]);
  const result = assessment?.result as unknown as AssessmentResult | undefined;
  const hash = workbookHash(group.responses);
  const changed = Boolean(assessment && assessment.workbookHash !== hash);
  const markStale = Boolean(mark && assessment && mark.assessmentId && mark.assessmentId !== assessment.id);
  const work = hasWork({ template, responses: group.responses, photos: photos.map((p) => ({ sheet: p.sheet, field: "", caption: p.caption })) });
  const history = (Array.isArray(mark?.history) ? mark!.history : []) as unknown as MarkHistory[];
  const seenPhotos = result?.fotos_gesien ?? 0;
  const named = members.map((m) => m.trim()).filter(Boolean);

  return (
    <div className="container">
      <div className="sheet-head">
        <div>
          <div className="crumb">
            <Link href={`/onderwyser/assessering?projek=${group.projectId}`}>Assessering</Link> · {group.project.title} {group.project.year}
          </div>
          <h1 style={{ marginBottom: 6 }}>{group.name ?? "(nog geen naam)"}</h1>
          <div className="row" style={{ gap: 8 }}>
            {group.klas ? <span className="badge plain blue">Klas {group.klas}</span> : null}
            <span className="badge plain mono">{group.code}</span>
            {group.paperImport ? <span className="badge plain">Uit papierwerkboek</span> : null}
            <span className="muted" style={{ fontSize: ".9rem" }}>{named.join(", ") || "Lede nog nie ingevul nie"}</span>
          </div>
        </div>
        <div className="right no-print">
          <div className="btn-row">
            <Link className="btn sm" href={`/onderwyser/groep/${groep}/druk`} target="_blank">
              Hele werkboek
            </Link>
            <DrukKnoppie />
          </div>
          {work ? <BeoordeelEen groupId={groep} again={Boolean(assessment)} photoCount={photosToShow(photos).length} /> : null}
        </div>
      </div>

      <div className="alert info" style={{ marginBottom: 16 }}>
        <b>Die KI gee net ’n voorstel; julle neem die besluit.</b> {seenPhotos ? `Dit het werkblad 1–14 sonder name gelees en ${seenPhotos} foto(’s) gesien, en beoordeel slegs volgens die rubriek.` : "Dit lees werkblad 1–14 sonder name en, tensy julle dit toelaat, sonder foto’s, en beoordeel slegs volgens die rubriek."} Leerders sien hierdie bladsy nooit.
      </div>

      {!work ? <div className="card empty">Hierdie groep het nog niks op werkblad 1–14 ingevul nie. Daar is niks om te beoordeel nie.</div> : null}
      {work && !assessment ? <div className="card empty">Die KI het hierdie werkboek nog nie beoordeel nie. Klik bo-aan op “Beoordeel met die KI”, of vul self die punte hieronder in.</div> : null}
      {assessment?.source === "toetsmodus" ? <div className="alert err" style={{ marginBottom: 16 }}><b>Toetsmodus:</b> daar is geen OpenAI-sleutel nie. Die KI-punte hier is gesimuleer en sê niks oor die werk nie.</div> : null}
      {changed ? <div className="alert warn" style={{ marginBottom: 16 }}><b>Die werkboek het verander</b> sedert die KI dit beoordeel het. Laat die KI dit weer beoordeel as julle die voorstel wil bywerk.</div> : null}
      {markStale ? <div className="alert warn" style={{ marginBottom: 16 }}>Julle gestoorde punte is op ’n vroeëre KI-voorstel gegrond. Dit bly staan totdat julle dit self verander.</div> : null}

      {result ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>KI-samevatting</h2>
            <span className="grow" />
            <small className="muted">{fmtWhen(assessment!.createdAt.toISOString())} · {assessment!.source}</small>
          </div>
          <p>{result.samevatting}</p>
          {result.algemeen_kontroleer.length ? (
            <div className="alert warn" style={{ fontSize: ".92rem" }}>
              <b>Gaan self na oor die hele werkboek:</b>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {result.algemeen_kontroleer.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {photos.length ? (
        <details className="pv-acc no-print" style={{ marginBottom: 16 }}>
          <summary>
            <span className="t">Foto’s van die groep ({photos.length}): {seenPhotos ? `die KI het ${seenPhotos} gesien; gaan dit ook self na` : "die KI het dit nie gesien nie, gaan dit self na"}</span>
          </summary>
          <div className="body">
            <div className="photos">
              {photos.map((p) => (
                <figure className="photo" key={p.id} style={{ margin: 0 }}>
                  <a href={`/api/fotos/${p.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/fotos/${p.id}`} alt={p.caption ?? "Foto"} loading="lazy" />
                  </a>
                  <figcaption className="cap">
                    WB{p.sheet.replace(/\D/g, "")}
                    {p.caption ? ` · ${p.caption}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </details>
      ) : null}

      <AssesseringVorm
        key={`${assessment?.id ?? "geen"}:${mark?.updatedAt.getTime() ?? 0}`}
        rubric={rubric}
        groupId={groep}
        assessmentId={assessment?.id ?? null}
        ai={result?.kriteria ?? []}
        aiTotal={assessment?.aiTotal ?? null}
        initial={(mark?.scores ?? {}) as Record<string, ScoreEntry>}
        comment={mark?.comment ?? ""}
        assessors={mark?.assessors ?? ""}
        status={mark?.status ?? null}
      />

      {history.length ? (
        <details className="pv-acc no-print" style={{ marginTop: 16 }}>
          <summary>
            <span className="t">Geskiedenis van die punt ({history.length})</span>
          </summary>
          <div className="body">
            <ul className="versions">
              {history
                .slice()
                .reverse()
                .map((h, i) => (
                  <li key={i}>
                    <span className="muted">{fmtWhen(h.at)}</span>
                    <b>{h.total}/50</b> <span>{h.action} deur {h.by}</span>
                  </li>
                ))}
            </ul>
          </div>
        </details>
      ) : null}

      {assessment ? (
        <details className="pv-acc no-print" style={{ marginTop: 16 }}>
          <summary>
            <span className="t">Presies wat die KI gelees het</span>
          </summary>
          <div className="body">
            <pre style={{ whiteSpace: "pre-wrap", fontSize: ".82rem", margin: 0, maxHeight: 480, overflow: "auto" }}>{assessment.inputText}</pre>
          </div>
        </details>
      ) : null}
    </div>
  );
}
