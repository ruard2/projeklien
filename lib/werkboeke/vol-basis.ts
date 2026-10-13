// Gemeenskaplike VOL-werkboek (Gereformeerde Hoërskool Dirk Postma, 2026).
// Graad 8 en Graad 9 gebruik dieselfde struktuur; die verskille word as opsies ingegee.
// Teks volg die gedrukte leerderwerkboeke so na as moontlik.

import type { CheckpointDef, Criterion, Field, FixedRow, Phase, Rule, Sheet, Template } from "./tipes";

export type VolOptions = {
  key: string;
  version: number;
  grade: number;
  label: string;
  phenomenon: string;
  question: string;
  partner: string;
  place: string;
  notExpected: string;
  rules?: { intro: string; items: Rule[] };
  problemInfo: { body: string[]; examples: { label: string; text: string; tone: "bad" | "good" }[] };
  /** Ekstra kriteria vir werkblad 3 (bv. "wie het gesê dit is 'n behoefte?") */
  problemExtraCriteria?: Criterion[];
  evidenceRows: FixedRow[];
  /** Graad 9 het 'n "Ons data"-tabel op werkblad 10 */
  evidenceDataTable: boolean;
  checkpoint5Statement: string;
  safetyExtraCriteria?: Criterion[];
  aiContext: string;
};

export const ROLES: FixedRow[] = [
  { key: "projekleier", label: "Projekleier", cells: { taak: "ons weet wat vandag gedoen moet word en almal ’n taak het." } },
  { key: "navorser", label: "Navorser en skrywer", cells: { taak: "die werkboek ingevul word en elke feit ’n bron het." } },
  { key: "materiaal", label: "Materiaal en veiligheid", cells: { taak: "ons goed daar is, veilig gebruik word en terugkom." } },
  { key: "kommunikeerder", label: "Kommunikeerder", cells: { taak: "ons foto’s en notas het, en gereed is om te praat." } }
];

export const PHASES: Phase[] = [
  { key: "f1", label: "Fase 1", dates: "17 en 22 Sept", what: "Ondersoek – ons bepaal rolle, herroep die uitstappie en stel die probleem.", ready: "Werkblad 1 – 3" },
  { key: "vakansie", label: "Vakansie", dates: "23 Sept – 5 Okt", what: "Rus. Geen verpligte werk nie.", ready: "—", kind: "break" },
  { key: "f2", label: "Fase 2", dates: "8 Okt", what: "Analiseer – integreer ons kennis en oorweeg moontlike oplossings.", ready: "Werkblad 4 – 5" },
  { key: "f3", label: "Fase 3", dates: "13 en 15 Okt", what: "Aksie – ons ontwerp (beplan) ’n oplossing.", ready: "Werkblad 6 – 8" },
  { key: "f4", label: "Fase 4", dates: "19 – 28 Okt", what: "Aksie – ons voer die oplossing uit.", ready: "Werkblad 9 – 10", note: "Hierdie fase word op ons eie gedoen en nie by die skool nie." },
  { key: "f5", label: "Fase 5", dates: "29 Okt", what: "Reflekteer – ons meet of dit gewerk het.", ready: "Werkblad 11" },
  { key: "ekspo1", label: "Ekspo", dates: "2 Nov", what: "Ons berei die ekspo voor.", ready: "Werkblad 12 – 14", kind: "expo" },
  { key: "ekspo2", label: "Ekspo", dates: "3 Nov", what: "Ons wys wat ons gedoen het.", ready: "Almal praat!", kind: "expo" }
];

const EXPO_GOALS = [
  { title: "Die probleem", text: "wat het ons gesien, en presies waar?" },
  { title: "Die navorsing", text: "wat het ons uitgevind, en uit watter vakke?" },
  { title: "Die oplossing", text: "wat het ons gekies, en hoekom juis dit?" },
  { title: "Die uitvoering", text: "foto’s en bewyse dat ons dit regtig gedoen het." },
  { title: "Die resultate", text: "wat gewerk het en wat nie gewerk het nie." },
  { title: "Die refleksie", text: "wat sou ons anders doen, en wat moet nou volgende gebeur?" }
];

const ta = (key: string, label: string, rows = 4, extra: Partial<Field> = {}): Field =>
  ({ type: "textarea", key, label, rows, required: true, ...extra }) as Field;

