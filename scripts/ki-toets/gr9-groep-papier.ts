// Werklike Graad 9-groep (papierwerkboek, WB1–8), oorgetik en reeds geanonimiseer.
// Geen leerder- of onderwysername nie: lede is "1".."4" (word "Lid n").
// WB3 het twee weergawes: die eerste poging (deur die onderwyser teruggestuur) en die hersiene weergawe.
import type { SheetData } from "../../lib/werkboeke/tipes";

export const members = ["", "", "", ""];
export const photoCounts: Record<string, Record<string, number>> = { ws2: { fotos: 1 } };

export const ws3Eerste: SheetData = {
  groot: "Haweloses word verag as gevolg van hoe hulle lyk en hoor nie van die Here nie. Hulle is sonder hoop.",
  klein:
    "Ons wil mense opbou en hoop gee deur Bybels en klere. Uit mense se klere kaste. Ons gaan mense se kaste dekluter deur dit aan armes te gee. Haweloses het nie genoeg klere nie en hulle is sonder hoop.",
  stelling: "Hoe kan vir mense klere versprei\nHoe kan ons vir mense die woord verkondig\nOns gaan die skool, die gemeentes, ouetehuis",
  vrae: [
    "Ons moet 'n organisasie vind wat Bybelse beginsel het",
    "Gaan klere werklik 'n oplossing wees",
    "Hoe gaan die Evangelie bring",
    "Hoe gaan ons hoop gee sonder om valse beloftes te maak?"
  ],
  belangrik:
    "As hulle nie geestelike ondersteuning kry nie gaan hulle terug na die strate en geen vordering help met haweloses nie. Mense voel nie waardig wanneer hulle werk soek nie. Hulle word ook nie in ag geneem nie."
};

