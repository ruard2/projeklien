import assert from "node:assert/strict";
import test from "node:test";
import { extractionSchema, jufText, membersFrom, normaliseExtraction, photoCountsFor } from "../lib/pdf-vergelyking/skema";
import { volGr8Natuurbewaring, volGr9Haweloosheid } from "../lib/werkboeke/sjablone";
import { sheetToText } from "../lib/werkboeke/teks";

type Node = Record<string, unknown>;
function walk(n: Node, path: string, problems: string[]) {
  const t = n.type;
  if (t === "object" || (Array.isArray(t) && t.includes("object"))) {
    const props = (n.properties ?? {}) as Record<string, Node>;
    if (n.additionalProperties !== false) problems.push(`${path}: additionalProperties`);
    const req = (n.required ?? []) as string[];
    if (req.length !== Object.keys(props).length || !Object.keys(props).every((k) => req.includes(k))) problems.push(`${path}: required`);
    for (const [k, v] of Object.entries(props)) walk(v, `${path}.${k}`, problems);
  }
  if (n.items) walk(n.items as Node, `${path}[]`, problems);
}

test("uitlees-skema is geldig vir OpenAI se streng modus (Gr 8 en Gr 9)", () => {
  for (const t of [volGr8Natuurbewaring, volGr9Haweloosheid]) {
    const problems: string[] = [];
    walk(extractionSchema(t) as Node, t.key, problems);
    assert.deepEqual(problems, []);
  }
});

const raw = {
  groepnaam: "",
  klas: "Gr. 9S",
  lede: ["Imarie Linde", "Anli Kruger", "Wilmie Venter", "Duné van der Walt"],
  werkblaaie: {
    ws1: {
      gevind: true,
      antwoorde: {
        rolle: { projekleier: { naam: "Duné" }, navorser: { naam: "Wilmie" }, materiaal: { naam: "Anli" }, kommunikeerder: { naam: "Imarie" } },
        groepreels: ["Moenie die werk alleen doen nie.", " Sê betyds. ", "Help mekaar.", ""]
      },
      juf: { kommentaar: [], kommentaar_vorige: [], afgeteken: false, afteken_datum: "" },
      onseker: []
    },
    ws2: {
      gevind: true,
      antwoorde: { waarnemings: [{ gesien: "Mense het nie genoeg klere nie", waar: "Op straat", pla: "Klere is ’n behoefte" }, { gesien: "", waar: "", pla: "" }], fotos: true },
      juf: { kommentaar: ["Sluit aan by ondersoekvraag!"], kommentaar_vorige: [], afgeteken: false, afteken_datum: "" },
      onseker: []
    },
    ws5: {
      gevind: true,
      antwoorde: {
        idees: { "1": { idee: "Klere maak", voordele: "", nadele: "Duur" }, "2": { idee: "", voordele: "", nadele: "" }, "3": { idee: "Klere insamel", voordele: "", nadele: "" } },
        matriks: { tyd: { "1": 1, "2": 5, "3": 9 }, probleem: { "1": null, "2": 3, "3": 5 }, volhoubaar: { "1": 2, "2": 4, "3": 3 }, koste: { "1": 2, "2": 4, "3": 5 }, veilig: { "1": 5, "2": 5, "3": 5 }, meet: { "1": 4, "2": 1, "3": 4 } },
        keuse: "3",
        omdat: "Hoogste punte."
      },
      juf: { kommentaar: ["✓"], kommentaar_vorige: [], afgeteken: true, afteken_datum: "18/10/26" },
      onseker: []
    },
    ws6: { gevind: false, antwoorde: {}, juf: { kommentaar: [], kommentaar_vorige: [], afgeteken: false, afteken_datum: "" }, onseker: [] }
  }
};

test("uitlees word na app-data omgeskakel", () => {
  const t = volGr9Haweloosheid;
  const e = normaliseExtraction(t, raw);
  assert.deepEqual(Object.keys(e.sheets), ["ws1", "ws2", "ws5"]);
  assert.deepEqual(e.sheets.ws1.data.groepreels, ["Moenie die werk alleen doen nie.", "Sê betyds.", "Help mekaar."]);
  assert.equal((e.sheets.ws2.data.waarnemings as unknown[]).length, 1);
  assert.deepEqual(photoCountsFor(t, e, "ws2"), { fotos: 1 });
  const m = e.sheets.ws5.data.matriks as Record<string, Record<string, number>>;
  assert.equal(m.tyd["3"], 5, "punte word binne 1–5 gehou");
  assert.equal(m.probleem["1"], undefined);
  assert.equal((e.sheets.ws5.data.idees as Record<string, unknown>)["2"], undefined);
  assert.equal(e.sheets.ws5.juf.afgeteken, true);
});

test("KI-invoer uit ’n PDF bevat geen leerdername nie", () => {
  const t = volGr9Haweloosheid;
  const e = normaliseExtraction(t, raw);
  const members = membersFrom(e);
  const ws1 = t.sheets.find((s) => s.key === "ws1")!;
  const text = sheetToText(ws1, e.sheets.ws1.data, { members, anonymise: true });
  assert.match(text, /Projekleier .*Naam: Lid 4/);
  assert.match(text, /Kommunikeerder .*Naam: Lid 1/);
  assert.doesNotMatch(text, /Imarie|Anli|Wilmie|Duné|Linde|Kruger/);
  const juf = jufText({ ...e.sheets.ws2, juf: { ...e.sheets.ws2.juf, kommentaar: ["Mooi, Anli Kruger!"] } }, members);
  assert.equal(juf, "- Mooi, Lid 2!");
});

test("onderwyser se regstellings word volgens die sjabloon skoongemaak", async () => {
  const { cleanSheetData, studentOnlySheet } = await import("../lib/pdf-vergelyking/skema");
  const ws2 = volGr9Haweloosheid.sheets.find((s) => s.key === "ws2")!;
  const data = cleanSheetData(ws2, { waarnemings: [{ gesien: " A ", waar: "B", pla: "C", ekstra: "x" }, { gesien: "", waar: "", pla: "" }], fotos: true, vreemd: 1 });
  assert.deepEqual(data, { waarnemings: [{ gesien: "A", waar: "B", pla: "C" }] });
  const only = studentOnlySheet(ws2);
  assert.ok(only.sections.every((sec) => sec.fields.every((f) => f.type !== "info" && f.type !== "photos" && f.type !== "teacherNote")));
});
