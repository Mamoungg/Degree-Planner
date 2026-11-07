import { useEffect, useRef, useState } from "react";
import { Course } from "@/lib/types";

interface Hit { number: string; title: string }
export const CUSTOM_GROUP = "custom";

export default function CourseSearch({ have, onAdd }: { have: Set<string>; onAdd: (c: Course) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [dept, setDept] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const seq = useRef(0);

  const m = q.trim().match(/^([A-Za-z]{2,4})\b\s*(.*)$/);
  const wantDept = m ? m[1].toUpperCase() : "";
  const filter = m ? m[2].toLowerCase() : "";

  useEffect(() => {
    if (!wantDept) { setHits([]); setDept(""); setErr(""); return; }
    if (wantDept === dept) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true); setErr("");
      try {
        const r = await fetch(`/api/sfu?dept=${wantDept}`);
        const j = await r.json();
        if (id !== seq.current) return;
        if (!r.ok) throw new Error(j.error || "Search failed");
        setHits(j.courses); setDept(wantDept);
        if (!j.courses.length) setErr(`No ${wantDept} courses found in recent terms`);
      } catch (e) { if (id === seq.current) { setErr((e as Error).message); setHits([]); } }
      finally { if (id === seq.current) setBusy(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [wantDept, dept]);

  const shown = hits
    .filter((h) => !filter || h.number.toLowerCase().startsWith(filter) || h.title.toLowerCase().includes(filter))
    .slice(0, 40);

  const add = async (h: Hit) => {
    const code = `${dept} ${h.number}`;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/sfu?code=${encodeURIComponent(code)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Lookup failed");
      const l = j.course;
      onAdd({ code: l.code, name: l.title || h.title, units: l.units || 3, group: CUSTOM_GROUP, prereq: l.prereq,
        terms: l.terms, designation: l.designation, prereqText: l.prereqText, lastOffered: l.lastOffered });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="search">
      <label className="filter">ADD ANY SFU COURSE
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. CMPT, or CMPT 225, or ECON data" />
      </label>
      {busy && <div className="note" style={{ padding: 0 }}>Talking to the SFU API…</div>}
      {err && <div className="warn">{err}</div>}
      {shown.length > 0 && (
        <div className="results">
          {shown.map((h) => {
            const code = `${dept} ${h.number}`;
            return (
              <div className="res" key={h.number}>
                <span><b>{code}</b> {h.title}</span>
                <button className="mv" disabled={have.has(code) || busy} onClick={() => add(h)}>{have.has(code) ? "ADDED" : "+ ADD"}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
