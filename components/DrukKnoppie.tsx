"use client";

export default function DrukKnoppie() {
  return (
    <button className="btn primary" onClick={() => window.print()}>
      Druk / stoor as PDF
    </button>
  );
}
