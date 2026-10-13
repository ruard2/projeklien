import Link from "next/link";
import { redirect } from "next/navigation";
import { GroepAanmeld } from "@/components/AanmeldVorm";
import { currentGroup } from "@/lib/sessie";

export default async function Tuis() {
  if (await currentGroup()) redirect("/groep");
  return (
    <div className="hero">
      <div className="hero-card">
        <img className="crest" src="/wapen.png" alt="Wapen van die Gereformeerde Hoërskool Dirk Postma" />
        <div className="kicker">Gereformeerde Hoërskool Dirk Postma</div>
        <h1>VOL-projek</h1>
        <p className="sub">Verskynselgebaseerde Ondersoekende Leer: van ’n werklike verskynsel na verantwoordelike optrede.</p>
        <div className="card" style={{ textAlign: "left" }}>
          <GroepAanmeld />
        </div>
        <p style={{ marginTop: 18, fontSize: ".9rem" }}>
          <Link href="/onderwyser/aanmeld">Aanmelding vir onderwysers →</Link>
        </p>
      </div>
    </div>
  );
}
