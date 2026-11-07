import { Course, Group, Program, Progress, Status } from "./types";

export const STATUSES: [Status, string][] = [
  ["todo", "01_REMAINING"], ["planned", "02_PLANNED"], ["prog", "03_IN_PROGRESS"], ["done", "04_COMPLETED"],
];

export const statusOf = (st: Progress, code: string): Status => st[code] ?? "todo";

/** A course is unlocked when every AND-group has at least one completed OR-option. */
export const isUnlocked = (c: Course, st: Progress) =>
  c.prereq.every((or) => or.some((x) => st[x] === "done"));

export const groupNeed = (g: Group, p: Program) =>
  g.pick || p.courses.filter((c) => c.group === g.id).length;

export function groupStats(g: Group, p: Program, st: Progress) {
  const done = p.courses.filter((c) => c.group === g.id && st[c.code] === "done").length;
  const need = groupNeed(g, p);
  return { done: Math.min(done, need), need };
}

export const unitsDone = (p: Program, st: Progress) =>
  p.courses.filter((c) => st[c.code] === "done").reduce((a, c) => a + c.units, 0);

/** Readable prerequisite text. Long OR-lists (the writing-course group) are shortened. */
export const needText = (c: Course) =>
  c.prereq
    .map((or) =>
      or.length > 1 && or.every((x) => /W$/.test(x)) ? "a W course"
      : or.length > 3 ? `${or.slice(0, 3).join(" / ")} +${or.length - 3}`
      : or.join(" / "))
    .join(" + ");

/* ---------- term planning ---------- */
import type { Season } from "./types";

export const SEASONS: Season[] = ["spring", "summer", "fall"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const termKey = (year: number, season: Season) => `${year}-${season}`;
export const termLabel = (key: string) => {
  const [y, s] = key.split("-");
  return `${cap(s)} ${y}`;
};
/** Sortable number: later terms are larger. */
export const termOrd = (key: string) => {
  const [y, s] = key.split("-");
  return Number(y) * 3 + Math.max(0, SEASONS.indexOf(s as Season));
};
export const seasonOfDate = (d: Date): Season => (d.getMonth() < 4 ? "spring" : d.getMonth() < 8 ? "summer" : "fall");

/** The current term and the next n-1 terms. */
export function upcomingTerms(n: number, now: Date = new Date()) {
  let year = now.getFullYear();
  let i = SEASONS.indexOf(seasonOfDate(now));
  const out: { key: string; label: string; season: Season }[] = [];
  for (let k = 0; k < n; k++) {
    const season = SEASONS[i];
    const key = termKey(year, season);
    out.push({ key, label: termLabel(key), season });
    if (++i === SEASONS.length) { i = 0; year++; }
  }
  return out;
}

/** Warnings for a course placed in a term. `plan` maps course code -> term key. */
export function courseWarnings(c: Course, st: Progress, plan: Record<string, string>): string[] {
  const key = plan[c.code];
  if (!key || st[c.code] === "done") return [];
  const out: string[] = [];
  const season = key.split("-")[1] as Season;
  if (c.terms && c.terms.length && !c.terms.includes(season)) {
    out.push(`Not seen in ${cap(season)} recently (runs: ${c.terms.map(cap).join(", ")})`);
  }
  const ord = termOrd(key);
  for (const or of c.prereq) {
    const ok = or.some((x) => st[x] === "done" || (plan[x] !== undefined && termOrd(plan[x]) < ord));
    if (!ok) out.push(`Needs ${or.length > 3 ? or.slice(0, 3).join(" / ") + " …" : or.join(" / ")} before this term`);
  }
  return out;
}
