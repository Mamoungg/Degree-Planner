/**
 * Checks every course in data/schools/*.json against the SFU Course Outlines API.
 *   npm run sync          -> writes data/catalog/sfu.json (terms offered etc.) and data/catalog/report.md
 *   npm run sync:apply    -> additionally fixes `units` and, where the prerequisite sentence parsed cleanly, `prereq`
 * Run it on your own machine: it needs to reach www.sfu.ca. Responses are cached 24h in .cache/sfu.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Fetcher, defaultFetcher, makeClient, recentTerms, TermRef } from "../lib/sfu";
import { parsePrereq, pruneClauses, sameClauses } from "../lib/prereq";

export function retrying(inner: Fetcher, tries = 3, delayMs = 500): Fetcher {
  return async (url) => {
    let err: unknown;
    for (let i = 0; i < tries; i++) {
      try { return await inner(url); }
      catch (e) { err = e; await new Promise((r) => setTimeout(r, delayMs * 2 ** i)); }
    }
    throw err;
  };
}

export function diskCached(inner: Fetcher, dir: string, ttlMs = 24 * 3600 * 1000): Fetcher {
  fs.mkdirSync(dir, { recursive: true });
  return async (url) => {
    const f = path.join(dir, crypto.createHash("sha1").update(url).digest("hex") + ".json");
    try {
      if (Date.now() - fs.statSync(f).mtimeMs < ttlMs) return JSON.parse(fs.readFileSync(f, "utf8")).v;
    } catch {}
    const v = await inner(url);
    fs.writeFileSync(f, JSON.stringify({ v }));
    return v;
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface SyncOptions {
  fetcher: Fetcher; root: string; apply?: boolean; terms?: TermRef[]; concurrency?: number; log?: (s: string) => void;
}

export async function runSync(o: SyncOptions) {
  const log = o.log ?? (() => {});
  const dir = path.join(o.root, "data/schools");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const programs = files.map((f) => ({ file: path.join(dir, f), data: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));
  const codes = [...new Set(programs.flatMap((p) => p.data.courses.map((c: any) => c.code as string)))].sort();
  const scan = o.terms ?? recentTerms();
  const client = makeClient(o.fetcher);

  const found = new Map<string, Awaited<ReturnType<typeof client.lookup>>>();
  const errors = new Map<string, string>();
  let next = 0, done = 0;
  const worker = async () => {
    while (next < codes.length) {
      const code = codes[next++];
      try { found.set(code, await client.lookup(code, scan)); }
      catch (e) { errors.set(code, (e as Error).message); }
      if (++done % 25 === 0) log(`  ${done}/${codes.length}`);
    }
  };
  await Promise.all(Array.from({ length: o.concurrency ?? 4 }, worker));

  const catalog: any = {
    generatedAt: new Date().toISOString(),
    termsScanned: scan.map((t) => `${t.season} ${t.year}`),
    courses: {} as Record<string, unknown>,
  };
  for (const code of codes) {
    const l = found.get(code);
    if (l) catalog.courses[code] = { title: l.title, units: l.units, designation: l.designation, prereqText: l.prereqText, terms: l.terms, lastOffered: l.lastOffered };
  }

  const rep: string[] = [];
  const sec = (t: string, lines: string[]) => { if (lines.length) rep.push(`\n## ${t} (${lines.length})\n`, ...lines); };
  const missing: string[] = [], units: string[] = [], titles: string[] = [], prDiff: string[] = [], lowConf: string[] = [], errs: string[] = [];
  let appliedUnits = 0, appliedPrereq = 0;

  for (const p of programs) {
    const allowed = new Set<string>(p.data.courses.map((c: any) => c.code));
    let changed = false;
    for (const c of p.data.courses) {
      const tag = `- **${c.code}** (${p.data.id})`;
      if (errors.has(c.code)) { errs.push(`${tag}: ${errors.get(c.code)}`); continue; }
      const l = found.get(c.code);
      if (!l) { missing.push(`${tag}: not found in ${catalog.termsScanned.length} scanned terms`); continue; }
      if (l.units && l.units !== c.units) {
        units.push(`${tag}: program says ${c.units}, API says ${l.units}`);
        if (o.apply) { c.units = l.units; appliedUnits++; changed = true; }
      }
      if (l.title && norm(l.title) !== norm(c.name)) titles.push(`${tag}: "${c.name}" vs API "${l.title}"`);
      const parsed = parsePrereq(l.prereqText);
      const mine = pruneClauses(parsed.clauses, allowed);
      if (!sameClauses(mine, c.prereq)) {
        const line = `${tag}: program \`${JSON.stringify(c.prereq)}\` vs API \`${JSON.stringify(mine)}\`  \n  calendar text: "${l.prereqText}"${parsed.flags.length ? `  \n  parser flags: ${parsed.flags.join("; ")}` : ""}`;
        prDiff.push(line);
        if (o.apply && parsed.flags.length === 0 && mine.length > 0) { c.prereq = mine; appliedPrereq++; changed = true; }
      } else if (parsed.flags.length) lowConf.push(`${tag}: "${l.prereqText}" — ${parsed.flags.join("; ")}`);
    }
    if (changed) fs.writeFileSync(p.file, JSON.stringify(p.data, null, 2) + "\n");
  }

  rep.unshift(
    `# SFU sync report`, ``, `Generated ${catalog.generatedAt}. Terms scanned: ${catalog.termsScanned.join(", ")}.`,
    `${codes.length} distinct courses across ${programs.length} programs; ${found.size - [...found.values()].filter((x) => !x).length} found, ${missing.length} not found, ${errs.length} errors.`,
    o.apply ? `Applied: ${appliedUnits} unit fixes, ${appliedPrereq} prerequisite updates (only where the sentence parsed with no flags).` : `Dry run — nothing in data/schools was changed. Re-run with --apply to fix units and cleanly parsed prerequisites.`,
    `Prerequisite differences may be deliberate (e.g. a program lists a writing-course group differently) — review before applying.`);
  sec("Errors", errs); sec("Not found", missing); sec("Unit mismatches", units);
  sec("Title differences", titles); sec("Prerequisite differences", prDiff); sec("Prerequisites parsed with warnings (match the program, but not fully modelled)", lowConf);
  const report = rep.join("\n") + "\n";

  fs.mkdirSync(path.join(o.root, "data/catalog"), { recursive: true });
  fs.writeFileSync(path.join(o.root, "data/catalog/sfu.json"), JSON.stringify(catalog, null, 1) + "\n");
  fs.writeFileSync(path.join(o.root, "data/catalog/report.md"), report);
  return { catalog, report, counts: { courses: codes.length, missing: missing.length, units: units.length, prereq: prDiff.length, errors: errs.length, appliedUnits, appliedPrereq } };
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const fetcher = diskCached(retrying(defaultFetcher), path.join(root, ".cache/sfu"));
  console.log("Syncing with the SFU Course Outlines API (this takes a few minutes the first time)...");
  runSync({ fetcher, root, apply: process.argv.includes("--apply"), log: console.log })
    .then((r) => { console.log(r.counts); console.log("Wrote data/catalog/sfu.json and data/catalog/report.md"); })
    .catch((e) => { console.error("Sync failed:", e.message); process.exit(1); });
}
