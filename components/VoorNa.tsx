import { OOREENKOMS_LABEL } from "@/lib/pdf-vergelyking/status";

type BA = { sheets: number; voor: Record<string, number>; na: Record<string, number>; changed: number; criteria: number };

/** Voor/ná-vergelyking ná ’n herbeoordeling met die huidige reëls. */
export default function VoorNa({ ba }: { ba: BA }) {
  const keys = Object.keys(OOREENKOMS_LABEL);
  return (
    <div className="pv-box" style={{ margin: "12px 0" }}>
      <h4>Voor en ná die reëls ({ba.sheets} werkblaaie weer beoordeel)</h4>
      <table className="pv-crit">
        <thead><tr><th>Ooreenkoms met juf</th><th>Voor</th><th>Ná</th></tr></thead>
        <tbody>
          {keys.map((k) => {
            const v = ba.voor[k] ?? 0;
            const n = ba.na[k] ?? 0;
            const better = (k === "stem_ooreen" && n > v) || ((k === "verskil" || k === "gedeeltelik") && n < v);
            const worse = (k === "stem_ooreen" && n < v) || ((k === "verskil" || k === "gedeeltelik") && n > v);
            return (
              <tr key={k}>
                <td><span className={`badge ${OOREENKOMS_LABEL[k].cls}`}>{OOREENKOMS_LABEL[k].text}</span></td>
                <td>{v}</td>
                <td><b style={{ color: better ? "var(--ok)" : worse ? "var(--red)" : undefined }}>{n}</b></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: ".88rem" }}>{ba.changed} van {ba.criteria} KI-oordele per kriterium het verander.</p>
    </div>
  );
}
