import { generateFeedback, isReady } from "../lib/ki";
import { volGr8Natuurbewaring as template } from "../lib/werkboeke/sjablone";

const project = {
  phenomenon: "Natuurbewaring",
  question: "Hoe kan ons rentmeesters wees van God se skepping?",
  partner: "Vriende van die Magalies",
  grade: 8
};

async function check(sheetKey: string, sheetText: string, contextTexts: { title: string; text: string }[]) {
  const sheet = template.sheets.find((s) => s.key === sheetKey)!;
  const out = await generateFeedback({ template, sheet, project, sheetText, contextTexts });
  console.log(JSON.stringify({ sheet: sheetKey, source: out.source, ready: isReady(sheet, out.result), result: out.result }, null, 2));
}

async function main() {
await check(
  "ws3",
  `## Stap 1: Die groot probleem\nDie Magaliesberg word beskadig.\n\n## Stap 2: Ons klein stukkie\nRommel.\n\n## Stap 3: Ons probleemstelling\nHoe kan ons die hele Magaliesberg skoonmaak?\n\n## Stap 4: Drie vrae\n1. Hoeveel rommel is daar?\n2. Wie strooi dit?\n3. Hoe maak ons skoon?\n\n## Stap 5: Hoekom belangrik?\nDie natuur is belangrik.`,
  [
    {
      title: "Werkblad 2: Wat het ons op die uitstappie gesien?",
      text: `1. Wat ons gesien het: Vyf plastiekbottels | Presies waar: langs die onderste wandelpad by die piekniekplek | Hoekom dit ons pla: diere kan dit eet\n[geen foto’s nie]`
    }
  ]
);

await check(
  "ws11",
  `## Ons het gesê ons sal weet dit werk as…\nDaar is geen rommel meer nie.\n\n## Wat het werklik gebeur?\nOns het die berg heeltemal skoon gemaak en almal het nou geleer.\n\n## Wat het NIE gewerk nie\nAlles het gewerk.\n\n## Wat kan ons bewys?\nOns het 'n groot verskil gemaak.\n\n## Is die projek volhoubaar?\nJa.\n\n## Was ons oplossing uitvoerbaar?\nJa.\n\n## Ondersoekvraag\nOns was rentmeesters.\n[geen foto’s nie]`,
  [
    { title: "Werkblad 6: Ons oplossingsvoorstel", text: "Ons gaan een sak rommel by die onderste piekniekplek optel. Ons tel die items voor en ná die opruiming." },
    { title: "Werkblad 9: Uitvoeringslogboek", text: "Een inskrywing: ons het 18 stukke rommel opgetel. Die wind het van die ligte plastiek weggewaai." },
    { title: "Werkblad 10: Ons bewyse", text: "Metings: 18 stukke rommel. Foto’s: [geen foto’s nie]." }
  ]
);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
