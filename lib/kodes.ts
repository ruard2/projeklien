import { randomInt } from "node:crypto";

// Sonder 0/O, 1/I/L: maklik om van ’n bord of papier af te lees.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** bv. "G9-K7MP3Q" */
export function newGroupCode(grade: number): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `G${grade}-${s}`;
}

export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^G(1[0-2]|[1-9])(?=[A-Z0-9]{6}$)/, "G$1-");
}
