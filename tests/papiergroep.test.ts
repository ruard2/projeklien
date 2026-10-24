import assert from "node:assert/strict";
import test from "node:test";
import { initials, paperApprovedCheckpoints, paperGroupName } from "../lib/pdf-vergelyking/papier";
import type { Extracted, ExtractedSheet } from "../lib/pdf-vergelyking/skema";
import { volGr9Haweloosheid } from "../lib/werkboeke/sjablone";
import { sheetAccess } from "../lib/werkboeke/toegang";

const sheet = (signed = false): ExtractedSheet =>
  ({ data: {}, foto: false, onseker: [], juf: { kommentaar: [], kommentaar_vorige: [], afgeteken: signed, afteken_datum: "" } }) as unknown as ExtractedSheet;

function paper(signed: string[], upTo = 8): Extracted {
  const sheets: Record<string, ExtractedSheet> = {};
  for (let i = 1; i <= upTo; i++) sheets[`ws${i}`] = sheet(signed.includes(`ws${i}`));
  return { groepnaam: "", klas: "9V", lede: ["Imarie Linde", "anli", "L.J", "Duné"], sheets };
}

test("groepnaam: eie naam, anders voorletters", () => {
  assert.equal(initials(["Imarie Linde", "anli", "L.J", "Duné"]), "IALD");
  assert.equal(paperGroupName(paper([])), "IALD");
  assert.equal(paperGroupName({ ...paper([]), groepnaam: "Tiki Tiki" }), "Tiki Tiki");
});

test("kontrolepunte soos op papier afgeteken, in volgorde", () => {
  const key = volGr9Haweloosheid.key;
  assert.deepEqual(paperApprovedCheckpoints(key, paper(["ws3", "ws5", "ws8"])), [1, 2, 3]);
  assert.deepEqual(paperApprovedCheckpoints(key, paper(["ws3", "ws8"])), [1]);
  assert.deepEqual(paperApprovedCheckpoints(key, paper(["ws3", "ws5", "ws8"], 7)), [1, 2]);
});

test("papiergroep: afgeteken = volgende oop, maar steeds bewerkbaar", () => {
  const t = volGr9Haweloosheid;
  const cps = [1, 2, 3].map((number) => ({ number, status: "APPROVED" as const }));
  const ws5 = t.sheets.find((s) => s.key === "ws5")!;
  const ws9 = t.sheets.find((s) => s.key === "ws9")!;
  assert.equal(sheetAccess(ws5, cps).editable, false);
  assert.equal(sheetAccess(ws5, cps, { paperImport: true }).editable, true);
  assert.equal(sheetAccess(ws9, cps, { paperImport: true }).unlocked, true);
  assert.equal(sheetAccess(ws9, cps.slice(0, 2), { paperImport: true }).unlocked, false);
});
