"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Bo-kieslys: belangrikste skakels sigbaar op ’n groot skerm, die res onder “Meer”.
 * Op ’n foon is alles onder één “☰ Kieslys”-knoppie.
 */
export default function BoKieslys({ primary, more, label = "Meer" }: { primary: React.ReactNode; more: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <>
      <div className="tm-primary">{primary}</div>
      <div className="tm" ref={ref}>
        <button type="button" className="tm-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          ☰ <span className="tm-l-desk">{label}</span><span className="tm-l-mob">Kieslys</span>
        </button>
        {open ? (
          <div className="tm-panel" role="menu">
            <div className="tm-mobile">
              {primary}
              <hr />
            </div>
            {more}
          </div>
        ) : null}
      </div>
    </>
  );
}
