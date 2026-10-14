import assert from "node:assert/strict";
import test from "node:test";
import { redact } from "../lib/werkboeke/teks";

test("KI-teks verwyder groeplede, e-pos, telefoon en ID-nommers", () => {
  const redacted = redact("Anke: anke@example.com, 082 123 4567, ID 0501015800087. Ben help ook.", ["Anke", "Ben"]);
  assert.equal(redacted, "Lid 1: [e-pos verwyder], [telefoonnommer verwyder], ID [ID-nommer verwyder]. Lid 2 help ook.");
});

test("naamvervanging verander nie dele van langer woorde nie", () => {
  assert.equal(redact("An het geantwoord; ander leerders luister.", ["An"]), "Lid 1 het geantwoord; ander leerders luister.");
});
