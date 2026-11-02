// Assesseringsrubriek Afdeling A (50 punte), woordeliks soos deur die skool verskaf.
// Hierdie teks is die enigste maatstaf vir die punt; verander dit net saam met `version`.

export type RubricLevel = { level: 1 | 2 | 3 | 4; label: string; band: string; min: number; max: number; text: string };

export type RubricCriterion = {
  id: string;
  number: number;
  title: string;
  max: number;
  /** Waar die bewyse hoofsaaklik lê; die KI lees steeds die hele werkboek. */
  primarySheets: string[];
  levels: RubricLevel[];
};

export type Rubric = { key: string; version: number; title: string; total: number; criteria: RubricCriterion[] };

const BANDS = {
  4: { label: "Uitstekend", band: "9–10", min: 9, max: 10 },
  3: { label: "Goed", band: "7–8", min: 7, max: 8 },
  2: { label: "Ontwikkelend", band: "5–6", min: 5, max: 6 },
  1: { label: "Beperkte bewys", band: "0–4", min: 0, max: 4 }
} as const;

function levels(l4: string, l3: string, l2: string, l1: string): RubricLevel[] {
  return ([[4, l4], [3, l3], [2, l2], [1, l1]] as const).map(([level, text]) => ({ level, text, ...BANDS[level] }));
}

export const RUBRIEK_A: Rubric = {
  key: "afd-a",
  version: 1,
  title: "A. Groepassessering: ondersoek, beplanning, uitvoering en evaluering",
  total: 50,
  criteria: [
    {
      id: "k1",
      number: 1,
      title: "Probleemidentifisering en probleemstelling",
      max: 10,
      primarySheets: ["ws2", "ws3"],
      levels: levels(
        "Waarnemings uit die uitstappie is konkreet en akkuraat beskryf; plek is duidelik aangedui. Die groep verklein die groter natuurbewaringskwessie tot ’n spesifieke, uitvoerbare probleem. Die ‘Hoe kan ons…?’-vraag en ondersoekvrae is duidelik en relevant.",
        "Die probleem en plek is duidelik. Die probleemstelling is meestal spesifiek en uitvoerbaar; ondersoekvrae sluit redelik goed daarby aan.",
        "Waarnemings of ligging is vaag/onvolledig. Die probleem is breed of die ondersoekvrae sluit slegs gedeeltelik daarby aan.",
        "Min eie waarnemings of geen duidelike ligging nie. Probleemstelling ontbreek, is onduidelik of is nie uitvoerbaar nie."
      )
    },
    {
      id: "k2",
      number: 2,
      title: "Navorsing, vakintegrasie en ontleding van oplossings",
      max: 10,
      primarySheets: ["ws4", "ws5"],
      levels: levels(
        "Relevante kennis uit verskillende vakke word sinvol geïntegreer. Feite word met toepaslike bronne ondersteun. Drie onderskeibare oplossings word oorweeg; voor- en nadele is deeglik ontleed. Die keusematriks word sinvol gebruik en die finale keuse word oortuigend gemotiveer.",
        "Meer as een vak se kennis en toepaslike bronne word gebruik. Drie idees word aangebied en vergelyk. Die keuse en motivering is oorwegend logies.",
        "Navorsing is beperk of hoofsaaklik beskrywend. Vakintegrasie is oppervlakkig; idees/voor- en nadele of die keusematriks is gedeeltelik voltooi. Motivering is eenvoudig.",
        "Baie min navorsing of bronne. Minder as drie bruikbare idees; min vergelyking en geen duidelike, bewysgegronde motivering vir die keuse nie."
      )
    },
    {
      id: "k3",
      number: 3,
      title: "Oplossingsvoorstel, beplanning, begroting en veiligheid",
      max: 10,
      primarySheets: ["ws6", "ws7", "ws8"],
      levels: levels(
        "Voorstel is duidelik, realisties en volledig. Materiaal, hulp, toestemming, tydlyn en meetmetode is uiteengesit. Begroting is realisties. Risiko’s vir mense én die omgewing is geïdentifiseer met toepaslike voorkomingsmaatreëls; nodige goedkeuring is verkry.",
        "Plan is uitvoerbaar en die meeste beplanningsaspekte is ingesluit. Begroting en veiligheidsmaatreëls is redelik volledig; geringe besonderhede ontbreek.",
        "Plan bevat leemtes; materiaal, tydlyn, begroting of meetmetode is vaag. Veiligheidsrisiko’s is slegs gedeeltelik oorweeg.",
        "Plan is onduidelik of onuitvoerbaar. Begroting/veiligheidsplan ontbreek grotendeels of nodige toestemming is nie aangedui nie."
      )
    },
    {
      id: "k4",
      number: 4,
      title: "Uitvoering, samewerking en dokumentering",
      max: 10,
      primarySheets: ["ws1", "ws9", "ws10"],
      levels: levels(
        "Die groep het die goedgekeurde oplossing werklik en verantwoordelik uitgevoer. Die logboek is volledig en tydig ingevul; take/rolle en aanpassings is duidelik. Foto’s en ander bewyse wys die proses, nie net die eindproduk nie. Bewyse is relevant en geloofwaardig.",
        "Oplossing is grootliks uitgevoer. Logboek, rolverdeling en foto-/ander bewyse is voldoende, met enkele leemtes.",
        "Uitvoering is gedeeltelik of swak gedokumenteer. Logboek is onvolledig; bewyse wys nie die hele proses of elke lid se bydrae nie.",
        "Min bewys van werklike uitvoering. Logboek ontbreek grotendeels en/of bewyse is onvoldoende om die werk te bevestig."
      )
    },
    {
      id: "k5",
      number: 5,
      title: "Resultate, evaluering, volhoubaarheid en rentmeesterskap / naasteliefde",
      max: 10,
      primarySheets: ["ws11"],
      levels: levels(
        "Resultate word vergelyk met die voorafbepaalde suksesmaatstaf en met data/foto’s gestaaf. Die groep onderskei eerlik tussen wat bewys kan word en wat nie. Beperkings en mislukkings word ontleed; volhoubaarheid en volgende stappe is realisties. Die aanvanklike ondersoekvraag word na verwys en verduidelik.",
        "Resultate word met toepaslike bewyse bespreek. Die groep erken wat gewerk het en wat nie; volhoubaarheid en rentmeesterskap / naasteliefde word sinvol aangeraak.",
        "Evaluering is hoofsaaklik beskrywend. Min vergelyking met die suksesmaatstaf of beperkte bewyse; refleksie/volhoubaarheid is oppervlakkig.",
        "Geen duidelike evaluering of betroubare bewyse nie. Die groep maak ongegronde aansprake of reflekteer nie oor beperkings en volgende stappe nie."
      )
    }
  ]
};

