import assert from "node:assert/strict";
import test from "node:test";
import { initials, paperApprovedCheckpoints, paperGroupName, pickPaperCandidates } from "../lib/pdf-vergelyking/papier";
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

test("dubbele oplaaie: een per groep, handmatig wen", () => {
  const key = volGr9Haweloosheid.key;
  const mk = (id: string, lede: string[], model: string | null, day: number, groupId: string | null = null) =>
    ({ id, templateKey: key, status: "klaar", model, createdAt: new Date(2026, 9, day), groupId, extracted: { ...paper([]), lede } });
  const iawd = ["Imarie Linde", "Anli Kruger", "Wilmie Venter", "Duné van der Walt"];
  const r = pickPaperCandidates([mk("a", iawd, "gpt-5.4", 20), mk("b", ["Imarie", "Anli", "Wilmie", "Dune"], "handmatig", 21), mk("c", iawd, "gpt-5.4", 23), mk("d", ["Jesca", "Inge", "Corli", "Annemé"], null, 21)], new Set());
  assert.deepEqual(r.picks.map((x) => x.id).sort(), ["b", "d"]);
  assert.equal(r.duplicates, 2);
  const r2 = pickPaperCandidates([mk("a", iawd, "gpt-5.4", 20, "g1"), mk("c", iawd, "gpt-5.4", 23)], new Set(["g1"]));
  assert.equal(r2.picks.length, 0);
});

test("invoer: ook dubbel gekodeer, enkele werkboek of ander omhulsel", async () => {
  const { parseImport } = await import("../lib/pdf-vergelyking/invoer");
  const wb = { werkboek: volGr9Haweloosheid.key, naam: "x", lede: ["A"], werkblaaie: { ws3: { data: { groot: "g" }, juf: {} } } };
  for (const raw of [{ werkboeke: [wb] }, [wb], wb, JSON.stringify({ werkboeke: [wb] }), { data: { werkboeke: [wb] } }, { werkboeke: { a: wb } }]) {
    assert.equal(parseImport(raw).length, 1);
  }
  assert.throws(() => parseImport({ reels: [] }), /ontvang: velde: reels/);
});
