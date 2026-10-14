import Link from "next/link";
import Bo from "@/components/Bo";
import { TerugvoerKnoppie } from "@/components/OntwikkelaarTerugvoer";
import { teacherLogout } from "@/app/actions";
import { requireTeacher } from "@/lib/sessie";

export default async function OnderwyserLayout({ children }: { children: React.ReactNode }) {
  const t = await requireTeacher();
  return (
    <>
      <Bo title="VOL · Onderwyser" subtitle={`${t.name} · ${t.school.name}`} home="/onderwyser">
        <Link href="/onderwyser">Groepe</Link>
        <Link href="/onderwyser/groepe">Groepkodes</Link>
        <Link href="/onderwyser/kriteria">Kriteria</Link>
        {t.role === "ADMIN" ? <Link href="/onderwyser/beheer">Bestuur</Link> : null}
        {t.role === "ADMIN" ? <Link href="/onderwyser/terugvoer">Terugvoer</Link> : null}
        <form action={teacherLogout}>
          <button type="submit">Meld af</button>
        </form>
      </Bo>
      <main>{children}</main>
      <TerugvoerKnoppie />
    </>
  );
}
