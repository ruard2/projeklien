import { notFound } from "next/navigation";
import DrukWerkboek from "@/components/DrukWerkboek";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/sessie";

export default async function OnderwyserDruk({ params }: { params: Promise<{ id: string }> }) {
  const t = await requireTeacher();
  const { id } = await params;
  const g = await db.group.findFirst({ where: { id, project: { schoolId: t.schoolId } }, select: { id: true } });
  if (!g) notFound();
  return <DrukWerkboek groupId={g.id} />;
}
