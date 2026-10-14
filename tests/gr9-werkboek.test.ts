import assert from "node:assert/strict";
import test from "node:test";
import { volGr9Haweloosheid as template } from "../lib/werkboeke/sjablone";
import { sheetInstructionText } from "../lib/werkboeke/teks";
import type { TableField } from "../lib/werkboeke/tipes";

const byNumber = (number: number) => template.sheets.find((sheet) => sheet.number === number)!;

test("Graad 9 gebruik die korrekte verskynsel, vennoot en ondersoekvraag", () => {
  assert.equal(template.defaults.phenomenon, "Haweloosheid");
  assert.equal(template.defaults.partner, "Moeggesukkel");
  assert.equal(template.defaults.question, "Hoe kan ons ons verantwoordelikheid teenoor ons naaste uitleef?");
  assert.match(template.intro.how, /besoek aan Moeggesukkel/);
  assert.doesNotMatch(template.intro.how, /berg/);
  assert.match(sheetInstructionText(byNumber(11)), /Hoe kan ons ons verantwoordelikheid teenoor ons naaste uitleef\?/);
  assert.doesNotMatch(sheetInstructionText(byNumber(11)), /rentmeesters wees van God se skepping/);
});

test("Graad 9 se vyf reëls en menswaardige taal is volledig", () => {
  assert.deepEqual(template.rules?.items.map((rule) => rule.name), ["Menswaardigheid", "Toestemming", "Privaatheid", "Geen aannames", "Geen beloftes"]);
  assert.match(template.rules?.items[0].meaning ?? "", /mense wat haweloosheid ervaar/);
  assert.match(template.rules?.items[1].meaning ?? "", /skool en Moeggesukkel reël toestemming/);
  assert.match(template.aiContext, /mag nie ’n behoefte, persoon se verhaal of toestemming aflei nie/);
});

test("Graad 9 se unieke werkbladinhoud volg die bronwerkboek", () => {
  const wb3 = sheetInstructionText(byNumber(3));
  assert.match(wb3, /Hoe kan ons haweloosheid in Suid-Afrika oplos\?/);
  assert.match(wb3, /volhoubare voedselinsamelingstelsel vir Moeggesukkel/);
  assert.match(wb3, /wie gesê het dit is ’n behoefte/);
  assert.ok(byNumber(3).criteria.some((criterion) => criterion.id === "behoefte"));

  const wb8 = byNumber(8);
  assert.ok(wb8.criteria.some((criterion) => criterion.id === "menswaardig"));
  assert.match(sheetInstructionText(wb8), /veiligheid van die kinders.*omgewing/s);

  const wb10 = byNumber(10);
  const data = wb10.sections.flatMap((section) => section.fields).find((field): field is TableField => field.type === "table" && field.key === "data");
  assert.ok(data);
  assert.deepEqual(data.columns.map((column) => column.label), ["Wat ons gedoen het", "Waar", "Wanneer", "Resultaat"]);
  assert.match(sheetInstructionText(byNumber(15)), /bewoon, te bewerk en te bewaar/);
});

test("Graad 9 se latere werkblaaie kry die volledige relevante projekverloop", () => {
  assert.deepEqual(byNumber(6).context, ["ws2", "ws3", "ws4", "ws5"]);
  assert.deepEqual(byNumber(10).context, ["ws3", "ws6", "ws9"]);
  assert.deepEqual(byNumber(11).context, ["ws3", "ws5", "ws6", "ws9", "ws10"]);
  assert.deepEqual(byNumber(13).context, ["ws3", "ws4", "ws5", "ws6", "ws9", "ws10", "ws11"]);
  assert.deepEqual(byNumber(15).context, ["ws1", "ws3", "ws5", "ws6", "ws9", "ws10", "ws11"]);
});
