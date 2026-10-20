import assert from "node:assert/strict";
import test from "node:test";
import { memberDisplay, redact, sheetToText } from "../lib/werkboeke/teks";
import type { Sheet } from "../lib/werkboeke/tipes";

test("KI-teks verwyder groeplede, e-pos, telefoon en ID-nommers", () => {
  const redacted = redact("Anke: anke@example.com, 082 123 4567, ID 0501015800087. Ben help ook.", ["Anke", "Ben"]);
  assert.equal(redacted, "Lid 1: [e-pos verwyder], [telefoonnommer verwyder], ID [ID-nommer verwyder]. Lid 2 help ook.");
});

test("naamvervanging verander nie dele van langer woorde nie", () => {
  assert.equal(redact("An het geantwoord; ander leerders luister.", ["An"]), "Lid 1 het geantwoord; ander leerders luister.");
});

const rolSheet = {
  key: "ws1",
  number: 1,
  title: "Rolle",
  sections: [
    {
      fields: [
        {
          type: "table",
          key: "rolle",
          rows: [{ key: "a", label: "Leier" }, { key: "b", label: "Navorser" }, { key: "c", label: "Materiaal" }],
          columns: [{ key: "naam", label: "Naam", kind: "member" }]
        }
      ]
    }
  ],
  criteria: []
} as unknown as Sheet;

test("getikte name in rolle-tabel gaan nooit na die KI nie", () => {
  const data = { rolle: { a: { naam: "anke" }, b: { naam: "Pieter" }, c: { naam: "2" } } };
  const text = sheetToText(rolSheet, data, { members: ["Anke", "Ben", "", ""], anonymise: true });
  assert.match(text, /Leier \| Naam: Lid 1/);
  assert.match(text, /Navorser \| Naam: Groeplid A/);
  assert.match(text, /Materiaal \| Naam: Lid 2/);
  assert.doesNotMatch(text, /Pieter|anke/i);
});

test("ou lidnommers wys steeds as name", () => {
  assert.equal(memberDisplay("3", ["Anke", "Ben", "Carla", ""]), "Carla");
  assert.equal(memberDisplay("4", ["Anke", "", "", ""]), "Lid 4");
  assert.equal(memberDisplay(" Dirk ", []), "Dirk");
});
