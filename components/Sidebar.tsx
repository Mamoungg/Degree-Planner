import { Profile, Program, Progress, View } from "@/lib/types";
import { unitsDone } from "@/lib/planner";

const NAV: [View, string][] = [["dash", "DASHBOARD"], ["plan", "COURSES"], ["prof", "PROFILE"]];

export default function Sidebar({ view, setView, profile, program, st }: {
  view: View; setView: (v: View) => void; profile: Profile; program: Program; st: Progress;
}) {
  const u = unitsDone(program, st), lvl = Math.floor(u / program.unitsPerLevel), into = u % program.unitsPerLevel;
  return (
    <aside className="side">
      <div className="user">
        <div className="urow">
          <div className="av">{profile.name.trim().charAt(0).toUpperCase() || "?"}</div>
          <div><div className="uname">{profile.name.toUpperCase()}</div><div className="ulvl">LEVEL_{lvl}</div></div>
        </div>
        <div className="xpl"><span>{into} UNITS</span><span>{program.unitsPerLevel} UNITS</span></div>
        <div className="bar"><i style={{ width: `${(into / program.unitsPerLevel) * 100}%` }} /></div>
      </div>
      <nav>
        {NAV.map(([k, l]) => (
          <button key={k} className={`nb ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{l}</button>
        ))}
      </nav>
    </aside>
  );
}
