import Link from "next/link";
import { db } from "@/lib/db";
import { canReviewFeedback, isAdminRole, requireTeacher } from "@/lib/sessie";

export const metadata = { title: "KI oplei" };

export default async function KiOplei() {
  const t = await requireTeacher();
  const [rules, globalRules, comparisons, openVotes, reports, changes] = await Promise.all([
    db.aiRule.count({ where: { schoolId: t.schoolId, active: true, deletedAt: null } }),
    db.aiRule.count({ where: { schoolId: t.schoolId, active: true, deletedAt: null, templateKey: "*" } }),
    db.pdfComparison.count({ where: { schoolId: t.schoolId, status: "klaar", ...(t.role === "TEACHER" ? { teacherId: t.id } : {}) } }),
    db.pdfVote.count({ where: { teacherId: t.id, vote: -1, ruleId: null } }),
    db.aiReport.count({ where: { schoolId: t.schoolId, status: "nuut" } }),
    isAdminRole(t.role) ? db.aiRuleEvent.count({ where: { schoolId: t.schoolId, reviewedAt: null } }) : Promise.resolve(0)
  ]);
  return (
    <div className="container">
      <h1>KI oplei</h1>
      <p className="muted" style={{ maxWidth: "80ch" }}>
        Die KI gee die leerders terugvoer op elke werkblad. Hier maak jy dit beter: kyk of die KI sê wat jy sou sê, gee 👍/👎, en voeg reëls by. Reëls geld dadelik vir alle groepe.
      </p>
      <div className="hub">
        <Link href="/onderwyser/ki-reels">
          <b>📏 KI-reëls ({rules} aktief)</b>
          <span>Die reëls waarvolgens die KI beoordeel: {globalRules} algemene “gees”-reëls vir alle werkboeke, die res per werkboek of werkblad.</span>
        </Link>
        <Link href="/onderwyser/pdf-vergelyking">
          <b>⚖️ KI beoordeel ({comparisons})</b>
          <span>Jou kommentaar langs dié van die KI, per werkblad. 👍/👎 en praat met die KI oor wat beter moet.{openVotes ? ` ${openVotes} keer 👎 sonder reël.` : ""}</span>
        </Link>
        <Link href="/onderwyser/ki-verslae">
          <b>🚩 Leerderverslae{reports ? ` (${reports} nuut)` : ""}</b>
          <span>KI-antwoorde wat leerders as verkeerd of onvanpas gerapporteer het.</span>
        </Link>
        {isAdminRole(t.role) ? (
          <Link href="/onderwyser/aktiwiteit">
            <b>👁 Reëlveranderinge nagaan{changes ? ` (${changes})` : ""}</b>
            <span>Elke reël wat bygevoeg, verander of geskrap is, om na te gaan of terug te draai.</span>
          </Link>
        ) : null}
        {canReviewFeedback(t.role) ? (
          <Link href="/onderwyser/evaluasies">
            <b>🧪 KI-toetse</b>
            <span>Werklike gevalle uit terugvoer waarmee nuwe KI-weergawes getoets word.</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
