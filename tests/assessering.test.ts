import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { assessmentMessages, assessmentSystemPrompt, assessWorkbook, buildEvidence, hasWork, MAX_ASSESS_PHOTOS, normaliseAssessment, photosToShow, quoteFound, type EvidenceInput } from "../lib/assessering/ki";
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

const image = { sheet: "ws10", caption: "Anke by die rommel", mime: "image/jpeg", bytes: Buffer.from("foto") };

test("foto’s gaan net na die KI as hulle uitdruklik saamgestuur word", () => {
  const without = assessmentMessages(RUBRIEK_A, input(), "werkboek", []);
  assert.equal(typeof without[1].content, "string");
  assert.match(String(without[0].content), /nie aan jou gewys nie/);

  const withPhoto = assessmentMessages(RUBRIEK_A, input(), "werkboek", [image]);
  const parts = withPhoto[1].content as { type: string; text?: string; image_url?: { url: string } }[];
  assert.equal(parts.filter((p) => p.type === "image_url")[0].image_url?.url, `data:image/jpeg;base64,${image.bytes.toString("base64")}`);
  assert.ok(parts.some((p) => p.text?.startsWith("Foto 1 (WB10)")));
  assert.ok(!JSON.stringify(parts).includes("Anke"), "byskrifte word steeds geanonimiseer");
  assert.match(String(withPhoto[0].content), /Beskryf of identifiseer nooit mense nie/);
});

test("die KI weet as dit nie al die foto’s gesien het nie", () => {
  const photos = [{ sheet: "ws2", field: "f", caption: null }, { sheet: "ws10", field: "f", caption: null }, { sheet: "ws15:1", field: "f", caption: null }];
  assert.match(assessmentSystemPrompt(RUBRIEK_A, input({ photos }), 1), /net 1 van die 2 foto/);
  assert.doesNotMatch(assessmentSystemPrompt(RUBRIEK_A, input({ photos }), 2), /van die 2 foto/);
});

test("slegs foto’s van werkblad 1–14 word gekies, in volgorde en binne die perke", () => {
  const picked = photosToShow([{ sheet: "ws15:1", size: 1 }, { sheet: "ws10", size: 1 }, { sheet: "ws2", size: 1 }]);
  assert.deepEqual(picked.map((p) => p.sheet), ["ws2", "ws10"]);
  assert.equal(photosToShow(Array.from({ length: 40 }, () => ({ sheet: "ws2", size: 1 }))).length, MAX_ASSESS_PHOTOS);
  assert.equal(photosToShow(Array.from({ length: 5 }, () => ({ sheet: "ws2", size: 10 * 1024 * 1024 }))).length, 3);
});

test("die versoek met foto’s bereik die API en die antwoord word verwerk", async () => {
  let received: { messages: { content: unknown }[] } | undefined;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      received = JSON.parse(body);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: "x", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(valid()) } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  process.env.OPENAI_API_KEY = "toets";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  try {
    const { result } = await assessWorkbook(RUBRIEK_A, input(), "werkboek", [image]);
    assert.equal(result.fotos_gesien, 1);
    assert.equal(result.totaal, 35);
    assert.ok(JSON.stringify(received?.messages[1].content).includes("data:image/jpeg;base64,"));
  } finally {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    server.close();
  }
});
