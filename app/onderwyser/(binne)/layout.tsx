import Link from "next/link";
import Bo from "@/components/Bo";
import BoKieslys from "@/components/BoKieslys";
import { TerugvoerKnoppie } from "@/components/OntwikkelaarTerugvoer";
import { teacherLogout } from "@/app/actions";
import { db } from "@/lib/db";
import { canReviewFeedback, isAdminRole, requireTeacher } from "@/lib/sessie";

export default async function OnderwyserLayout({ children }: { children: React.ReactNode }) {
  const t = await requireTeacher();
  const reviewer = canReviewFeedback(t.role);
  const [teacherReportCount, developerFeedbackCount] = await Promise.all([
    db.aiReport.count({ where: { schoolId: t.schoolId, status: "nuut" } }),
    reviewer ? db.devFeedback.count({ where: { schoolId: t.schoolId, status: "nuut" } }) : Promise.resolve(0)
  ]);
  const newCount = teacherReportCount + developerFeedbackCount;
  return (
    <>
      <Bo title="VOL · Onderwyser" subtitle={`${t.name} · ${t.school.name}`} home="/onderwyser">
        <BoKieslys
          primary={
            <>
              <Link href="/onderwyser">Groepe</Link>
              <Link href="/onderwyser/pdf-vergelyking">PDF-vergelyking</Link>
              <Link href="/onderwyser/ki-verslae">KI-verslae{teacherReportCount ? ` (${teacherReportCount})` : ""}</Link>
              {reviewer ? <Link href="/onderwyser/terugvoer">Terugvoer{newCount ? ` (${newCount})` : ""}</Link> : null}
            </>
          }
          more={
            <>
              <Link href="/onderwyser/groepe">Groepkodes</Link>
              <Link href="/onderwyser/kriteria">Kriteria</Link>
              <Link href="/onderwyser/ki-reels">KI-reëls</Link>
              <Link href="/onderwyser/my-terugvoer">My terugvoer</Link>
              {reviewer ? <Link href="/onderwyser/evaluasies">KI-toetse</Link> : null}
              {isAdminRole(t.role) ? <Link href="/onderwyser/beheer">Bestuur</Link> : null}
              <hr />
              <form action={teacherLogout}>
                <button type="submit">Meld af</button>
              </form>
            </>
          }
        />
      </Bo>
      <main>{children}</main>
      <TerugvoerKnoppie />
    </>
  );
}
