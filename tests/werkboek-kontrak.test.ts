import assert from "node:assert/strict";
import test from "node:test";
import { listTemplates } from "../lib/werkboeke/sjablone";

const expectedTitles = [
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
];

for (const template of listTemplates()) {
  test(`${template.label} voldoen aan die gedeelde werkboekkontrak`, () => {
    const sheets = template.sheets.filter((sheet) => sheet.number !== null);
    assert.equal(sheets.length, 15);
    assert.deepEqual(sheets.map((sheet) => sheet.title), expectedTitles);
    assert.equal(template.checkpoints.length, 6);
    assert.deepEqual(template.checkpoints.flatMap((checkpoint) => checkpoint.sheets), Array.from({ length: 14 }, (_, index) => `ws${index + 1}`));

    const positions = new Map(template.sheets.map((sheet, index) => [sheet.key, index]));
    for (const sheet of template.sheets) {
      const fieldKeys = sheet.sections.flatMap((section) => section.fields.map((field) => field.key));
      assert.equal(new Set(fieldKeys).size, fieldKeys.length, `${sheet.key} het duplikaat veldsleutels`);

      const criterionIds = sheet.criteria.map((criterion) => criterion.id);
      assert.equal(new Set(criterionIds).size, criterionIds.length, `${sheet.key} het duplikaat kriterium-ID’s`);
      if (sheet.feedback) assert.ok(sheet.criteria.length > 0, `${sheet.key} het terugvoer sonder kriteria`);

      for (const contextKey of sheet.context ?? []) {
        assert.ok(positions.has(contextKey), `${sheet.key} verwys na onbekende konteks ${contextKey}`);
        assert.ok(positions.get(contextKey)! < positions.get(sheet.key)!, `${sheet.key} se konteks moet uit ’n vroeër werkblad kom`);
      }
    }
  });
}