export function buildVolTemplate(o: VolOptions): Template {
  const checkpoints: CheckpointDef[] = [
    { number: 1, title: "Kontrolepunt 1", statement: "Ons probleemstelling is spesifiek genoeg en ons kan dit werklik aanpak.", sheets: ["ws1", "ws2", "ws3"] },
    { number: 2, title: "Kontrolepunt 2", statement: "Die integrering van kennis en oorweging van moontlike oplossings is goedgekeur, julle mag verder gaan met die beplanning.", sheets: ["ws4", "ws5"] },
    { number: 3, title: "Kontrolepunt 3", statement: "Die plan, die begroting en die veiligheidsplan is goedgekeur. Julle mag begin.", sheets: ["ws6", "ws7", "ws8"] },
    { number: 4, title: "Kontrolepunt 4", statement: "Bewyse van uitvoering en data is in orde.", sheets: ["ws9", "ws10"] },
    { number: 5, title: "Kontrolepunt 5", statement: o.checkpoint5Statement, sheets: ["ws11"] },
    { number: 6, title: "Kontrolepunt 6", statement: "Stalletjie en aanbieding is gereed vir die ekspo.", sheets: ["ws12", "ws13", "ws14"] }
  ];

  const sheets: Sheet[] = [
    // ------------------------------------------------------------------ Voorblad
    {
      key: "voorblad",
      number: null,
      title: "Ons groep",
      intro: "Vul julle groepnaam, klas en die voorname van die lede in. Name bly in die skool se stelsel en word nooit na die KI gestuur nie.",
      phase: null,
      checkpoint: null,
      feedback: false,
      sections: [
        {
          fields: [
            { type: "text", key: "groepnaam", label: "Ons groepnaam", required: true, placeholder: "bv. Die Rentmeesters" },
            { type: "text", key: "klas", label: "Klas", required: true, placeholder: `bv. ${o.grade}A` },
            { type: "text", key: "lid1", label: "Lid 1 (voornaam)", required: true },
            { type: "text", key: "lid2", label: "Lid 2 (voornaam)", required: true },
            { type: "text", key: "lid3", label: "Lid 3 (voornaam)" },
            { type: "text", key: "lid4", label: "Lid 4 (voornaam)" }
          ]
        }
      ],
      criteria: []
    },

    // ------------------------------------------------------------------ Werkblad 1
    {
      key: "ws1",
      number: 1,
      title: "Ons groep en ons rolle",
      intro: "Elke lid kry ’n rol. Die rol beteken nie jy doen daardie werk alleen nie – dit beteken jy maak seker dit gebeur.",
      phase: 1,
      checkpoint: 1,
      feedback: true,
      sections: [
        {
          fields: [
            {
              type: "table",
              key: "rolle",
              title: "Die rolle",
              requireAllRows: true,
              rowHeader: "Rol",
              required: true,
              rows: ROLES,
              columns: [
                { key: "taak", label: "Jy maak seker dat…", kind: "static" },
                { key: "naam", label: "Naam", kind: "member", width: "11rem" }
              ]
            }
          ]
        },
        {
          title: "Ons groepreëls",
          intro: "Skryf drie reëls neer waarmee almal saamstem. Byvoorbeeld: hoe ons besluit wanneer ons verskil, of wat ons doen as iemand nie sy deel doen nie.",
          fields: [{ type: "list", key: "groepreels", count: 3, minFilled: 3, required: true, placeholder: "Ons reël…" }]
        }
      ],
      criteria: [
        { id: "rolle", title: "Elke rol het ’n lid", description: "Al vier rolle (Projekleier, Navorser en skrywer, Materiaal en veiligheid, Kommunikeerder) is aan ’n groeplid toegeken. In ’n groep van drie mag een lid twee rolle hê." },
        { id: "drie-reels", title: "Drie groepreëls", description: "Daar is drie afsonderlike groepreëls waarmee almal saamstem." },
        { id: "bruikbaar", title: "Reëls is bruikbaar", description: "Die reëls is konkreet en help in werklike situasies – byvoorbeeld hoe die groep besluit wanneer lede verskil, of wat gebeur as iemand nie sy deel doen nie. Vae reëls soos “ons werk hard” is nie genoeg nie." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 2
    {
      key: "ws2",
      number: 2,
      title: "Wat het ons op die uitstappie gesien?",
      intro: "Begin by julle eie oë. Wat het julle self waargeneem – nie wat julle op die internet gelees het nie.",
      phase: 1,
      checkpoint: 1,
      feedback: true,
      sections: [
        {
          fields: [
            {
              type: "table",
              key: "waarnemings",
              title: "Die waarnemings",
              required: true,
              initialRows: 4,
              minRows: 3,
              maxRows: 10,
              addLabel: "Nog ’n waarneming",
              columns: [
                { key: "gesien", label: "Wat ons gesien het", kind: "textarea" },
                { key: "waar", label: "Presies waar", kind: "textarea" },
                { key: "pla", label: "Hoekom dit ons pla", kind: "textarea" }
              ]
            }
          ]
        },
        {
          title: "Teken of plak ’n foto van die probleem",
          fields: [{ type: "photos", key: "fotos", max: 4, help: "Laai ’n foto of ’n foto van julle tekening op. Geen herkenbare mense sonder toestemming nie." }]
        }
      ],
      criteria: [
        { id: "drie", title: "Ten minste drie waarnemings", description: "Daar is ten minste drie afsonderlike waarnemings." },
        { id: "eie-oe", title: "Eie waarnemings", description: "Die waarnemings is dinge wat die groep self op die uitstappie gesien het – nie algemene feite of inligting van die internet nie." },
        { id: "presies-waar", title: "Presies waar", description: "Elke waarneming sê presies waar dit was (’n spesifieke plek), nie net algemeen soos “op die berg” of “in die stad” nie." },
        { id: "hoekom", title: "Hoekom dit pla", description: "By elke waarneming verduidelik die groep in eie woorde hoekom dit hulle pla." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 3
    {
      key: "ws3",
      number: 3,
      title: "Ons probleemstelling",
      phase: 1,
      checkpoint: 1,
      feedback: true,
      context: ["ws2"],
      sections: [
        {
          fields: [
            { type: "info", key: "info", tone: "tip", title: "Maak dit klein en maak dit werklik", body: o.problemInfo.body, examples: o.problemInfo.examples }
          ]
        },
        { title: "Stap 1: Die groot probleem", fields: [ta("groot", "", 3)] },
        { title: "Stap 2: Ons klein stukkie van daardie probleem", fields: [ta("klein", "", 3)] },
        {
          title: "Stap 3: Ons probleemstelling",
          intro: "Skryf dit as een duidelike vraag wat met “Hoe kan ons…” begin.",
          fields: [ta("stelling", "", 3, { placeholder: "Hoe kan ons…" })]
        },
        { title: "Stap 4: Drie vrae wat ons moet ondersoek", fields: [{ type: "list", key: "vrae", count: 3, minFilled: 3, required: true }] },
        { title: "Stap 5: Hoekom is hierdie probleem belangrik?", fields: [ta("belangrik", "", 6)] }
      ],
      criteria: [
        { id: "groot", title: "Die groot probleem", description: "Stap 1 beskryf die groter probleem waaraan die groep werk." },
        { id: "klein", title: "Ons klein stukkie", description: "Stap 2 maak die probleem kleiner: ’n konkrete, afgebakende deel wat die groep binne die projektyd (tot einde Oktober) kan aanpak." },
        { id: "hoe-kan-ons", title: "Een “Hoe kan ons…”-vraag", description: "Die probleemstelling is één duidelike vraag wat met “Hoe kan ons…” begin." },
        { id: "spesifiek", title: "Nie te groot, nie te eenvoudig nie", description: "Die probleemstelling is spesifiek (wat, vir wie, waar) en werklik doenbaar – nie so groot soos die hele verskynsel nie, en nie so vaag of eenvoudig soos die “te eenvoudig”-voorbeeld nie. Vergelyk met die voorbeelde op die werkblad." },
        { id: "waarnemings", title: "Sluit aan by waarnemings", description: "Die probleemstelling hou verband met wat die groep self op die uitstappie waargeneem het (werkblad 2)." },
        ...(o.problemExtraCriteria ?? []),
        { id: "ondersoekvrae", title: "Drie ondersoekvrae", description: "Daar is drie vrae wat die groep werklik kan ondersoek, en wat hulle sal help om die probleem beter te verstaan voordat hulle ’n oplossing kies." },
        { id: "belangrik", title: "Hoekom dit belangrik is", description: "Stap 5 verduidelik in eie woorde hoekom die probleem saak maak: vir wie of wat, en wat gebeur as niks gedoen word nie." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 4
    {
      key: "ws4",
      number: 4,
      title: "Wat weet ons al uit ons vakke?",
      intro: "Julle het reeds in baie vakke aan hierdie tema gewerk. Gebruik dit – dit is klaar gedoen. Vul in wat julle uit elke vak kan gebruik. Maak ook ’n lys van vakke wat julle kan help en hoe.",
      phase: 2,
      checkpoint: 2,
      feedback: true,
      context: ["ws3"],
      sections: [
        {
          fields: [
            {
              type: "table",
              key: "vakke",
              title: "Die vakke-tabel",
              required: true,
              initialRows: 5,
              minRows: 4,
              maxRows: 12,
              addLabel: "Nog ’n vak",
              columns: [
                { key: "vak", label: "Vak", kind: "text", width: "10rem" },
                { key: "geleer", label: "Wat ons daar geleer het / wat kan ons daar leer", kind: "textarea" },
                { key: "help", label: "Hoe dit ons help", kind: "textarea" }
              ]
            }
          ]
        }
      ],
      criteria: [
        { id: "vakke", title: "Verskeie vakke", description: "Ten minste vier verskillende vakke is ingevul." },
        { id: "inhoud", title: "Spesifieke kennis", description: "By elke vak staan spesifiek wát die groep geleer het of kan leer (’n begrip, vaardigheid of feit) – nie net “ons het daaroor geleer” nie." },
        { id: "koppel", title: "Gekoppel aan ons probleem", description: "“Hoe dit ons help” wys duidelik hoe die kennis help om húlle probleemstelling (werkblad 3) aan te pak." },
        { id: "bronne", title: "Feite met bronne", description: "Waar die groep ’n feit of syfer gebruik, word gesê waar dit vandaan kom (vak, handboek, persoon of webwerf). Kennis is korrek." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 5
    {
      key: "ws5",
      number: 5,
      title: "Drie moontlike probleemoplossings",
      intro: "Die eerste idee is selde die beste een. Skryf drie idees neer voordat julle kies.",
      phase: 2,
      checkpoint: 2,
      feedback: true,
      context: ["ws3", "ws4"],
      sections: [
        {
          fields: [
            {
              type: "table",
              key: "idees",
              title: "Die drie idees",
              requireAllRows: true,
              required: true,
              rowHeader: "",
              rows: [
                { key: "1", label: "Idee 1" },
                { key: "2", label: "Idee 2" },
                { key: "3", label: "Idee 3" }
              ],
              columns: [
                { key: "idee", label: "Ons idee", kind: "textarea" },
                { key: "voordele", label: "Voordele", kind: "textarea" },
                { key: "nadele", label: "Nadele", kind: "textarea" }
              ]
            }
          ]
        },
        {
          title: "Keusematriks",
          intro: "Gee vir elke idee ’n punt uit 5. Tel op. Die hoogste telling is gewoonlik die beste keuse – maar julle mag anders besluit as julle dit kan motiveer.",
          fields: [
            {
              type: "matrix",
              key: "matriks",
              required: true,
              rowHeader: "Vraag",
              min: 1,
              max: 5,
              totalLabel: "TOTAAL",
              cols: [
                { key: "1", label: "Idee 1" },
                { key: "2", label: "Idee 2" },
                { key: "3", label: "Idee 3" }
              ],
              rows: [
                { key: "tyd", label: "Kan ons dit werklik doen in die tyd wat ons het?" },
                { key: "probleem", label: "Spreek dit die spesifieke probleem self aan?" },
                { key: "volhoubaar", label: "Hou dit aan werk nadat ons klaar is?" },
                { key: "koste", label: "Kan ons dit bekostig?" },
                { key: "veilig", label: "Is dit veilig en toelaatbaar?" },
                { key: "meet", label: "Kan ons meet of dit gewerk het?" }
              ]
            }
          ]
        },
        {
          title: "Ons kies idee nommer ___ omdat…",
          fields: [
            { type: "choice", key: "keuse", label: "Ons kies idee nommer", required: true, inline: true, options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }] },
            ta("omdat", "omdat…", 5)
          ]
        }
      ],
      criteria: [
        { id: "verskillend", title: "Drie werklik verskillende idees", description: "Die drie idees is wesenlik verskillend – nie drie variasies van dieselfde idee nie – en elkeen spreek die probleemstelling aan." },
        { id: "voor-nadele", title: "Eerlike voordele en nadele", description: "Elke idee het ten minste een eerlike voordeel én een eerlike nadeel." },
        { id: "matriks", title: "Matriks volledig", description: "Die keusematriks het ’n punt (1–5) vir elke vraag en elke idee." },
        { id: "motivering", title: "Keuse gemotiveer", description: "Die gekose idee word gemotiveer met verwysing na die matriks en die voor- en nadele. As die gekose idee nie die hoogste telling het nie, verduidelik die groep oortuigend hoekom." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 6
    {
      key: "ws6",
      number: 6,
      title: "Ons oplossingsvoorstel",
      intro: "Julle mag nie begin bou of doen voordat hierdie bladsy afgeteken is nie.",
      phase: 3,
      checkpoint: 3,
      feedback: true,
      context: ["ws3", "ws5"],
      sections: [
        { title: "1. Wat gaan ons doen?", fields: [ta("wat", "", 6)] },
        { title: "2. Hoekom hierdie oplossing en nie een van die ander twee nie?", fields: [ta("hoekom", "", 5)] },
        { title: "3. Wat benodig ons?", fields: [ta("benodig", "", 4)] },
        { title: "4. Wie gaan ons help, en wie moet toestemming gee?", fields: [ta("wie", "", 4)] },
        { title: "5. Wanneer gaan ons wat doen?", fields: [ta("wanneer", "", 4, { help: "Fase 4 (uitvoering) is van 19 tot 28 Oktober." })] },
        { title: "6. Hoe gaan ons weet of dit gewerk het?", fields: [ta("meet", "", 4)] }
      ],
      criteria: [
        { id: "konkreet", title: "Konkreet en duidelik", description: "Iemand buite die groep kan presies verstaan wat die groep gaan doen: wat, waar en vir wie. Die oplossing sluit aan by die probleemstelling (werkblad 3) en die gekose idee (werkblad 5)." },
        { id: "hoekom", title: "Hoekom nie die ander twee nie", description: "Die groep verwys na die ander twee idees van werkblad 5 en verduidelik hoekom hierdie een beter is." },
        { id: "benodig", title: "Wat ons benodig", description: "Die hulpbronne, materiaal en hulp wat nodig is, word gelys." },
        { id: "toestemming", title: "Hulp en toestemming", description: `Die groep sê wie hulle gaan help en wie toestemming moet gee (bv. die skool, ouers, ${o.partner}).` },
        { id: "tydlyn", title: "Tydlyn", description: "Aksies is aan datums of dae gekoppel, realisties binne die uitvoeringsfase (19 – 28 Oktober)." },
        { id: "meetbaar", title: "Meetbare sukses", description: "Die groep sê hoe hulle sal weet dit het gewerk – met iets wat getel, gemeet of met bewyse gewys kan word (bv. voor-en-na, hoeveelhede, terugvoer)." },
        { id: "haalbaar", title: "Haalbaar en eerlik", description: "Die plan is binne die groep se tyd, geld en vermoëns, en belowe niks wat die groep nie kan lewer nie." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 7
    {
      key: "ws7",
      number: 7,
      title: "Materiaallys en begroting",
      phase: 3,
      checkpoint: 3,
      feedback: true,
      context: ["ws6"],
      sections: [
        {
          fields: [
            {
              type: "table",
              key: "items",
              title: "Die materiaallys",
              required: true,
              initialRows: 4,
              minRows: 1,
              maxRows: 25,
              addLabel: "Nog ’n item",
              total: { column: "koste", label: "TOTALE KOSTE" },
              columns: [
                { key: "item", label: "Item", kind: "text" },
                { key: "hoeveel", label: "Hoeveel", kind: "text", width: "7rem" },
                { key: "waar", label: "Waar kry ons dit?", kind: "text" },
                { key: "koste", label: "Koste (R)", kind: "currency", width: "8rem" }
              ]
            }
          ]
        },
        { title: "Wie betaal, en wat doen ons as dit te duur is?", fields: [ta("betaal", "", 5)] }
      ],
      criteria: [
        { id: "volledig", title: "Alles gelys", description: "Die items wat vir die oplossing in werkblad 6 nodig is, is op die lys." },
        { id: "besonderhede", title: "Hoeveel, waar en koste", description: "Elke item het ’n hoeveelheid, waar dit vandaan kom, en ’n koste (R0 as dit geskenk of geleen word)." },
        { id: "realisties", title: "Realistiese begroting", description: "Die bedrae en totaal is realisties vir die items en hoeveelhede." },
        { id: "betaal", title: "Wie betaal + plan B", description: "Dit is duidelik wie betaal, en daar is ’n konkrete plan as dit te duur is." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 8
    {
      key: "ws8",
      number: 8,
      title: "Ons veiligheidsplan",
      phase: 3,
      checkpoint: 3,
      feedback: true,
      context: ["ws6"],
      sections: [
        {
          intro: "Stel ’n veiligheidsplan op vir julle projek. Die veiligheid van die kinders en die omgewing moet in ag geneem word.",
          fields: [
            {
              type: "table",
              key: "risiko",
              title: "Die risiko-tabel",
              required: true,
              initialRows: 4,
              minRows: 3,
              maxRows: 12,
              addLabel: "Nog ’n risiko",
              columns: [
                { key: "wat", label: "Wat kan verkeerd loop?", kind: "textarea" },
                { key: "erg", label: "Hoe erg is dit?", kind: "select", options: ["Klein", "Matig", "Ernstig"], width: "8rem" },
                { key: "keer", label: "Wat doen ons om dit te keer?", kind: "textarea" }
              ]
            }
          ]
        },
        {
          title: "Onderwyser se kommentaar",
          intro: "Lê die plan met veiligheidsmaatreëls voor aan die projekleier (onderwysers) voor julle met die projek aangaan. Die onderwyser vul die kommentaar hier in.",
          fields: [{ type: "teacherNote", key: "onderwyser" }]
        }
      ],
      criteria: [
        { id: "risiko", title: "Realistiese risiko’s", description: "Ten minste drie realistiese dinge wat by húlle spesifieke projek kan verkeerd loop." },
        { id: "mense-omgewing", title: "Kinders én omgewing", description: "Die plan neem die veiligheid van die kinders (leerders) én van die omgewing in ag." },
        { id: "ernstigheid", title: "Hoe erg", description: "Elke risiko het ’n ernstigheidsgraad wat sin maak." },
        { id: "keer", title: "Konkrete maatreëls", description: "By elke risiko staan ’n konkrete, uitvoerbare maatreël om dit te keer of te hanteer – nie net “ons sal versigtig wees” nie." },
        ...(o.safetyExtraCriteria ?? [])
      ]
    },

    // ------------------------------------------------------------------ Werkblad 9
    {
      key: "ws9",
      number: 9,
      title: "Uitvoeringslogboek",
      intro: "Vul dit in op die dag self. Dit is die bewys dat julle die werk gedoen het.",
      phase: 4,
      checkpoint: 4,
      feedback: true,
      context: ["ws6"],
      sections: [
        {
          fields: [
            {
              type: "entries",
              key: "inskrywings",
              title: "Die logboek",
              entryLabel: "Inskrywing",
              required: true,
              minEntries: 1,
              maxEntries: 20,
              fields: [
                { key: "datum", label: "Datum", kind: "date" },
                { key: "wat", label: "Wat ons gedoen het", kind: "textarea" },
                { key: "wie", label: "Wie het wat gedoen", kind: "textarea" },
                { key: "gewerk", label: "Wat gewerk het", kind: "textarea" },
                { key: "nie", label: "Wat nie gewerk het nie", kind: "textarea" },
                { key: "verander", label: "Wat ons volgende keer gaan verander", kind: "textarea" }
              ]
            }
          ]
        }
      ],
      criteria: [
        { id: "inskrywings", title: "Gereelde inskrywings", description: "Daar is ten minste twee gedateerde inskrywings, binne die uitvoeringstyd." },
        { id: "volledig", title: "Elke inskrywing volledig", description: "Elke inskrywing het al ses dele ingevul." },
        { id: "spesifiek", title: "Spesifiek", description: "Die inskrywings sê presies wat gedoen is (hoeveel, waar, hoe lank) – nie net “ons het gewerk” nie." },
        { id: "almal", title: "Almal het bygedra", description: "“Wie het wat gedoen” wys dat elke lid ’n deel gehad het." },
        { id: "aanpas", title: "Eerlik en aanpasbaar", description: "Die groep is eerlik oor wat nie gewerk het nie en sê wat hulle volgende keer sal verander." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 10
    {
      key: "ws10",
      number: 10,
      title: "Ons bewyse",
      intro: "Merk af wat julle reeds het. Alles wat julle by die ekspo sê, moet hier ’n bewys hê.",
      phase: 4,
      checkpoint: 4,
      feedback: true,
      context: ["ws6", "ws9"],
      sections: [
        {
          fields: [
            {
              type: "table",
              key: "bewyse",
              title: "Die bewyse-lys",
              required: true,
              rowHeader: "Bewys",
              rows: o.evidenceRows,
              columns: [
                { key: "het", label: "Het ons dit? (✓)", kind: "check", width: "8rem" },
                { key: "waar", label: "Waar is dit?", kind: "text" }
              ]
            }
          ]
        },
        ...(o.evidenceDataTable
          ? [
              {
                title: "Ons data",
                fields: [
                  {
                    type: "table",
                    key: "data",
              title: "Ons data",
                    required: true,
                    initialRows: 3,
                    minRows: 1,
                    maxRows: 20,
                    addLabel: "Nog ’n ry",
                    columns: [
                      { key: "wat", label: "Wat ons gedoen het", kind: "textarea" },
                      { key: "waar", label: "Waar", kind: "text" },
                      { key: "wanneer", label: "Wanneer", kind: "text", width: "8rem" },
                      { key: "resultaat", label: "Resultaat", kind: "textarea" }
                    ]
                  } as Field
                ]
              }
            ]
          : []),
        {
          title: "Bewysfoto’s (opsioneel)",
          fields: [{ type: "photos", key: "fotos", max: 8, help: "Foto’s van die proses en van “voor” en “na”. Geen herkenbare mense sonder toestemming nie." }]
        }
      ],
      criteria: [
        { id: "kern", title: "Kernbewyse", description: "Die groep het die belangrikste bewyse: foto’s van die proses (nie net die eindproduk nie), “voor” en “na”, en hulle resultate of metings." },
        { id: "waar", title: "Waar is dit?", description: "Vir elke bewys wat afgemerk is, staan waar dit is (bv. in watter lêer, op wie se foon, op die plakkaat)." },
        ...(o.evidenceDataTable
          ? [{ id: "data", title: "Ons data", description: "Die datatabel sê konkreet wat gedoen is, waar, wanneer en wat die (meetbare) resultaat was." }]
          : [{ id: "metings", title: "Metings of tellings", description: "Die groep het iets getel of gemeet wat wys wat die resultaat was." }]),
        { id: "eerlik", title: "Bewyse pas by die logboek", description: "Die bewyse pas by wat in die uitvoeringslogboek (werkblad 9) staan; daar word niks beweer wat nie bewys kan word nie." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 11
    {
      key: "ws11",
      number: 11,
      title: "Het dit gewerk?",
      phase: 5,
      checkpoint: 5,
      feedback: true,
      context: ["ws3", "ws6", "ws9", "ws10"],
      sections: [
        { title: "Ons het gesê ons sal weet dit werk as…", fields: [ta("gese", "", 5, { help: "Kyk terug na werkblad 6, vraag 6." })] },
        { title: "Wat het werklik gebeur?", fields: [ta("gebeur", "", 6)] },
        { title: "Gee bewyse of foto’s van julle projek", fields: [{ type: "photos", key: "fotos", max: 8 }] },
        {
          title: "Wat het NIE gewerk nie – en wat het ons daaruit geleer?",
          intro: "Wees eerlik. ’n Groep wat verduidelik wat misluk het, kry meer punte as ’n groep wat maak of alles perfek was.",
          fields: [ta("niegewerk", "", 5)]
        },
        {
          title: "Wat kan ons bewys – en wat kan ons nié bewys nie?",
          intro: "Wees eerlik. “Ons het een behoefte vir twee weke aangespreek” is ’n beter antwoord as “ons het ’n groot verskil gemaak” sonder bewyse.",
          fields: [ta("bewys", "", 4)]
        },
        { title: "Is die projek volhoubaar? Wat moet ná ons projek gebeur?", fields: [ta("volhoubaar", "", 4)] },
        { title: "Was ons oplossing spesifiek genoeg of uitvoerbaar?", fields: [ta("uitvoerbaar", "", 4)] },
        {
          title: "Hoe het ons met ons oplossing die ondersoekvraag aangespreek?",
          intro: `Ondersoekvraag: ${o.question}`,
          fields: [ta("ondersoekvraag", "", 5)]
        }
      ],
      criteria: [
        { id: "kriteria", title: "Terug na ons sukses-maatstaf", description: "Wat hulle sê “ons sal weet dit werk as…” stem ooreen met wat hulle in werkblad 6 (vraag 6) beplan het." },
        { id: "gebeur", title: "Wat werklik gebeur het", description: "Die groep beskryf met konkrete resultate (getalle, waarnemings, terugvoer) wat werklik gebeur het, en vergelyk dit met wat hulle verwag het." },
        { id: "geleer", title: "Eerlik oor wat nie gewerk het nie", description: "Die groep noem eerlik wat nie gewerk het nie en wat hulle daaruit geleer het." },
        { id: "bewys", title: "Bewys teenoor bewering", description: "Die groep onderskei duidelik tussen wat hulle kan bewys en wat nie, sonder oordrewe aansprake." },
        { id: "volhoubaar", title: "Volhoubaarheid", description: "Daar is ’n konkrete volgende stap: wat moet ná die projek gebeur, en deur wie." },
        { id: "uitvoerbaar", title: "Krities oor ons plan", description: "Die groep evalueer krities of hul oplossing spesifiek en uitvoerbaar genoeg was." },
        { id: "ondersoekvraag", title: "Die ondersoekvraag", description: `Die groep verbind hul projek in eie woorde met die ondersoekvraag: “${o.question}”` }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 12
    {
      key: "ws12",
      number: 12,
      title: "Ons ekspo-stalletjie",
      phase: 6,
      checkpoint: 6,
      feedback: true,
      sections: [
        {
          title: "Teken die uitleg van julle tafel",
          intro: "Waar gaan die plakkaat, die model, die foto’s en die data wees? Onthou: ’n besoeker moet julle storie van links na regs kan volg: probleem, navorsing, oplossing, uitvoering, resultate, refleksie.",
          fields: [
            { type: "photos", key: "uitleg", max: 2, help: "Teken die uitleg op papier en laai ’n foto daarvan op." },
            ta("beskrywing", "Beskryf die uitleg van links na regs", 5)
          ]
        },
        {
          title: "Kontrolelys vir die stalletjie",
          fields: [
            {
              type: "table",
              key: "kontrolelys",
              title: "Die kontrolelys",
              required: true,
              rowHeader: "Ons stalletjie wys…",
              rows: [
                { key: "probleem", label: "die probleem en presies waar dit is" },
                { key: "navorsing", label: "ons navorsing en waar dit vandaan kom" },
                { key: "oplossing", label: "die oplossing wat ons gekies het en hoekom" },
                { key: "fotos", label: "foto’s van ons wat dit uitvoer" },
                { key: "data", label: "ons data en grafieke" },
                { key: "refleksie", label: "ons refleksie en die volgende stap" }
              ],
              columns: [
                { key: "klaar", label: "Klaar? (✓)", kind: "check", width: "7rem" },
                { key: "wie", label: "Wie is verantwoordelik?", kind: "member", width: "11rem" }
              ]
            },
            {
              type: "table",
              key: "ekstra",
              label: "Voeg nog kontrolepunte by",
              initialRows: 1,
              minRows: 0,
              maxRows: 10,
              addLabel: "Nog ’n punt",
              columns: [
                { key: "punt", label: "Ons stalletjie wys…", kind: "text" },
                { key: "klaar", label: "Klaar? (✓)", kind: "check", width: "7rem" },
                { key: "wie", label: "Wie is verantwoordelik?", kind: "member", width: "11rem" }
              ]
            }
          ]
        }
      ],
      criteria: [
        { id: "uitleg", title: "Uitleg beplan", description: "Die uitleg (tekening en/of beskrywing) wys waar die plakkaat, model, foto’s en data gaan wees." },
        { id: "storie", title: "Links na regs", description: "’n Besoeker kan die storie van links na regs volg: probleem, navorsing, oplossing, uitvoering, resultate, refleksie." },
        { id: "verantwoordelik", title: "Elke punt het ’n eienaar", description: "Elke item op die kontrolelys het ’n verantwoordelike lid." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 13
    {
      key: "ws13",
      number: 13,
      title: "Ons aanbieding",
      intro: "Die aanbieding moet ongeveer 5 minute duur. Elke lid van die groep moet praat.",
      phase: 6,
      checkpoint: 6,
      feedback: true,
      context: ["ws3", "ws6", "ws11"],
      sections: [
        {
          title: "Gee ’n volledige uiteensetting van julle aanbieding",
          intro: "Let wel: die proses moet deursigtig wees en goed uiteengesit, sodat elkeen presies weet wat om te doen.",
          fields: [ta("uiteensetting", "", 12)]
        },
        {
          title: "Drie vrae wat besoekers waarskynlik gaan vra – en ons antwoorde",
          fields: [
            {
              type: "table",
              key: "vrae",
              required: true,
              requireAllRows: true,
              rowHeader: "",
              rows: [
                { key: "1", label: "1" },
                { key: "2", label: "2" },
                { key: "3", label: "3" }
              ],
              columns: [
                { key: "vraag", label: "Vraag", kind: "textarea" },
                { key: "antwoord", label: "Ons antwoord", kind: "textarea" }
              ]
            }
          ]
        }
      ],
      criteria: [
        { id: "ses", title: "Die ses dinge", description: "Die uiteensetting dek die probleem, die navorsing, die oplossing, die uitvoering, die resultate en die refleksie." },
        { id: "almal", title: "Elke lid praat", description: "Dit is duidelik watter lid (of rol) watter deel aanbied, en elke lid praat." },
        { id: "tyd", title: "Ongeveer 5 minute", description: "Die volgorde en tydsindeling is duidelik en pas binne ongeveer 5 minute." },
        { id: "vrae", title: "Drie besoekersvrae", description: "Daar is drie realistiese vrae wat besoekers sal vra, met eerlike, goeie antwoorde." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 14
    {
      key: "ws14",
      number: 14,
      title: "Is ons gereed?",
      intro: "Gaan hierdie lys saam deur voor die ekspo.",
      phase: 6,
      checkpoint: 6,
      feedback: true,
      sections: [
        {
          fields: [
            {
              type: "table",
              key: "gereed",
              title: "Die gereedheidslys",
              required: true,
              requireAllRows: true,
              rowHeader: "",
              rows: [
                { key: "probleem", label: "Ons probleemstelling is afgeteken" },
                { key: "voorstel", label: "Ons oplossingsvoorstel is afgeteken" },
                { key: "uitgevoer", label: "Ons het die oplossing werklik uitgevoer" },
                { key: "logboek", label: "Ons logboek is volledig ingevul" },
                { key: "fotos", label: "Ons het foto’s van die proses" },
                { key: "eerlik", label: "Ons het eerlik gereflekteer oor wat nie gewerk het nie" },
                { key: "gepak", label: "Ons stalletjie is gepak en getoets" },
                { key: "weet", label: "Elke lid weet presies wat hy of sy gaan sê" },
                { key: "geoefen", label: "Ons het die aanbieding met ’n horlosie geoefen" }
              ],
              columns: [
                { key: "ja", label: "Ja / Nog nie", kind: "select", options: ["Ja", "Nog nie"], width: "9rem" },
                { key: "kort", label: "Wat kort nog?", kind: "text", optional: true }
              ]
            }
          ]
        }
      ],
      criteria: [
        { id: "alles", title: "Alles beantwoord", description: "By elke item is “Ja” of “Nog nie” gekies." },
        { id: "kort", title: "Plan vir wat kort", description: "By elke “Nog nie” staan presies wat nog kort." },
        { id: "eerlik", title: "Eerlik", description: "Die antwoorde stem ooreen met die werklike stand van die werkboek (bv. kontrolepunte wat werklik afgeteken is)." }
      ]
    },

    // ------------------------------------------------------------------ Werkblad 15
    {
      key: "ws15",
      number: 15,
      title: "My persoonlike refleksie",
      intro: "Hierdie bladsy vul elke lid van die groep op sy of haar eie in.",
      phase: null,
      checkpoint: null,
      perMember: true,
      feedback: true,
      sections: [
        { title: "Verduidelik volledig jou rol in die groep. Vertel ook hoe jy gegroei het van begin tot einde.", fields: [ta("rol", "", 6)] },
        { title: "Waarop is ek trots?", fields: [ta("trots", "", 4)] },
        { title: "Identifiseer uitdagings en hoe jy dit hanteer het.", fields: [ta("uitdagings", "", 4)] },
        { title: "Iets wat ek nou verstaan wat ek voorheen nie verstaan het nie:", fields: [ta("verstaan", "", 4)] },
        { title: "As ek môre weer moes begin, sou ek…", fields: [ta("weer", "", 4)] },
        { title: "Wat hierdie projek my geleer het oor om te bewoon, te bewerk en te bewaar:", fields: [ta("bewaar", "", 4)] }
      ],
      criteria: [
        { id: "rol", title: "My rol en groei", description: "Die leerder verduidelik sy of haar rol volledig en beskryf konkreet hoe hy of sy van begin tot einde gegroei het." },
        { id: "trots", title: "Trots", description: "Die leerder noem iets spesifieks waarop hy of sy trots is, en hoekom." },
        { id: "uitdagings", title: "Uitdagings", description: "Die leerder noem ’n werklike uitdaging en hoe hy of sy dit hanteer het." },
        { id: "verstaan", title: "Nuwe begrip", description: "Die leerder beskryf iets konkreets wat hy of sy nou verstaan." },
        { id: "weer", title: "Anders doen", description: "Die leerder sê wat hy of sy anders sou doen, met ’n rede." },
        { id: "bewaar", title: "Bewoon, bewerk, bewaar", description: "Die leerder reflekteer in eie woorde oor wat die projek hom of haar geleer het oor om te bewoon, te bewerk en te bewaar." }
      ]
    }
  ];

  return {
    key: o.key,
    version: o.version,
    label: o.label,
    grade: o.grade,
    defaults: { phenomenon: o.phenomenon, question: o.question, partner: o.partner, place: o.place },
    intro: {
      how: "Hierdie werkboek vat julle stap vir stap van ’n probleem wat julle op die uitstappie gesien het, tot by ’n oplossing wat julle werklik gaan uitvoer en by die ekspo gaan wys.",
      howBullets: [
        "Een werkboek per groep. Julle werk word outomaties gestoor.",
        "Vul dit in soos julle werk, nie die aand voor die ekspo nie. Die werkboek is julle bewys.",
        "Ses keer moet ’n onderwyser ’n bladsy afteken voordat julle verder gaan. Dit is die kontrolepunte.",
        "Daar is nie een regte antwoord nie. Daar is net antwoorde wat julle kan bewys en antwoorde wat julle nie kan bewys nie."
      ],
      expoGoals: EXPO_GOALS,
      notExpected: o.notExpected
    },
    rules: o.rules,
    phases: PHASES,
    checkpoints,
    sheets,
    aiContext: o.aiContext
  };
}
