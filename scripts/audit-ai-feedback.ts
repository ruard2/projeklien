import { db } from "../lib/db";
import { runActiveEvalCases } from "../lib/evaluasie";

async function main() {
  const results = await runActiveEvalCases();
  if (!results.length) {
    console.log("Geen aktiewe KI-toetse uit onderwyserterugvoer nie.");
  } else {
    for (const result of results) console.log(`${result.passed ? "✓" : "✗"} ${result.summary}`);
    console.log(`\n${results.filter((result) => result.passed).length}/${results.length} KI-terugvoertoetse geslaag.`);
  }
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
