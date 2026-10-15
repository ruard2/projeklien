import assert from "node:assert/strict";
import test from "node:test";
import { canReviewFeedback, isAdminRole } from "../lib/sessie";
import { AI_REPORT_CATEGORIES, parseAiReport } from "../lib/terugvoer-beheer";

test("slegs administrateurs en ontwikkelaars kan ontwikkelaarterugvoer verwerk", () => {
  assert.equal(canReviewFeedback("TEACHER"), false);
  assert.equal(canReviewFeedback("ADMIN"), true);
  assert.equal(canReviewFeedback("DEVELOPER"), true);
  assert.equal(isAdminRole("TEACHER"), false);
  assert.equal(isAdminRole("ADMIN"), true);
  assert.equal(isAdminRole("DEVELOPER"), true);
});

test("leerderverslae aanvaar net bekende kategorieë en beperk teks", () => {
  for (const category of AI_REPORT_CATEGORIES) {
    assert.deepEqual(parseAiReport({ category, message: "  Kort verduideliking.  " }), { category, message: "Kort verduideliking." });
  }
  assert.throws(() => parseAiReport({ category: "verander-die-ki", message: "nee" }), /Kies asseblief/);
  assert.equal(parseAiReport({ category: "ander", message: "x".repeat(1400) }).message.length, 1200);
});
