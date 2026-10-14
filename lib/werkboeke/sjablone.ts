import { buildVolTemplate } from "./vol-basis";
import type { Sheet, Template } from "./tipes";

export const volGr8Natuurbewaring = buildVolTemplate({
  key: "vol-gr8-natuurbewaring",
  version: 2,
  grade: 8,
  label: "Graad 8 · Natuurbewaring",
  phenomenon: "Natuurbewaring",
  question: "Hoe kan ons rentmeesters wees van God se skepping?",
  partner: "Vriende van die Magalies",
  place: "die Magaliesberg",
  introHow:
    "Hierdie werkboek vat julle stap vir stap van ’n probleem wat julle op die berg gesien het, tot by ’n oplossing wat julle werklik gaan uitvoer en by die ekspo gaan wys.",
  notExpected:
    "Julle hoef nie die probleem van natuurbewaring in sy geheel op te los nie. Julle moet leer hoe om verantwoordelik, met respek en binne julle vermoëns by te dra tot ’n werklike uitdaging. ’n Groep wat eerlik sê “ons het een behoefte vir twee weke aangespreek” doen presies wat ons vra.",
  problemInfo: {
    body: [
      "Die probleem is groot, maar ons kan nie die hele probleem aanspreek nie. Skets die groot probleem, maar maak dit kleiner en doenbaar."
    ],
    examples: [
      { label: "Te groot", tone: "bad", text: "Hoe kan ons die Magaliesberg bewaar en beskerm?" },
      { label: "Goed", tone: "good", text: "Hoe kan ons die hoeveelheid rommel langs die staproetes in die Magaliesberg verminder en besoekers aanmoedig om hul afval verantwoordelik te hanteer?" },
      { label: "Te eenvoudig", tone: "bad", text: "Hoe kan ons die Magaliesberg skoon hou?" }
    ]
  },
  evidenceRows: [
    { key: "proses", label: "Foto’s van die proses (nie net die eindproduk nie)" },
    { key: "voorna", label: "Foto’s van “voor” en “na”" },
    { key: "metings", label: "Ons metings of tellings" },
    { key: "kaart", label: "Ons kaart van die gebied" },
    { key: "ontwerp", label: "Ons werkstekening of ontwerp" },
    { key: "terugvoer", label: "Terugvoer van ’n onderwyser of deskundige" },
    { key: "brief", label: "Nabetragtingsbrief aan Vriende van die Magalies" }
  ],
  evidenceDataTable: false,
  checkpoint5Statement: "Refleksie is gedoen en volledig.",
  aiContext:
    "Graad 8-leerders (13–14 jaar). Die verskynsel is natuurbewaring. Die groepe het ’n uitstappie na die Magaliesberg gedoen en werk saam met die vennoot-organisasie Vriende van die Magalies. Die ondersoekvraag is “Hoe kan ons rentmeesters wees van God se skepping?” — die skool is ’n Gereformeerde skool en die tema van rentmeesterskap (bewoon, bewerk en bewaar) is deel van die projek."
});

