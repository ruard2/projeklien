import assert from "node:assert/strict";
import test from "node:test";
import { volGr8Natuurbewaring as t } from "../lib/werkboeke/sjablone";
import { sheetInstructionText } from "../lib/werkboeke/teks";
import type { TableField } from "../lib/werkboeke/tipes";

const byNumber = (n: number) => t.sheets.find((s) => s.number === n)!;

test("Graad 8 bevat die volledige werkboekstruktuur", () => {
  assert.equal(t.sheets.filter((s) => s.number !== null).length, 15);
  assert.deepEqual(
    t.sheets.filter((s) => s.number !== null).map((s) => s.title),
    [
      "Ons groep en ons rolle",
      "Wat het ons op die uitstappie gesien?",
      "Ons probleemstelling",
      "Wat weet ons al uit ons vakke?",
      "Drie moontlike probleemoplossings",
      "Ons oplossingsvoorstel",
      "Materiaallys en begroting",
      "Ons veiligheidsplan",
      "Uitvoeringslogboek",
      "Ons bewyse",
      "Het dit gewerk?",
      "Ons ekspo-stalletjie",
      "Ons aanbieding",
      "Is ons gereed?",
      "My persoonlike refleksie"
    ]
  );
  assert.equal(t.checkpoints.length, 6);
  assert.deepEqual(t.checkpoints.flatMap((c) => c.sheets), Array.from({ length: 14 }, (_, i) => `ws${i + 1}`));
});

test("Graad 8 se kernwoorde en ondersoekvraag volg die bronwerkboek", () => {
  assert.equal(t.defaults.phenomenon, "Natuurbewaring");
  assert.equal(t.defaults.question, "Hoe kan ons rentmeesters wees van God se skepping?");
  assert.match(t.intro.how, /probleem wat julle op die berg gesien het/);
  assert.match(t.intro.howBullets[0], /Hou dit by elke projekperiode/);
  assert.match(sheetInstructionText(byNumber(3)), /Te groot: Hoe kan ons die Magaliesberg bewaar en beskerm\?/);
  assert.match(sheetInstructionText(byNumber(11)), /Hoe kan ons rentmeesters wees van God se skepping\?/);
  assert.match(sheetInstructionText(byNumber(15)), /bewoon, te bewerk en te bewaar/);
});

test("Die KI ontvang die werkboek se opdragte en steunmateriaal", () => {
  const wb3 = sheetInstructionText(byNumber(3));
  assert.match(wb3, /Maak dit klein en maak dit werklik/);
  assert.match(wb3, /Te eenvoudig:/);
  assert.match(wb3, /Stap 4: Drie vrae wat ons moet ondersoek/);

  const wb5 = sheetInstructionText(byNumber(5));
  assert.match(wb5, /Die eerste idee is selde die beste een/);
  assert.match(wb5, /Kan ons meet of dit gewerk het\?/);

  const wb13 = sheetInstructionText(byNumber(13));
  assert.match(wb13, /Aanbieding moet ongeveer 5 minute duur/);
  assert.match(wb13, /Drie vrae wat besoekers waarskynlik gaan vra/);
});

test("Later werkblaaie kry genoeg vorige projekwerk as konteks", () => {
  assert.deepEqual(byNumber(6).context, ["ws2", "ws3", "ws4", "ws5"]);
  assert.deepEqual(byNumber(11).context, ["ws3", "ws5", "ws6", "ws9", "ws10"]);
  assert.deepEqual(byNumber(12).context, ["ws3", "ws4", "ws5", "ws6", "ws10", "ws11"]);
  assert.deepEqual(byNumber(13).context, ["ws3", "ws4", "ws5", "ws6", "ws9", "ws10", "ws11"]);
  assert.deepEqual(byNumber(15).context, ["ws1", "ws3", "ws5", "ws6", "ws9", "ws10", "ws11"]);
});

test("Die digitale vorm voeg nie vaste minimums by wat nie in die bron staan nie", () => {
  const table = (n: number, key: string) =>
    byNumber(n).sections.flatMap((s) => s.fields).find((f): f is TableField => f.key === key && f.type === "table");
  assert.equal(table(2, "waarnemings")?.minRows, 1);
  assert.equal(table(4, "vakke")?.minRows, 1);
  assert.equal(table(8, "risiko")?.minRows, 1);
  assert.match(byNumber(9).criteria[0].description, /minstens een gedateerde inskrywing/);
});
