// Loop die regte KI-terugvoer op 'n oorgetikte papierwerkboek, met presies dieselfde
// invoer as die app (sheetToText + konteks uit vorige werkblaaie, geanonimiseer).
// Gebruik: OPENAI_API_KEY=... npx tsx scripts/ki-toets/loop.ts [uitvoer.json]
import { writeFileSync } from "node:fs";
import { generateFeedback, isReady, aiModel, aiConfigured, type FeedbackInput } from "../../lib/ki";
import { volGr9Haweloosheid as template } from "../../lib/werkboeke/sjablone";
import { sheetToText } from "../../lib/werkboeke/teks";
import type { SheetData } from "../../lib/werkboeke/tipes";
import { data, members, photoCounts, ws3Eerste } from "./gr9-groep-papier";

function input(sheetKey: string, sheetData: SheetData): FeedbackInput {
  const sheet = template.sheets.find((s) => s.key === sheetKey)!;
  const contextTexts = (sheet.context ?? [])
    .map((k) => {
      const cs = template.sheets.find((s) => s.key === k);
      if (!cs || !data[k]) return null;
      return { title: `Werkblad ${cs.number}: ${cs.title}`, text: sheetToText(cs, data[k], { members, anonymise: true, photoCounts: photoCounts[k] }) };
    })
    .filter((x): x is { title: string; text: string } => Boolean(x));
  return {
    template,
    sheet,
    project: { phenomenon: template.phenomenon ?? "Haweloosheid", question: "Hoe kan ons ons verantwoordelikheid teenoor ons naaste uitleef?", partner: "Moeggesukkel", grade: 9 },
    sheetText: sheetToText(sheet, sheetData, { members, anonymise: true, photoCounts: photoCounts[sheetKey] }),
    contextTexts
  };
}

const runs: { label: string; sheet: string; data: SheetData }[] = [
  { label: "WB1", sheet: "ws1", data: data.ws1 },
  { label: "WB2", sheet: "ws2", data: data.ws2 },
  { label: "WB3 (eerste poging)", sheet: "ws3", data: ws3Eerste },
  { label: "WB3 (hersien)", sheet: "ws3", data: data.ws3 },
  { label: "WB4", sheet: "ws4", data: data.ws4 },
  { label: "WB5", sheet: "ws5", data: data.ws5 },
  { label: "WB6", sheet: "ws6", data: data.ws6 },
  { label: "WB7", sheet: "ws7", data: data.ws7 },
  { label: "WB8", sheet: "ws8", data: data.ws8 }
];

async function main() {
  const dry = process.argv.includes("--droog");
  const out: unknown[] = [];
  for (let i = 0; i < runs.length; i += 3) {
    out.push(
      ...(await Promise.all(
        runs.slice(i, i + 3).map(async (r) => {
          const inp = input(r.sheet, r.data);
          if (dry) return { label: r.label, sheetText: inp.sheetText, context: inp.contextTexts.map((c) => c.title) };
          try {
            const res = await generateFeedback(inp);
            return { label: r.label, sheet: r.sheet, source: res.source, gereed: isReady(inp.sheet, res.result), sheetText: inp.sheetText, result: res.result };
          } catch (e) {
            return { label: r.label, sheet: r.sheet, fout: e instanceof Error ? e.message : String(e) };
          }
        })
      ))
    );
  }
  const json = JSON.stringify({ model: aiModel(), regte_ki: aiConfigured() && !dry, uitslae: out }, null, 2);
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (file) writeFileSync(file, json);
  else console.log(json);
}
main();
