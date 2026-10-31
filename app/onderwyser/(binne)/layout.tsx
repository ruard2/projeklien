import Link from "next/link";
import Bo from "@/components/Bo";
import BoKieslys from "@/components/BoKieslys";
import { TerugvoerKnoppie } from "@/components/OntwikkelaarTerugvoer";
import { teacherLogout } from "@/app/actions";
import { db } from "@/lib/db";
import { hasDeveloperView, isAdminRole, requireTeacher } from "@/lib/sessie";

export default async function OnderwyserLayout({ children }: { children: React.ReactNode }) {
  const t = await requireTeacher();
  const admin = isAdminRole(t.role);
  const [dev, reports, replies, openRuleChanges] = await Promise.all([
    hasDeveloperView(t),
    db.aiReport.count({ where: { schoolId: t.schoolId, status: "nuut" } }),
    db.devFeedback.count({ where: { teacherId: t.id, developerReply: { not: null }, respondedAt: { gt: new Date(Date.now() - 7 * 86400_000) } } }),
    admin ? db.aiRuleEvent.count({ where: { schoolId: t.schoolId, reviewedAt: null } }) : Promise.resolve(0)
  ]);
  const meldings = reports + replies;
  return (
    <>
      <Bo title="VOL · Onderwyser" subtitle={`${t.name} · ${t.school.name}`} home="/onderwyser">
        <BoKieslys
          primary={
            <>
              <Link href="/onderwyser">Groepe</Link>
              <Link href="/onderwyser/ki-reels">KI-reëls</Link>
              <Link href="/onderwyser/meldings">Meldings{meldings ? ` (${meldings})` : ""}</Link>
              {admin ? <Link href="/onderwyser/beheer" title="Beheer">⚙️ Beheer{openRuleChanges ? ` (${openRuleChanges})` : ""}</Link> : null}
              {dev ? <Link href="/onderwyser/ontwikkel" title="Ontwikkelaar">🧪 Ontwikkelaar</Link> : null}
            </>
          }
          more={
            <>
              <Link href="/onderwyser/groepe">Groepkodes skep en bestuur</Link>
              <Link href="/onderwyser/kriteria">Kriteria per werkblad</Link>
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
