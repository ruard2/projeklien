import assert from "node:assert/strict";
import test from "node:test";
import { restoreFeedbackInput, snapshotFeedbackInput } from "../lib/ki-invoer";
import { getSheet, getTemplate } from "../lib/werkboeke/sjablone";

test("'n bevrore KI-invoer kan presies as 'n uitvoerbare toets herstel word", () => {
  const template = getTemplate("vol-gr9-haweloosheid");
  const sheet = getSheet(template, "ws3");
  assert.ok(sheet);
  const input = {
    template,
    sheet,
    project: { phenomenon: "Haweloosheid", question: "Hoe kan ons ons verantwoordelikheid teenoor ons naaste uitleef?", partner: "Moeggesukkel", grade: 9 },
    sheetText: "Die groep se geanonimiseerde antwoord.",
    contextTexts: [{ title: "Werkblad 2", text: "Geanonimiseerde waarneming." }],
    extraContext: "Bykomende konteks."
  };
  const snapshot = snapshotFeedbackInput(input, "ws3");
  const restored = restoreFeedbackInput(snapshot);
  assert.equal(restored.template.key, template.key);
  assert.equal(restored.sheet.key, "ws3");
  assert.deepEqual(restored.project, input.project);
  assert.equal(restored.sheetText, input.sheetText);
  assert.deepEqual(restored.contextTexts, input.contextTexts);
  assert.equal(restored.extraContext, input.extraContext);
});
