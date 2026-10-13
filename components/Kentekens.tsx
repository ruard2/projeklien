import type { CheckpointStatus, SheetStatus } from "@prisma/client";

export function SheetBadge({ status, ready, locked }: { status: SheetStatus; ready: boolean; locked?: boolean }) {
  if (locked) return <span className="badge">Gesluit</span>;
  if (ready) return <span className="badge ok">Gereed vir onderwyser</span>;
  if (status === "NOT_STARTED") return <span className="badge plain">Nog nie begin nie</span>;
  return <span className="badge warn">Nog nie gereed nie</span>;
}

export function CpBadge({ status }: { status: CheckpointStatus }) {
  if (status === "APPROVED") return <span className="badge ok">Afgeteken</span>;
  if (status === "SUBMITTED") return <span className="badge wait">Wag vir aftekening</span>;
  if (status === "RETURNED") return <span className="badge red">Terug na groep</span>;
  return null;
}
