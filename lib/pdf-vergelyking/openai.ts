// OpenAI-oproepe vir die PDF-vergelyking: (1) lees ’n gescande werkboek uit,
// (2) vergelyk die onderwyser se kommentaar met die KI-terugvoer.

import OpenAI from "openai";
import { aiModel } from "../ki";
import type { FeedbackResult } from "../ki";
import type { Sheet, Template } from "../werkboeke/tipes";
import { extractionSchema, layoutText } from "./skema";

let client: OpenAI | null = null;
function openai() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 10 * 60_000, maxRetries: 1 });
  return client;
}

export function pdfModel(): string {
  return process.env.OPENAI_PDF_MODEL || aiModel();
}

function reasoning(model: string) {
  return /^(gpt-5|o\d)/.test(model) ? { reasoning_effort: (process.env.OPENAI_REASONING_EFFORT || "medium") as "low" | "medium" | "high" } : {};
}

const EXTRACT_PROMPT = `Jy lees ’n gescande, met die hand ingevulde papierwerkboek van ’n groep leerders uit (Gereformeerde Hoërskool Dirk Postma, VOL-projek). Jou taak is om PRESIES oor te skryf wat op die bladsye staan, en om die leerders se werk streng te skei van die onderwyser se merke.

WIE HET WAT GESKRYF
- Gedrukte teks is die werkboek self: skryf dit nooit oor nie.
- LEERDERS skryf met blou of swart pen, potlood, en soms donkerrooi/maroen ink. Hulle antwoorde staan in die antwoordblokke en tabelle.
- Die ONDERWYSER merk met helderrooi (soms groen) pen: regmerkies, kruisies, woorde soos “Puik”, onderstrepings, pyle, randnotas, korreksies en opdragte (“Net een probleemstelling”, “Verander waar nodig!”), plus naam, handtekening en datum by ’n Kontrolepunt.
- Twyfel jy oor die kleur, kyk na die handskrif en die funksie: ’n antwoord op die vraag is van die leerders; ’n opmerking OOR die antwoord is van die onderwyser. Noem werklike twyfel by "onseker".
- ’n Blok soos “Vul die onderwyser se kommentaar hier in” bevat die onderwyser se kommentaar wat leerders oorgeskryf het: sit dit by juf.kommentaar met die voorvoegsel “(oorgeskryf) ”.

OORSKRYF
- Skryf woordeliks oor, met die leerders se eie spelling. Moet niks verbeter, aanvul of saamvat nie.
- Laat deurgehaalde teks weg. Werk invoegings (met ^ of pyltjies) in op die plek waar hulle hoort.
- Onleesbare woorde: skryf [?] en noem dit by "onseker".
- Tabelle: koppel elke sel aan die regte ry en kolom. Leë rye laat jy weg. Keusematriks: die getalle soos geskryf (nie die totale nie).
- Groeplid-kolomme: die naam soos geskryf.
- Koste: net die getal (Verniet = 0).
- Keuselys-kolomme (bv. “Hoe erg is dit?”): kies die naaste toegelate opsie; as die leerders iets anders geskryf het, noem hulle eie woorde by "onseker".
- Tekening of foto op ’n bladsy: merk die foto-veld as true.

WEERGAWES
- Kom ’n werkblad meer as een keer voor (bv. ’n eerste poging wat deurgetrek of teruggestuur is, en ’n hersiene weergawe), dan is "antwoorde" die FINALE weergawe (die netjiese, hersiene een). Die onderwyser se merke op die finale weergawe gaan by juf.kommentaar en die merke op die vroeëre weergawe by juf.kommentaar_vorige.
- Werkblaaie wat nie in die PDF voorkom nie of heeltemal leeg is: gevind = false.

PRIVAATHEID
- Skryf geen onderwysersname of handtekeninge oor nie; by afteken_datum net die datum.

DIE WERKBOEK SE BLADSYE EN VELDE
`;

