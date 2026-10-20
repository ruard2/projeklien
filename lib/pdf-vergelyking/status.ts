export const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  uitlees: { text: "Word uitgelees…", cls: "wait" },
  nagaan: { text: "Wag op jou akkoord", cls: "warn" },
  ki: { text: "KI-terugvoer word gemaak…", cls: "wait" },
  klaar: { text: "Klaar", cls: "ok" },
  fout: { text: "Fout", cls: "red" }
};

export const OOREENKOMS_LABEL: Record<string, { text: string; cls: string }> = {
  stem_ooreen: { text: "Stem ooreen", cls: "ok" },
  gedeeltelik: { text: "Gedeeltelik", cls: "warn" },
  verskil: { text: "Verskil", cls: "red" },
  geen_juf_kommentaar: { text: "Geen juf-kommentaar", cls: "plain" }
};

export const OORDEEL_LABEL: Record<string, { text: string; cls: string }> = {
  behaal: { text: "Behaal", cls: "ok" },
  gedeeltelik: { text: "Gedeeltelik", cls: "warn" },
  nie_behaal: { text: "Nie behaal", cls: "red" }
};
