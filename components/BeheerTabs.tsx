import Link from "next/link";

/** Tabs bo-aan die beheerbladsye (net vir administrateurs). */
export default function BeheerTabs({ on, open = 0 }: { on: "bestuur" | "aktiwiteit"; open?: number }) {
  return (
    <div className="tabs" style={{ marginBottom: 16 }}>
      <Link href="/onderwyser/beheer" className={on === "bestuur" ? "on" : ""}>Onderwysers en projekte</Link>
      <Link href="/onderwyser/aktiwiteit" className={on === "aktiwiteit" ? "on" : ""}>Aktiwiteit{open ? ` (${open} om na te gaan)` : ""}</Link>
    </div>
  );
}
