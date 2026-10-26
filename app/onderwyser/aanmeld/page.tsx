import Link from "next/link";
import { redirect } from "next/navigation";
import { OnderwyserAanmeld } from "@/components/AanmeldVorm";
import { currentTeacher } from "@/lib/sessie";

export const metadata = { title: "Onderwyser" };

/** Net interne paaie, nooit ’n ander webwerf nie. */
function safeNext(v?: string) {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : undefined;
}

export default async function OnderwyserAanmeldBladsy({ searchParams }: { searchParams: Promise<{ na?: string }> }) {
  const na = safeNext((await searchParams).na);
  if (await currentTeacher()) redirect(na ?? "/onderwyser");
  return (
    <div className="hero">
      <div className="hero-card">
        <img className="crest" src="/wapen.png" alt="Wapen van die Gereformeerde Hoërskool Dirk Postma" />
        <div className="kicker">VOL-projek</div>
        <h1>Onderwyser</h1>
        <p className="sub">Volg groepe se vordering, lees die KI-terugvoer en teken kontrolepunte af.</p>
        <div className="card">
          <OnderwyserAanmeld na={na} />
        </div>
        <p style={{ marginTop: 18, fontSize: ".9rem" }}>
          <Link href="/">← Aanmelding vir groepe</Link>
        </p>
      </div>
    </div>
  );
}
