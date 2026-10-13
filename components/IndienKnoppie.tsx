"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function IndienKnoppie({ n }: { n: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn ok sm"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Dien kontrolepunt ${n} in? Die werkblaaie word gesluit totdat die onderwyser dit nagegaan het.`)) return;
        setBusy(true);
        const res = await fetch(`/api/kontrolepunt/${n}`, { method: "POST" });
        setBusy(false);
        if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? "Indien het misluk.");
        router.refresh();
      }}
    >
      {busy ? <span className="spinner" /> : null} Dien in vir aftekening
    </button>
  );
}
