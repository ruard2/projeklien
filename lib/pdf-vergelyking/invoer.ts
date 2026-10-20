// Invoer van werkboeke wat buite die app uitgelees is (bv. deur Claude), as een JSON-lêer.
// Formaat: { "werkboeke": [ { "werkboek": "vol-gr9-haweloosheid", "naam": "...", "groepnaam": "", "klas": "",
//   "lede": ["..."], "werkblaaie": { "ws1": { "data": {...}, "foto": false,
//   "juf": { "kommentaar": [], "kommentaar_vorige": [], "afgeteken": false, "afteken_datum": "" }, "onseker": [] } } } ] }

import { getTemplate } from "../werkboeke/sjablone";
import { cleanSheetData, extractableSheets, type Extracted } from "./skema";

export type ImportItem = { templateKey: string; name: string; extracted: Extracted };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lines = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => str(x, 1000)).filter(Boolean).slice(0, 40);

export function parseImport(raw: unknown): ImportItem[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? (raw as { werkboeke?: unknown }).werkboeke : null;
  if (!Array.isArray(list) || !list.length) throw new Error("Die lêer bevat geen werkboeke nie.");
  if (list.length > 60) throw new Error("Hoogstens 60 werkboeke per lêer.");
  return list.map((item, i) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const templateKey = str(r.werkboek);
    let template;
    try {
      template = getTemplate(templateKey);
    } catch {
      throw new Error(`Werkboek ${i + 1}: onbekende werkboek "${templateKey}".`);
    }
    const src = (r.werkblaaie ?? {}) as Record<string, Record<string, unknown>>;
    const sheets: Extracted["sheets"] = {};
    for (const s of extractableSheets(template)) {
      const e = src[s.key];
      if (!e) continue;
      const juf = (e.juf ?? {}) as Record<string, unknown>;
      sheets[s.key] = {
        data: cleanSheetData(s, e.data),
        foto: e.foto === true,
        juf: { kommentaar: lines(juf.kommentaar), kommentaar_vorige: lines(juf.kommentaar_vorige), afgeteken: juf.afgeteken === true, afteken_datum: str(juf.afteken_datum, 40) },
        onseker: lines(e.onseker)
      };
    }
    if (!Object.keys(sheets).length) throw new Error(`Werkboek ${i + 1}: geen werkblaaie nie.`);
    const lede = lines(r.lede).slice(0, 4);
    return {
      templateKey,
      name: str(r.naam, 120) || `Werkboek ${i + 1}`,
      extracted: { groepnaam: str(r.groepnaam, 60), klas: str(r.klas, 30), lede, sheets }
    };
  });
}
