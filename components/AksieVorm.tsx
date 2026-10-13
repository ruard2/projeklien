"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/onderwyser/actions";

/** Klein vorm-omhulsel vir bediener-aksies met fout- en sukses-boodskappe. */
export default function AksieVorm({
  action,
  children,
  submit,
  variant = "primary",
  confirmText,
  className,
  style
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submit: string;
  variant?: "primary" | "ok" | "danger" | "plain";
  confirmText?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form
      action={run}
      className={className}
      style={{ display: "grid", gap: 10, ...style }}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
      <div className="btn-row">
        <button className={`btn ${variant === "plain" ? "" : variant}`} disabled={pending}>
          {pending ? <span className={`spinner ${variant === "plain" || variant === "danger" ? "dark" : ""}`} /> : null} {submit}
        </button>
      </div>
      {state?.error ? <div className="alert err">{state.error}</div> : null}
      {state?.ok ? <div className="alert ok">{state.ok}</div> : null}
    </form>
  );
}
