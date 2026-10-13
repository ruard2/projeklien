import DrukWerkboek from "@/components/DrukWerkboek";
import { requireGroup } from "@/lib/sessie";

export const metadata = { title: "Druk werkboek" };

export default async function GroepDruk() {
  const g = await requireGroup();
  return <DrukWerkboek groupId={g.id} />;
}
