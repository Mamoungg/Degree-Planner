"use client";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import Pipeline from "@/components/Pipeline";
import ProfileForm from "@/components/ProfileForm";
import { programs as basePrograms } from "@/data/programs";
import { withCatalog } from "@/lib/catalog";
import { CUSTOM_GROUP } from "@/components/CourseSearch";
import { pruneClauses } from "@/lib/prereq";
import { Course, Program } from "@/lib/types";
import { useMemo } from "react";
import { STATUSES, isUnlocked, statusOf } from "@/lib/planner";
import { useStore } from "@/lib/useStore";

const programs: Program[] = basePrograms.map((p) => withCatalog(p));

export default function Page() {
  const { s, setS, ready } = useStore();
  const base = programs.find((p) => p.id === s.programId) ?? programs[0];
  const custom = s.custom[base.id] ?? [];
  const program = useMemo<Program>(() => custom.length
    ? { ...base, groups: [...base.groups, { id: CUSTOM_GROUP, name: "Added courses (from SFU search)", pick: 0 }], courses: [...base.courses, ...custom] }
    : base, [base, custom]);
  const st = s.st[program.id] ?? {};
  const plan = s.plan[program.id] ?? {};

  const setTerm = (code: string, term: string) => {
    const next = { ...plan };
    if (term) next[code] = term; else delete next[code];
    setS({ ...s, plan: { ...s.plan, [program.id]: next } });
  };
  const addCourse = (c: Course) => {
    if (program.courses.some((x) => x.code === c.code)) return;
    // Prerequisites outside this program can never be ticked off here, so keep only options we can track.
    const allowed = new Set([...program.courses.map((x) => x.code), c.code]);
    setS({ ...s, custom: { ...s.custom, [program.id]: [...custom, { ...c, prereq: pruneClauses(c.prereq, allowed) }] } });
  };
  const removeCourse = (code: string) => {
    const { [code]: _s, ...restSt } = st;
    const { [code]: _p, ...restPlan } = plan;
    setS({ ...s, custom: { ...s.custom, [program.id]: custom.filter((c) => c.code !== code) },
      st: { ...s.st, [program.id]: restSt }, plan: { ...s.plan, [program.id]: restPlan } });
  };

  const move = (code: string, dir: 1 | -1) => {
    const course = program.courses.find((c) => c.code === code);
    if (!course) return;
    const i = STATUSES.findIndex(([k]) => k === statusOf(st, code));
    const j = Math.max(0, Math.min(3, i + dir));
    if (dir > 0 && j >= 2 && !isUnlocked(course, st)) return; // can't start a course before its prerequisites
    setS({ ...s, st: { ...s.st, [program.id]: { ...st, [code]: STATUSES[j][0] } } });
  };

  const reset = () => {
    if (confirm("Clear all course progress?")) setS({ ...s, st: { ...s.st, [program.id]: {} }, plan: { ...s.plan, [program.id]: {} } });
  };

  if (!ready) return null;
  return (
    <div className="app">
      <Sidebar view={s.view} setView={(view) => setS({ ...s, view })} profile={s.p} program={program} st={st} />
      <div className="main">
        <header className="top">
          <div className="logo">DEGREE<b>LINKED</b></div>
          <button className="btn" onClick={reset}>RESET PLAN</button>
        </header>
        <div className="pad">
          {s.view === "dash" && <Dashboard program={program} st={st} profile={s.p} />}
          {s.view === "plan" && <Pipeline program={program} st={st} plan={plan} move={move} setTerm={setTerm} addCourse={addCourse} removeCourse={removeCourse} />}
          {s.view === "prof" && (
            <ProfileForm profile={s.p} setProfile={(p) => setS({ ...s, p })} programs={programs}
              programId={program.id} setProgramId={(programId) => {
                const next = programs.find((p) => p.id === programId);
                setS({ ...s, programId, p: next ? { ...s.p, school: next.school, program: next.program } : s.p });
              }} />
          )}
        </div>
      </div>
    </div>
  );
}
