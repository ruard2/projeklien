export const DEV_FEEDBACK_STATUSES = ["nuut", "gelees", "verwerk"] as const;
export const REGRESSION_STATUSES = ["nie", "beplan", "bygevoeg"] as const;
export const EXPECTED_VERDICTS = ["behaal", "gedeeltelik", "nie_behaal", "nie_van_toepassing"] as const;
export const FEEDBACK_SCOPES = ["hierdie_antwoord", "hierdie_werkblad", "hierdie_werkboek", "alle_werkboeke"] as const;
export const AI_REPORT_CATEGORIES = ["onveilig", "onvanpas", "verkeerd", "antwoord_weggegee", "privaatheid", "ander"] as const;

export const ISSUE_TYPES = [
  "verkeerde_oordeel",
  "te_streng",
  "te_sag",
  "onduidelik",
  "antwoord_weggegee",
  "taal",
  "veiligheid_privaatheid",
  "ander"
] as const;

export const AI_REPORT_LABELS: Record<(typeof AI_REPORT_CATEGORIES)[number], string> = {
  onveilig: "Onveilige raad",
  onvanpas: "Onvanpaste of vernederende taal",
  verkeerd: "Verkeerde inligting",
  antwoord_weggegee: "Die KI gee die antwoord weg",
  privaatheid: "Privaatheidsprobleem",
  ander: "Ander probleem"
};

export function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return (values as readonly string[]).includes(value);
}

export function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseAiReport(value: unknown) {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const category = cleanText(raw.category, 40);
  const message = cleanText(raw.message, 1200);
  if (!isOneOf(category, AI_REPORT_CATEGORIES)) throw new Error("Kies asseblief wat verkeerd geloop het.");
  return { category, message };
}
