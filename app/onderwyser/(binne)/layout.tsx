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
  const openRuleChanges = isAdminRole(t.role) ? await db.aiRuleEvent.count({ where: { schoolId: t.schoolId, reviewedAt: null } }) : 0;
  return (
    <>
      <Bo title="VOL · Onderwyser" subtitle={`${t.name} · ${t.school.name}`} home="/onderwyser">
        <BoKieslys
          primary={
            <>
              <Link href="/onderwyser">Groepe</Link>
              <Link href="/onderwyser/ki">KI oplei{openRuleChanges ? ` (${openRuleChanges})` : ""}</Link>
              {teacherReportCount ? <Link href="/onderwyser/ki-verslae">Leerderverslae ({teacherReportCount})</Link> : null}
              {reviewer ? <Link href="/onderwyser/toesig">Toesig{newCount ? ` (${newCount})` : ""}</Link> : null}
            </>
          }
          more={
            <>
              <div className="tm-h">Groepe</div>
              <Link href="/onderwyser">Alle groepe</Link>
              <Link href="/onderwyser/groepe">Groepkodes skep en bestuur</Link>
              <Link href="/onderwyser/kriteria">Kriteria per werkblad</Link>
              <div className="tm-h">KI oplei</div>
              <Link href="/onderwyser/ki-reels">KI-reëls</Link>
              <Link href="/onderwyser/pdf-vergelyking">KI beoordeel (juf vs KI)</Link>
              <Link href="/onderwyser/ki-verslae">Leerderverslae oor KI{teacherReportCount ? ` (${teacherReportCount})` : ""}</Link>
              {reviewer ? <Link href="/onderwyser/evaluasies">KI-toetse</Link> : null}
              {reviewer ? (
                <>
                  <div className="tm-h">Toesig</div>
                  {isAdminRole(t.role) ? <Link href="/onderwyser/aktiwiteit">Aktiwiteit{openRuleChanges ? ` (${openRuleChanges})` : ""}</Link> : null}
                  <Link href="/onderwyser/terugvoer">Ontwikkelaarterugvoer{developerFeedbackCount ? ` (${developerFeedbackCount})` : ""}</Link>
                  {isAdminRole(t.role) ? <Link href="/onderwyser/beheer">Bestuur (projekte, onderwysers)</Link> : null}
                </>
              ) : null}
              <div className="tm-h">Jy</div>
              <Link href="/onderwyser/my-terugvoer">My terugvoer aan die ontwikkelaar</Link>
              <form action={teacherLogout}>
                <button type="submit">Meld af</button>
              </form>
              <hr />
              <Link className="tm-dev" href="/onderwyser/ontwikkel">🧪 Ontwikkelfunksies (tydelik)</Link>
            </>
          }
        />
      </Bo>
      <main>{children}</main>
      <TerugvoerKnoppie />
    </>
  );
}
