"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addRuleFromVote, chatVote, rerunSheetAction, setVote } from "@/app/onderwyser/pdf-aksies";
import type { ChatMsg, Omvang } from "@/lib/pdf-vergelyking/gesprek";

const OMVANG: { value: Omvang; label: string }[] = [
  { value: "kriterium", label: "Net hierdie kriterium" },
  { value: "werkblad", label: "Hele werkblad" },
  { value: "werkboek", label: "Hele werkboek" }
];

/** Een kriterium in die uitslagtabel: KI-oordeel, 👍/👎, en by 👎 ’n gesprek met die KI wat tot ’n reël kan lei. */
export default function PdfKriteriumRy(p: {
  comparisonId: string;
  sheet: string;
  criterionId: string;
  title: string;
  verdict: { text: string; cls: string };
  feedback: string;
  vote: number | null;
  chat: ChatMsg[];
  ruleText: string | null;
}) {
  const router = useRouter();
  const [vote, setVoteState] = useState<number | null>(p.vote);
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>(p.chat);
  const [text, setText] = useState("");
  const lastProposal = [...p.chat].reverse().find((m) => m.van === "ki" && m.reel);
  const [rule, setRule] = useState(p.ruleText ? "" : lastProposal?.reel ?? "");
  const [omvang, setOmvang] = useState<Omvang>(lastProposal?.omvang ?? "kriterium");
  const [ruleAdded, setRuleAdded] = useState<string | null>(p.ruleText);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = { id: p.comparisonId, sheet: p.sheet, criterion: p.criterionId };

  function up() {
    setError(null);
    start(async () => {
      const r = await setVote({ ...key, vote: 1 });
      if (r.error) return setError(r.error);
      setVoteState(r.vote);
      setOpen(false);
    });
  }
  function down() {
    setError(null);
    setOpen(true);
    if (vote === -1) return;
    start(async () => {
      const r = await setVote({ ...key, vote: -1 });
      if (r.error) return setError(r.error);
      setVoteState(r.vote);
    });
  }
  function send() {
    if (!text.trim()) return;
    setError(null);
    const msg = text;
    start(async () => {
      const r = await chatVote({ ...key, text: msg });
      if (r.error || !r.chat) return setError(r.error ?? "Iets het verkeerd geloop.");
      setChat(r.chat);
      setText("");
      setVoteState(-1);
      if (r.reel) {
        setRule(r.reel);
        setOmvang(r.omvang ?? "kriterium");
      }
    });
  }
  function addRule() {
    setError(null);
    start(async () => {
      const r = await addRuleFromVote({ ...key, text: rule, omvang });
      if (r.error) return setError(r.error);
      setRuleAdded(rule);
      setRule("");
    });
  }
  function rerun() {
    setError(null);
    setInfo("Die KI beoordeel die werkblad weer met al die reëls… (±1 minuut)");
    start(async () => {
      const r = await rerunSheetAction({ id: p.comparisonId, sheet: p.sheet });
      setInfo(null);
      if (r.error) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <>
      <tr>
        <td><b>{p.title}</b></td>
        <td><span className={`badge ${p.verdict.cls}`}>{p.verdict.text}</span></td>
        <td className="fb">{p.feedback}</td>
        <td className="votes">
          <button type="button" className={`vote up ${vote === 1 ? "on" : ""}`} onClick={up} disabled={pending} aria-label="Duim op" aria-pressed={vote === 1}>👍</button>
          <button type="button" className={`vote down ${vote === -1 ? "on" : ""}`} onClick={down} disabled={pending} aria-label="Duim af" aria-pressed={vote === -1}>👎</button>
          {vote === -1 && !open ? (
            <div><button type="button" className="linkbtn" onClick={() => setOpen(true)}>{chat.length ? "gesprek" : "hoekom?"}</button></div>
          ) : null}
          {vote === -1 && chat.length > 0 && !ruleAdded ? <div><span className="badge warn" style={{ fontSize: ".72rem" }}>reël nog nie bygevoeg</span></div> : null}
        </td>
      </tr>
      {open ? (
        <tr className="pv-chat-row">
          <td colSpan={4}>
            <div className="pv-chat">
              <div className="row" style={{ gap: 8 }}>
                <b className="grow">Wat klop nie? Praat met die KI en leer dit saam by.</b>
                <button type="button" className="btn sm ghost" onClick={() => setOpen(false)}>Sluit</button>
              </div>
              {chat.length ? (
                <div className="pv-msgs">
                  {chat.map((m, i) => (
                    <div key={i} className={`pv-msg ${m.van}`}>
                      <small>{m.van === "juf" ? "Jy" : "KI"}</small>
                      <div>{m.teks}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              <textarea
                rows={3}
                value={text}
                placeholder={chat.length ? "Antwoord die KI, of verduidelik meer…" : "Hoekom is die KI se oordeel hier verkeerd? Bv. wat jy wel of nie wil sien."}
                onChange={(e) => setText(e.target.value)}
                disabled={pending}
              />
              <div className="btn-row">
                <button type="button" className="btn sm primary" onClick={send} disabled={pending || !text.trim()}>
                  {pending && !info ? <span className="spinner" /> : null} Stuur na die KI
                </button>
              </div>

              {rule ? (
                <div className="pv-rule">
                  <label className="lbl" style={{ margin: 0 }}>Voorgestelde reël (jy kan dit aanpas)</label>
                  <textarea rows={2} value={rule} maxLength={500} onChange={(e) => setRule(e.target.value)} disabled={pending} />
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <select value={omvang} onChange={(e) => setOmvang(e.target.value as Omvang)} disabled={pending} style={{ width: "auto" }}>
                      {OMVANG.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button type="button" className="btn sm ok" onClick={addRule} disabled={pending || rule.trim().length < 8}>➕ Voeg reël by</button>
                  </div>
                  <div className="alert warn" style={{ fontSize: ".85rem", padding: "8px 10px" }}>⚠ Die KI onthou niks uit hierdie gesprek nie. Eers as jy op <b>➕ Voeg reël by</b> druk, geld dit – dadelik vir alle KI-terugvoer op hierdie werkboek, ook in die leerders se app. Jy kan dit later by “KI-reëls” afskakel.</div>
                </div>
              ) : null}

              {ruleAdded ? (
                <div className="alert ok" style={{ fontSize: ".9rem" }}>
                  ✔ Reël bygevoeg: “{ruleAdded}”
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button type="button" className="btn sm" onClick={rerun} disabled={pending}>
                      {pending && info ? <span className="spinner dark" /> : null} 🔄 Beoordeel hierdie werkblad weer
                    </button>
                  </div>
                </div>
              ) : null}
              {info ? <div className="alert info" style={{ fontSize: ".9rem" }}>{info}</div> : null}
              {error ? <div className="alert err">{error}</div> : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