export async function extractPdf(template: Template, pdf: Buffer, fileName: string): Promise<{ raw: unknown; model: string }> {
  const model = pdfModel();
  const completion = await openai().chat.completions.create({
    model,
    ...reasoning(model),
    messages: [
      { role: "system", content: EXTRACT_PROMPT + layoutText(template) },
      {
        role: "user",
        content: [
          { type: "file", file: { filename: fileName.replace(/[^\w.\- ]/g, "_") || "werkboek.pdf", file_data: `data:application/pdf;base64,${pdf.toString("base64")}` } },
          { type: "text", text: `Lees hierdie werkboek (${template.label}) uit volgens die skema.` }
        ]
      }
    ],
    response_format: { type: "json_schema", json_schema: { name: "werkboek", strict: true, schema: extractionSchema(template) } }
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error(completion.choices[0]?.message?.refusal || "Leë antwoord van die KI.");
  return { raw: JSON.parse(content), model };
}

// ---------------------------------------------------------------- Vergelyking

export type Vergelyking = {
  ooreenkoms: "stem_ooreen" | "gedeeltelik" | "verskil" | "geen_juf_kommentaar";
  opsomming: string;
  albei: string[];
  net_juf: string[];
  net_ki: string[];
};

const COMPARE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ooreenkoms", "opsomming", "albei", "net_juf", "net_ki"],
  properties: {
    ooreenkoms: { type: "string", enum: ["stem_ooreen", "gedeeltelik", "verskil", "geen_juf_kommentaar"] },
    opsomming: { type: "string", description: "1–2 sinne: in watter mate sê die KI dieselfde as die onderwyser?" },
    albei: { type: "array", items: { type: "string" }, description: "Punte wat die onderwyser en die KI albei maak" },
    net_juf: { type: "array", items: { type: "string" }, description: "Punte wat net die onderwyser maak (die KI mis dit)" },
    net_ki: { type: "array", items: { type: "string" }, description: "Punte wat net die KI maak (ekstra)" }
  }
} as const;

export async function compareFeedback(args: {
  sheet: Sheet;
  jufText: string;
  ai: FeedbackResult;
}): Promise<Vergelyking> {
  const { sheet, ai } = args;
  const aiText = [
    `Opsomming: ${ai.opsomming}`,
    ...ai.kriteria.map((k) => {
      const c = sheet.criteria.find((x) => x.id === k.id);
      return `- ${c?.title ?? k.id}: ${k.oordeel.replaceAll("_", " ")} — ${k.terugvoer}`;
    }),
    ai.vrae.length ? `Vrae: ${ai.vrae.join(" | ")}` : "",
    ai.reelkwessies.length ? `Reëlkwessies: ${ai.reelkwessies.map((r) => `${r.reel}: ${r.beskrywing}`).join(" | ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const model = aiModel();
  const completion = await openai().chat.completions.create({
    model,
    ...reasoning(model),
    messages: [
      {
        role: "system",
        content:
          "Jy vergelyk twee stelle terugvoer op dieselfde werkblad van ’n graad 8/9-groep: die onderwyser se handgeskrewe kommentaar en ’n KI se terugvoer. Bepaal inhoudelik of hulle dieselfde punte maak. ’n Regmerkie of “Puik” van die onderwyser beteken goedkeuring. As die onderwyser niks geskryf het nie (en ook nie afgeteken het nie), is ooreenkoms “geen_juf_kommentaar”. Skryf kort, duidelike Afrikaans; elke punt hoogstens een sin."
      },
      {
        role: "user",
        content: `WERKBLAD ${sheet.number}: ${sheet.title}\n\nONDERWYSER:\n${args.jufText || "(geen kommentaar)"}\n\nKI-TERUGVOER:\n${aiText}`
      }
    ],
    response_format: { type: "json_schema", json_schema: { name: "vergelyking", strict: true, schema: COMPARE_SCHEMA as unknown as Record<string, unknown> } }
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Leë vergelyking van die KI.");
  return JSON.parse(content) as Vergelyking;
}
