"use client";

import { useActionState } from "react";
import { groupLogin, teacherLogin, type FormState } from "@/app/actions";

export function GroepAanmeld() {
  const [state, action, pending] = useActionState<FormState, FormData>(groupLogin, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <label className="lbl" htmlFor="code" style={{ textAlign: "left" }}>
        Groepkode
      </label>
      <input id="code" name="code" type="text" className="code-input" placeholder="G9-XXXXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
      {state?.error ? <div className="alert err">{state.error}</div> : null}
      <button className="btn primary lg" disabled={pending}>
        {pending ? <span className="spinner" /> : null} Open ons werkboek
      </button>
    </form>
  );
}

export function OnderwyserAanmeld({ na }: { na?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(teacherLogin, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: 14, textAlign: "left" }}>
      {na ? <input type="hidden" name="na" value={na} /> : null}
      <div>
        <label className="lbl" htmlFor="email">
          E-pos
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div>
        <label className="lbl" htmlFor="password">
          Wagwoord
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error ? <div className="alert err">{state.error}</div> : null}
      <button className="btn primary lg" disabled={pending}>
        {pending ? <span className="spinner" /> : null} Meld aan
      </button>
    </form>
  );
}
