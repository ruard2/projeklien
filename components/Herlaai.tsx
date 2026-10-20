"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Herlaai die bladsy elke paar sekondes terwyl die bediener nog werk. */
export default function Herlaai({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
