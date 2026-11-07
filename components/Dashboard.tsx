import { Profile, Program, Progress } from "@/lib/types";
import { groupStats, statusOf, unitsDone } from "@/lib/planner";

export default function Dashboard({ program, st, profile }: { program: Program; st: Progress; profile: Profile }) {
  const u = unitsDone(program, st), lvl = Math.floor(u / program.unitsPerLevel), into = u % program.unitsPerLevel;
  const count = (k: string) => program.courses.filter((c) => statusOf(st, c.code) === k).length;
  return (
    <>
      <div className="card" style={{ padding: 26 }}>
        <div className="eyebrow">YOUR PROGRESS</div>
        <div className="big">LEVEL {lvl}</div>
        <b style={{ fontSize: 12, fontStyle: "italic" }}>UNIT PROGRESS: {into} / {program.unitsPerLevel}</b>
        <div className="bar" style={{ height: 22, margin: "8px 0" }}><i style={{ width: `${(into / program.unitsPerLevel) * 100}%` }} /></div>
        <div className="eyebrow" style={{ fontSize: 10 }}>{u} OF {program.totalUnits} DEGREE UNITS COMPLETE · {profile.program.toUpperCase()}</div>
      </div>
      <div className="tiles">
        <div className="card tile"><small>COURSES DONE</small><div>{count("done")}</div></div>
        <div className="card tile"><small>IN PROGRESS</small><div>{count("prog")}</div></div>
        <div className="card tile g"><small>PLANNED</small><div>{count("planned")}</div></div>
      </div>
      <div className="card">
        <div className="hdrbar">REQUIREMENTS</div>
        {program.groups.map((g) => {
          const s = groupStats(g, program, st);
          return (
            <div className="row" key={g.id}>
              <div><b>{g.name.toUpperCase()}</b><br /><span>{s.done} OF {s.need} COURSES DONE</span></div>
              <div className="bar"><i style={{ width: `${(s.done / s.need) * 100}%` }} /></div>
              <div className="xp">{s.done >= s.need ? "CLEARED" : `+${s.need - s.done} TO GO`}</div>
            </div>
          );
        })}
        <div className="note">
          <b>Before you rely on this</b>
          <ul>
            {(program.notes ?? ["Only the requirements on the calendar page are tracked. Confirm with an advisor."]).map((n) => <li key={n}>{n}</li>)}
          </ul>
          {program.source && <a href={program.source} target="_blank" rel="noreferrer">Calendar page</a>}
        </div>
      </div>
    </>
  );
}
