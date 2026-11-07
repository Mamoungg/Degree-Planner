import { Lookup, Season } from "./types";
import { parsePrereq } from "./prereq";

export const SFU_BASE = "https://www.sfu.ca/bin/wcm/course-outlines";
/** Returns parsed JSON, or null when the API says 404 / errorMessage. Throws on network errors. */
export type Fetcher = (url: string) => Promise<any | null>;

export const defaultFetcher: Fetcher = async (url) => {
  const r = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 86400 } } as RequestInit);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`SFU API ${r.status} for ${url}`);
  let j: any;
  try { j = await r.json(); } catch { return null; }
  return j && !Array.isArray(j) && j.errorMessage ? null : j;
};

export const parseCode = (code: string) => {
  const m = code.trim().match(/^([A-Za-z]{2,4})\s*(\d{3}[A-Za-z]?)$/);
  return m ? { dept: m[1].toLowerCase(), num: m[2].toLowerCase() } : null;
};

const SEASONS: Season[] = ["spring", "summer", "fall"];
export interface TermRef { year: number; season: Season }

/** `n` terms going backwards, starting from the term after `now` (next term's timetable is often already published). */
export function recentTerms(n = 7, now: Date = new Date()): TermRef[] {
  let year = now.getFullYear();
  let i = SEASONS.indexOf(now.getMonth() < 4 ? "spring" : now.getMonth() < 8 ? "summer" : "fall") + 1;
  if (i === 3) { i = 0; year++; }
  const out: TermRef[] = [];
  for (let k = 0; k < n; k++) {
    out.push({ year, season: SEASONS[i] });
    if (--i < 0) { i = 2; year--; }
  }
  return out;
}

/** Prefer an enrolling lecture section: it carries the course outline. */
export function chooseSection(list: any[]): any | null {
  if (!Array.isArray(list) || !list.length) return null;
  const enrol = list.filter((s) => s.classType === "e");
  return enrol.find((s) => s.sectionCode === "LEC") ?? enrol[0] ?? list[0];
}

const val = (x: any) => String(x?.value ?? x?.text ?? "").toLowerCase();

export function makeClient(fetchJson: Fetcher, base: string = SFU_BASE) {
  const u = (...parts: (string | number)[]) => `${base}?${parts.join("/")}`;
  const memo = new Map<string, Promise<any>>();
  const cached = (url: string) => {
    let p = memo.get(url);
    if (!p) { p = fetchJson(url); memo.set(url, p); p.catch(() => memo.delete(url)); }
    return p;
  };

  const years = () => cached(u("")).then((r) => r ?? []);
  const terms = (year: number) => cached(u(year)).then((r) => r ?? []);
  const numbers = (t: TermRef, dept: string): Promise<any[] | null> => cached(u(t.year, t.season, dept));
  const sections = (t: TermRef, dept: string, num: string): Promise<any[] | null> => cached(u(t.year, t.season, dept, num));
  const outline = (t: TermRef, dept: string, num: string, section: string) =>
    cached(u(t.year, t.season, dept, num, section));

  /** All course numbers + titles a department has run recently (for search). */
  async function deptCourses(dept: string, scan: TermRef[] = recentTerms(4)) {
    const seen = new Map<string, string>();
    let failed = 0, lastErr: unknown;
    for (const t of scan) {
      let list: any[] | null = null;
      try { list = await numbers(t, dept.toLowerCase()); } catch (e) { failed++; lastErr = e; continue; }
      if (!Array.isArray(list)) continue;
      for (const c of list) {
        const n = val(c).toUpperCase();
        if (n && !seen.has(n)) seen.set(n, String(c.title ?? ""));
      }
    }
    if (failed === scan.length && scan.length) throw lastErr;
    return [...seen].map(([number, title]) => ({ number, title })).sort((a, b) => a.number.localeCompare(b.number, "en", { numeric: true }));
  }

  /** Look one course up: which seasons it runs in, and its outline from the most recent term. Null if never found. */
  async function lookup(code: string, scan: TermRef[] = recentTerms()): Promise<Lookup | null> {
    const pc = parseCode(code);
    if (!pc) return null;
    const seasons = new Set<Season>();
    const hits: { t: TermRef; title: string }[] = [];
    for (const t of scan) {
      const list = await numbers(t, pc.dept);
      if (!Array.isArray(list)) continue;
      const hit = list.find((c) => val(c) === pc.num);
      if (!hit) continue;
      seasons.add(t.season);
      hits.push({ t, title: String(hit.title ?? "") });
    }
    if (!hits.length) return null;

    let info: any = null;
    for (const h of hits.slice(0, 3)) {
      const secs = await sections(h.t, pc.dept, pc.num);
      const sec = chooseSection(secs ?? []);
      if (!sec) continue;
      const o = await outline(h.t, pc.dept, pc.num, val(sec));
      if (o) { info = o.info ?? o; break; }
    }
    const prereqText = String(info?.prerequisites ?? "").trim();
    const parsed = parsePrereq(prereqText);
    const units = parseFloat(String(info?.units ?? ""));
    return {
      code: `${pc.dept.toUpperCase()} ${pc.num.toUpperCase()}`,
      title: String(info?.title ?? hits[0].title ?? ""),
      units: Number.isFinite(units) ? units : 0,
      designation: String(info?.designation ?? "").trim(),
      description: String(info?.description ?? "").trim(),
      prereqText,
      terms: SEASONS.filter((s) => seasons.has(s)),
      lastOffered: `${hits[0].t.season} ${hits[0].t.year}`,
      prereq: parsed.clauses,
      flags: parsed.flags,
    };
  }

  return { years, terms, numbers, sections, outline, deptCourses, lookup, recentTerms };
}