export const volGr9Haweloosheid = buildVolTemplate({
  key: "vol-gr9-haweloosheid",
  version: 3,
  grade: 9,
  label: "Graad 9 · Haweloosheid",
  phenomenon: "Haweloosheid",
  question: "Hoe kan ons ons verantwoordelikheid teenoor ons naaste uitleef?",
  partner: "Moeggesukkel",
  place: "Moeggesukkel",
  introHow:
    "Hierdie werkboek vat julle stap vir stap van ’n probleem wat julle tydens die besoek aan Moeggesukkel raakgesien het, tot by ’n oplossing wat julle werklik gaan uitvoer en by die ekspo gaan wys.",
  notExpected:
    "Julle hoef nie die probleem van haweloosheid op te los nie. Julle moet leer hoe om verantwoordelik, met respek en binne julle vermoëns by te dra tot ’n werklike uitdaging. ’n Groep wat eerlik sê “ons het een behoefte vir twee weke aangespreek” doen presies wat ons vra.",
  rules: {
    intro: "Hierdie projek werk met werklike mense in ’n moeilike situasie. Hierdie vyf reëls geld deurgaans, vir elke groep en elke vak.",
    items: [
      { name: "Menswaardigheid", meaning: "Ons gebruik respekvolle taal. Ons praat van mense wat haweloosheid ervaar – nie van “die haweloses” nie. Niemand word tot sy omstandighede verklein nie." },
      { name: "Toestemming", meaning: "Geen foto, video, naam of persoonlike storie word gebruik sonder uitdruklike toestemming nie. Die skool en Moeggesukkel reël toestemming, nie ons nie." },
      { name: "Privaatheid", meaning: "Geen persoonlike inligting of sensitiewe omstandighede op ons plakkaat of stalletjie nie." },
      { name: "Geen aannames", meaning: "Nie almal wat haweloosheid ervaar het dieselfde behoeftes of dieselfde storie nie. Elke aanname moet getoets word." },
      { name: "Geen beloftes", meaning: "Ons belowe nie werk, huisvesting, geld of dienste wat ons nie kan gee nie." }
    ]
  },
  problemInfo: {
    body: ["As julle nie kan sê wie gesê het dit is ’n behoefte nie, is dit nog nie ’n probleemstelling nie."],
    examples: [
      { label: "Te groot", tone: "bad", text: "Hoe kan ons haweloosheid in Suid-Afrika oplos?" },
      { label: "Goed", tone: "good", text: "Hoe kan ons ’n volhoubare voedselinsamelingstelsel vir Moeggesukkel opstel wat ná ons projek aanhou werk?" },
      { label: "Te eenvoudig", tone: "bad", text: "Hoe kan ons hawelose mense help om werk te kry?" }
    ]
  },
  problemExtraCriteria: [
    {
      id: "behoefte",
      title: "Wie sê dit is ’n behoefte?",
      description: "Iewers in stap 2 of stap 5 blyk wie gesê het dit is ’n behoefte (bv. Moeggesukkel of iemand wat daar werk). ’n Behoefte wat die groep net self aanneem, is nog nie genoeg nie."
    }
  ],
  safetyExtraCriteria: [
    {
      id: "menswaardig",
      title: "Mense en die vyf reëls",
      description: "Waar die projek met mense werk, neem die plan ook menswaardigheid, toestemming en privaatheid in ag (bv. geen foto’s van mense sonder toestemming nie)."
    }
  ],
  evidenceRows: [
    { key: "proses", label: "Foto’s van die proses (nie net die eindproduk nie)" },
    { key: "voorna", label: "Foto’s van “voor” en “na”" },
    { key: "resultate", label: "Ons resultate" },
    { key: "kaart", label: "Ons kaart van die gebied (indien van toepassing)" },
    { key: "ontwerp", label: "Ons werkstekening of ontwerp" },
    { key: "terugvoer", label: "Terugvoer van ’n onderwyser of deskundige" },
    { key: "brief", label: "Nabetragtingsbrief wat ons geskryf het vir Moeggesukkel" }
  ],
  evidenceDataTable: true,
  checkpoint5Statement: "Refleksie van wat gewerk het en wat nie, is gedoen en volledig.",
  aiContext:
    "Graad 9-leerders (14–15 jaar). Die verskynsel is haweloosheid. Die groepe werk saam met Moeggesukkel, ’n organisasie wat mense ondersteun wat haweloosheid ervaar. Die ondersoekvraag is “Hoe kan ons ons verantwoordelikheid teenoor ons naaste uitleef?” Die skool is ’n Gereformeerde skool. Die vyf reëls (menswaardigheid, toestemming, privaatheid, geen aannames, geen beloftes) is hier baie belangrik. ’n Behoefte is eers bevestig as dit uit die groep se eie gemagtigde waarneming of uit inligting van Moeggesukkel kom; die KI mag nie ’n behoefte, persoon se verhaal of toestemming aflei nie. Persoonlike kontak, foto’s en stories word slegs gebruik as die skool en Moeggesukkel dit gereël het."
});

const TEMPLATES: Record<string, Template> = {
  [volGr8Natuurbewaring.key]: volGr8Natuurbewaring,
  [volGr9Haweloosheid.key]: volGr9Haweloosheid
};

export function listTemplates(): Template[] {
  return Object.values(TEMPLATES);
}

export function getTemplate(key: string): Template {
  const t = TEMPLATES[key];
  if (!t) throw new Error(`Onbekende werkboek-sjabloon: ${key}`);
  return t;
}

/** "ws15:2" → { base: "ws15", member: 2 } */
export function parseSheetKey(sheetKey: string): { base: string; member: number | null } {
  const [base, m] = sheetKey.split(":");
  const member = m ? Number(m) : null;
  return { base, member: member && member >= 1 && member <= 4 ? member : null };
}

export function getSheet(t: Template, sheetKey: string): Sheet | null {
  const { base, member } = parseSheetKey(sheetKey);
  const s = t.sheets.find((x) => x.key === base) ?? null;
  if (!s) return null;
  if (s.perMember && member === null) return null;
  if (!s.perMember && member !== null) return null;
  return s;
}
