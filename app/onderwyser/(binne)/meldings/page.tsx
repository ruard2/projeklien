import Link from "next/link";
import KiVerslae from "../ki-verslae/page";
import MyTerugvoer from "../my-terugvoer/page";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/sessie";

export const metadata = { title: "Meldings" };

export default async function Meldings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const t = await requireTeacher();
  const { tab } = await searchParams;
  const [reports, replies] = await Promise.all([
    db.aiReport.count({ where: { schoolId: t.schoolId, status: "nuut" } }),
    db.devFeedback.count({ where: { teacherId: t.id, developerReply: { not: null } } })
  ]);
  const mine = tab === "my";
  return (
    <>
      <div className="container narrow" style={{ paddingBottom: 0 }}>
        <h1 style={{ marginBottom: 8 }}>Meldings</h1>
        <div className="tabs">
          <Link href="/onderwyser/meldings" className={!mine ? "on" : ""}>Leerders oor die KI{reports ? ` (${reports} nuut)` : ""}</Link>
          <Link href="/onderwyser/meldings?tab=my" className={mine ? "on" : ""}>My terugvoer aan die ontwikkelaar{replies ? ` (${replies} antwoord)` : ""}</Link>
        </div>
      </div>
      {mine ? <MyTerugvoer /> : <KiVerslae />}
    </>
  );
}
