import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidence, hasWork, normaliseAssessment, quoteFound, type EvidenceInput } from "../lib/assessering/ki";
import { csvCell, parseScores, workbookHash } from "../lib/assessering/diens";
import { isValidScore, levelForScore, RUBRIEK_A, rubricFor, totalOf } from "../lib/assessering/rubriek";
import { getTemplate } from "../lib/werkboeke/sjablone";

const valid = (over: Partial<{ id: string; punt: number }>[] = []) => ({
  samevatting: "Oorsig.",
  algemeen_kontroleer: [],
  kriteria: ["k1", "k2", "k3", "k4", "k5"].map((id, i) => ({
    id,
    punt: 7,
    sekerheid: "hoog",
    motivering: "Rede.",
    waarom_nie_hoer: "Iets.",
    bewyse: [],
    kontroleer: [],
    ...(over[i] ?? {})
  }))
});

function input(over: Partial<EvidenceInput> = {}): EvidenceInput {
  return {
    template: getTemplate("vol-gr8-natuurbewaring"),
    project: { phenomenon: "Natuurbewaring", question: "Hoe kan ons rentmeesters wees van God se skepping?", partner: "Vriende van die Magalies", grade: 8 },
    responses: [],
    members: ["Anke", "Pieter", "", ""],
    photos: [],
    checkpoints: [],
    paperImport: false,
    ...over
  };
}

test("die rubriek het presies die skool se vyf kriteria, 50 punte en vaste bande", () => {
  assert.equal(RUBRIEK_A.total, 50);
  assert.equal(RUBRIEK_A.criteria.length, 5);
  assert.equal(RUBRIEK_A.criteria.reduce((s, c) => s + c.max, 0), 50);
  for (const c of RUBRIEK_A.criteria) {
    assert.deepEqual(c.levels.map((l) => l.band), ["9–10", "7–8", "5–6", "0–4"]);
    assert.deepEqual(c.levels.map((l) => l.label), ["Uitstekend", "Goed", "Ontwikkelend", "Beperkte bewys"]);
    for (let score = 0; score <= 10; score++) assert.ok(levelForScore(RUBRIEK_A, c.id, score));
  }
  assert.equal(rubricFor("vol-gr9-haweloosheid").key, "afd-a");
});

test("die vlak volg uit die punt by elke bandgrens", () => {
  const cases: [number, number][] = [[0, 1], [4, 1], [5, 2], [6, 2], [7, 3], [8, 3], [9, 4], [10, 4]];
  for (const [score, level] of cases) assert.equal(levelForScore(RUBRIEK_A, "k1", score).level, level);
  assert.throws(() => levelForScore(RUBRIEK_A, "k1", 11));
});

test("die totaal word bereken, ongeag wat die KI sê", () => {
  const out = normaliseAssessment(RUBRIEK_A, { ...valid(), totaal: 50 }, "x");
  assert.equal(out.totaal, 35);
  assert.equal(out.kriteria[0].vlak, 3);
  assert.equal(totalOf({ k1: 10, k2: 9, k3: 8, k4: 7, k5: 6 }, RUBRIEK_A), 40);
  assert.equal(isValidScore(7.5), false);
});

test("’n ontbrekende, dubbele of ongeldige punt word geweier, nie aangevul nie", () => {
  const missing = valid();
  missing.kriteria.pop();
  assert.throws(() => normaliseAssessment(RUBRIEK_A, missing, "x"));
  const double = valid([{}, { id: "k1" }]);
  assert.throws(() => normaliseAssessment(RUBRIEK_A, double, "x"));
  assert.throws(() => normaliseAssessment(RUBRIEK_A, valid([{ punt: 11 }]), "x"));
});

test("aanhalings word teen die werkboek nagegaan", () => {
  const evidence = "=== WB3 ===\nHoe kan ons   rommel langs die roete verminder?";
  assert.equal(quoteFound("hoe kan ons rommel langs die roete verminder?", evidence), true);
  assert.equal(quoteFound("Hoe kan ons die hele berg red?", evidence), false);
  assert.equal(quoteFound("   ", evidence), false);
  const raw = valid();
  (raw.kriteria[0].bewyse as unknown[]) = [{ werkblad: "WB3", aanhaling: "die hele berg red" }];
  assert.equal(normaliseAssessment(RUBRIEK_A, raw, evidence).kriteria[0].bewyse[0].gevind, false);
});

test("bewyse bevat geen name, kontakbesonderhede of foto’s nie", () => {
  const text = buildEvidence(
    input({
      responses: [
        { sheet: "ws1", data: { rolle: { projekleier: { naam: "Anke" } }, groepreels: ["Pieter maak die notas", "Bel 082 123 4567", "anke@skool.co.za"] } },
        { sheet: "ws8", data: {}, teacherNotes: { onderwyser: { text: "Pieter moet hierna kyk", by: "Mev. Botha", at: "2026-10-01" } } }
      ],
      photos: [{ sheet: "ws2", field: "fotos", caption: "Anke by die rommel" }],
      checkpoints: [{ number: 3, status: "APPROVED" }]
    })
  );
  for (const banned of ["Anke", "Pieter", "082 123", "skool.co.za", "Botha"]) assert.ok(!text.includes(banned), banned);
  assert.ok(text.includes("Lid 1"));
  assert.match(text, /1 foto/);
  assert.match(text, /Kontrolepunt 3: afgeteken/);
  assert.match(text, /WB14/);
  assert.ok(!text.includes("WB15"));
});

test("werkblad 15 en ’n leë groep tel nie as werk nie", () => {
  assert.equal(hasWork(input()), false);
  assert.equal(hasWork(input({ responses: [{ sheet: "ws15:1", data: { rol: "x" } }] })), false);
  assert.equal(hasWork(input({ responses: [{ sheet: "ws3", data: { groot: "x" } }] })), true);
  assert.equal(hasWork(input({ photos: [{ sheet: "ws2", field: "fotos", caption: null }] })), true);
});

test("die vingerafdruk let net op werkblad 1–14", () => {
  const a = workbookHash([{ sheet: "ws3", data: { groot: "x" } }]);
  assert.equal(a, workbookHash([{ sheet: "ws3", data: { groot: "x" } }, { sheet: "ws15:1", data: { rol: "y" } }]));
  assert.notEqual(a, workbookHash([{ sheet: "ws3", data: { groot: "z" } }]));
});

test("die onderwyser se punte word streng gelees", () => {
  const ok = { punt_k1: "10", punt_k2: "0", punt_k3: "7", punt_k4: "5", punt_k5: "9", nota_k1: " goed " };
  const parsed = parseScores(RUBRIEK_A, ok);
  assert.deepEqual(parsed.k1, { punt: 10, nota: "goed" });
  assert.deepEqual(parsed.k2, { punt: 0 });
  for (const bad of ["11", "-1", "7.5", "", "abc"]) assert.throws(() => parseScores(RUBRIEK_A, { ...ok, punt_k3: bad }));
});

test("CSV kan nie formules uit leerdersteks uitvoer nie", () => {
  assert.equal(csvCell("=1+1"), `"'=1+1"`);
  assert.equal(csvCell('sê "hallo"'), `"sê ""hallo"""`);
  assert.equal(csvCell(null), `""`);
  assert.equal(csvCell(35), `"35"`);
});