export const data: Record<string, SheetData> = {
  ws1: {
    rolle: { projekleier: { naam: "4" }, navorser: { naam: "3" }, materiaal: { naam: "2" }, kommunikeerder: { naam: "1" } },
    groepreels: [
      "Moenie die werk alleen doen nie, maak net seker dit word gedoen.",
      "Sê betyds as jy nie jou deel kan klaarkry nie.",
      "Wees altyd bereid om ander groepslede te help."
    ]
  },
  ws2: {
    waarnemings: [
      { gesien: "Mense kan gehelp word en hulle kort hulp, maar word nie gehelp nie", waar: "Moeggesukkel -> help; Straat -> help nie", pla: "Mense gee partykeer geld maar kyk nie werklik wat die mense nodig het nie" },
      { gesien: "Mense het nie genoeg klere nie", waar: "Op straat", pla: "Klere is 'n behoefte, mense lyk verwaarloos" },
      { gesien: "Mense op straat besit nie Bybels nie", waar: "Op straat", pla: "Mense kan nie van die Here leer nie" },
      { gesien: "Mense het nie baie hoop nie", waar: "Op straat", pla: "Mense kan nie probeer as hulle nie hoop het nie" }
    ]
  },
  ws3: {
    groot: "Haweloses word verag as gevolg van hoe hulle lyk. (Health & Social Care in the Community (2024))",
    klein: "Haweloses het nie netjiese klere nie en lyk verwaarloos, wat lei tot veragting van ander mense.",
    stelling: "Hoe kan ons (plek) se inwoners help deur vir hulle klere te voorsien?",
    vrae: [
      "Waar gaan ons klere vir haweloses kry?",
      "Gaan klere werklik 'n oplossing wees?",
      "Sal dit ander mense inspireer om ook te help?"
    ],
    belangrik:
      "Haweloses kan nie hulp/werk kry as hulle verag word deur ander nie en hulle het geen motivering aan as hulle hulself verag nie.\nHierdie probleem is ook belangrik omdat God ons opdrag gegee het om na ons naaste om te sien."
  },
  ws4: {
    vakke: [
      { vak: "Afrikaans", geleer: "Maak 'n kort film van 'n tiener wat haweloos is", help: "Om bewusmaking" },
      { vak: "Engels", geleer: "Podcast, What would you do if you had nowhere to go", help: "Bewusmaking" },
      { vak: "Wiskunde", geleer: "Navorsing & statistiek", help: "Om op te merk uit die hoeveelheid haweloses" },
      { vak: "Bybel", geleer: "Wat vrae gevra oor hoe die Bybel haweloosheid sien", help: "Christelike perspektief" },
      { vak: "Tegnologie", geleer: "Ontwerp 'n model skuiling", help: "Kyk na oplossingsvaardighede" },
      { vak: "LO", geleer: "Die rol speel - kry verskillende scenarios en beeld uit", help: "Help om in te dink in hulle skoene" },
      { vak: "SW", geleer: "Maak 'n kaart van waar haweloses is", help: "Help om te sien waar hulle is" }
    ]
  },
  ws5: {
    idees: {
      "1": { idee: "Ons kan klere maak vir haweloses.", voordele: "Haweloses kry klere", nadele: "Dis moeilik en duur. Dit vat lank." },
      "2": { idee: "Ons kan 'n pamflet maak oor bewusmaking van haweloses sonder klere", voordele: "Mense weet meer van haweloses.", nadele: "Dit bied nie 'n fisiese oplossing nie." },
      "3": {
        idee: "Ons kan klere insamel en aan die (plek) gee om haweloses te help",
        voordele: "Haweloses kry klere en word minder verag. Bewusmaking, want mense weet dat haweloses klere benodig",
        nadele: "Ons het ander mense nodig wat klere kan skenk"
      }
    },
    matriks: {
      tyd: { "1": 1, "2": 5, "3": 5 },
      probleem: { "1": 4, "2": 3, "3": 5 },
      volhoubaar: { "1": 2, "2": 4, "3": 3 },
      koste: { "1": 2, "2": 4, "3": 5 },
      veilig: { "1": 5, "2": 5, "3": 5 },
      meet: { "1": 4, "2": 1, "3": 4 }
    },
    keuse: "3",
    omdat:
      "Ons kies idee nommer 3 omdat dit die hoogste puntetelling het, dit kry die gemeenskap betrokke, dis die meeste koste effektief, ons kan meet of dit gewerk het en dis doenbaar binne die gegewe tyd."
  },
  ws6: {
    wat: "Ons gaan klere insamel vir die haweloses wat deur die plek in 10de laan ondersteun word.",
    hoekom: "Hierdie oplossing is gekies omdat die ander oplossings nie koste of tyd effektief is nie, waar die 3de een is.",
    benodig: "Ons benodig klere skenkings en asook mense wat bereid is om te skenk en bokse om die klere in te stoor.",
    wie: "Ons ouers gaan ons help met vervoer. Die plek moet toestemming gee vir skenkings.",
    wanneer: "Deur die loop van die week tot 24 Oktober gaan ons klere skenkings uitsoek en sorteer en die 27ste die skenkings vir die plek gee.",
    meet: "Die plek vra of die klere die haweloses gehelp het. Ons gaan 'n brief stuur wat die plek kan invul om te sê of die klere skenkings werklik gehelp het."
  },
  ws7: {
    items: [
      { item: "Verpakking", hoeveel: "hang af", waar: "huise/groentewinkel", koste: "0" },
      { item: "Klere skenkings", hoeveel: "baie", waar: "skenkings", koste: "0" },
      { item: "Boekmerkies", hoeveel: "100", waar: "Lid 1 en laerskool kinders wat inkleur", koste: "0" }
    ],
    betaal: "Ons kort nie geld nie en steun op die gemeenskap se skenkings."
  },
  ws8: {
    risiko: [
      { wat: "Ons kan te min verpakking hê.", erg: "Klein", keer: "Ons maak seker dat ons betyds verpakking het." },
      { wat: "Ons kan te min klereskenkings hê.", erg: "Ernstig", keer: "Betyds adverteer en ook dankie sê dat ander mense ook sal wil skenk." },
      { wat: "Die plek het nie skenkings nodig nie.", erg: "Klein", keer: "Ons sal die plek vooraf vra en betyds 'n ander een kry." }
    ]
  }
};
