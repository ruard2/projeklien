import { NextResponse } from "next/server";
import { DiensFout } from "./diens";

export function fout(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Vang DiensFout op en gee ’n nette JSON-fout terug. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DiensFout) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error("[api]", e);
    return fout("Iets het verkeerd geloop. Probeer asseblief weer.", 500);
  }
}
