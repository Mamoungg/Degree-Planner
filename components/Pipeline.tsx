import { useState } from "react";
import { Program, Progress } from "@/lib/types";
import { STATUSES, courseWarnings, isUnlocked, needText, statusOf, termLabel, upcomingTerms } from "@/lib/planner";
import CourseSearch, { CUSTOM_GROUP } from "./CourseSearch";
import { Course } from "@/lib/types";

interface Props {
  program: Program; st: Progress; plan: Record<string, string>;
  move: (code: string, dir: 1 | -1) => void;
  setTerm: (code: string, term: string) => void;
  addCourse: (c: Course) => void; removeCourse: (code: string) => void;
}

export default function Pipeline({ program, st, plan, move, setTerm, addCourse, removeCourse }: Props) {
  const [group, setGroup] = useState("all");
  const terms = upcomingTerms(10);
  const have = new Set(program.courses.map((c) => c.code));
  return (
    <>
      <div className="head">
        <h1 className="h1">COURSE PIPELINE</h1>
        <label className="filter">REQUIREMENT
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">All requirements</option>
            {program.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
      </div>
      <CourseSearch have={have} onAdd={addCourse} />
      <div className="board">
        {STATUSES.map(([key, label], i) => {
          const cs = program.courses.filter((c) => statusOf(st, c.code) === key && (group === "all" || c.group === group));
          return (
            <div className="col" key={key}>
              <div className="ch">{label} <em>{cs.length}</em></div>
              <div className="cl">
                {cs.map((c) => {
                  const ok = isUnlocked(c, st);
                  const locked = !ok && key !== "done";
                  const blocked = !ok && key === "planned";
                  const gname = program.groups.find((g) => g.id === c.group)?.name.split(" (")[0] ?? "";
                  const warns = key === "done" ? [] : courseWarnings(c, st, plan);
                  const cur = plan[c.code] ?? "";
                  return (
                    <div className={`cc ${locked ? "lock" : ""}`} key={c.code}>
                      <h4>{c.code}</h4>
                      <p>{c.name.toUpperCase()}</p>
                      <div className="tags">
                        <span className="tag">{c.units} UNITS</span>
                        <span className="tag o">{gname.toUpperCase()}</span>
                        {c.designation && <span className="tag o">{c.designation.toUpperCase()}</span>}
                        {locked && <span className="tag" style={{ background: "var(--plum)" }}>LOCKED</span>}
                      </div>
                      <div className="need">
                        {c.prereq.length ? `NEEDS: ${needText(c)}` : "NO PREREQS IN PROGRAM"}
                        {c.terms && c.terms.length > 0 && <div>OFFERED: {c.terms.map((t) => t.toUpperCase()).join(" · ")}</div>}
                      </div>
                      {key !== "done" && (
                        <label className="term">TERM
                          <select value={cur} onChange={(e) => setTerm(c.code, e.target.value)}>
                            <option value="">— not scheduled —</option>
                            {cur && !terms.some((t) => t.key === cur) && <option value={cur}>{termLabel(cur)}</option>}
                            {terms.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                          </select>
                        </label>
                      )}
                      {warns.map((w) => <div className="warn" key={w}>⚠ {w}</div>)}
                      <div className="mvs">
                        <button className="mv" disabled={i === 0} onClick={() => move(c.code, -1)}>◂ BACK</button>
                        <button className="mv" disabled={i === 3 || blocked} onClick={() => move(c.code, 1)}>{blocked ? "LOCKED" : "ADVANCE ▸"}</button>
                      </div>
                      {c.group === CUSTOM_GROUP && <button className="mv rm" onClick={() => removeCourse(c.code)}>REMOVE</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