/** Die rubriek vir ’n werkboek. Albei die 2026-werkboeke gebruik Afdeling A. */
export function rubricFor(_templateKey: string): Rubric {
  return RUBRIEK_A;
}

/** Die vlak volg altyd uit die punt, sodat ’n punt nooit buite sy band kan val nie. */
export function levelForScore(rubric: Rubric, criterionId: string, score: number): RubricLevel {
  const c = rubric.criteria.find((x) => x.id === criterionId);
  if (!c) throw new Error(`Onbekende kriterium: ${criterionId}`);
  const found = c.levels.find((l) => score >= l.min && score <= l.max);
  if (!found) throw new Error(`Punt buite die rubriek: ${score}`);
  return found;
}

export function isValidScore(score: unknown, max = 10): score is number {
  return typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= max;
}

/** Die totaal word altyd bereken, nooit oorgeneem nie. */
export function totalOf(scores: Record<string, number>, rubric: Rubric): number {
  return rubric.criteria.reduce((sum, c) => sum + (isValidScore(scores[c.id], c.max) ? scores[c.id] : 0), 0);
}

export function rubricAsText(rubric: Rubric): string {
  return rubric.criteria
    .map(
      (c) =>
        `KRITERIUM ${c.id} — ${c.number}. ${c.title} (${c.max} punte)\n${c.levels
          .map((l) => `  Vlak ${l.level} ${l.label} (${l.band}): ${l.text}`)
          .join("\n")}`
    )
    .join("\n\n");
}
