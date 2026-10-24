import Link from "next/link";
import { db } from "@/lib/db";
import { requireFeedbackReviewer } from "@/lib/sessie";

export const metadata = { title: "Toesig" };

export default async function Toesig() {
  const t = await requireFeedbackReviewer();
  const [changes, devNew, reports, teachers] = await Promise.all([
    db.aiRuleEvent.count({ where: { schoolId: t.schoolId, reviewedAt: null } }),
    db.devFeedback.count({ where: { schoolId: t.schoolId, status: "nuut" } }),
    db.aiReport.count({ where: { schoolId: t.schoolId, status: "nuut" } }),
    db.teacher.count({ where: { schoolId: t.schoolId } })
  ]);
  return (
    <div className="container">
      <h1>Toesig</h1>
      <p className="muted" style={{ maxWidth: "80ch" }}>Vir die administrateur: wat onderwysers en die KI doen, terugvoer oor die program, en die opstelling van projekte en rekeninge.</p>
      <div className="hub">
        <Link href="/onderwyser/aktiwiteit">
          <b>👁 Aktiwiteit{changes ? ` (${changes} om na te gaan)` : ""}</b>
          <span>Tydlyn van alles wat onderwysers doen, met KI-reëlveranderinge om na te gaan of terug te draai.</span>
        </Link>
        <Link href="/onderwyser/terugvoer">
          <b>💬 Ontwikkelaarterugvoer{devNew + reports ? ` (${devNew + reports} nuut)` : ""}</b>
          <span>Terugvoer van onderwysers en leerders oor die KI en die program.</span>
        </Link>
        <Link href="/onderwyser/beheer">
          <b>⚙️ Bestuur</b>
          <span>Projekte en onderwyserrekeninge ({teachers}).</span>
        </Link>
      </div>
    </div>
  );
}
