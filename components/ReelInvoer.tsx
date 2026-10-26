"use client";

import { useActionState } from "react";
import { importRules, type ImportState } from "@/app/onderwyser/reel-aksies";

export default function ReelInvoer() {
  const [state, run, pending] = useActionState<ImportState, FormData>(importRules, undefined);
  return (
    <form action={run} style={{ display: "grid", gap: 10 }}>
      <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
        Elke reël word dadelik aktief en in die ouditspoor as “Ingevoer uit lêer” aangeteken. Bestaande reëls met presies dieselfde teks word oorgeslaan. Staan daar <code>"modus": "vervang"</code> in die lêer, is dit die volledige stel vir daardie werkboek: ander aktiewe reëls word geskrap (herstelbaar).
      </p>
      <input type="file" name="file" accept="application/json,.json" required />
      <div className="btn-row"><button className="btn sm primary" disabled={pending}>{pending ? <span className="spinner" /> : null} Voer in</button></div>
      {state?.error ? <div className="alert err">{state.error}</div> : null}
      {state?.ok ? <div className="alert ok">{state.ok}</div> : null}
    </form>
  );
}
