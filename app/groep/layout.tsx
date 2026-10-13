import Link from "next/link";
import Bo from "@/components/Bo";
import { groupLogout } from "@/app/actions";
import { requireGroup } from "@/lib/sessie";

export default async function GroepLayout({ children }: { children: React.ReactNode }) {
  const group = await requireGroup();
  return (
    <>
      <Bo title="VOL-projek" subtitle={`${group.name ?? "Ons groep"}${group.klas ? ` · ${group.klas}` : ""} · ${group.project.title}`} home="/groep">
        <Link href="/groep">Werkboek</Link>
        <Link href="/groep/druk">Druk</Link>
        <form action={groupLogout}>
          <button type="submit">Meld af</button>
        </form>
      </Bo>
      <main>{children}</main>
    </>
  );
}
