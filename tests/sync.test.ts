import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runSync } from "../scripts/sync";
import { makeClient, recentTerms } from "../lib/sfu";
import { Fetcher } from "../lib/sfu";

const B = "https://www.sfu.ca/bin/wcm/course-outlines";
// A tiny fake SFU: CMPT 120 (fall+spring) and CMPT 225 (fall only, prereq text). Everything else 404s.
const fake: Fetcher = async (url) => {
  const q = url.replace(B + "?", "");
  const m = q.match(/^(\d+)\/(\w+)\/(\w+)(?:\/(\w+))?(?:\/(\w+))?$/);
  if (!m) return null;
  const [, , season, dept, num, sec] = m;
  if (dept !== "cmpt") return null;
  if (!num) return [...(season === "summer" ? [] : [{ value: "120", title: "Intro" }]), ...(season === "fall" ? [{ value: "225", title: "Data Structures" }] : [])];
  if (num === "120" && season === "summer") return null;
  if (num === "225" && season !== "fall") return null;
  if (!sec) return [{ value: "d100", classType: "e", sectionCode: "LEC" }, { value: "d101", classType: "n", sectionCode: "TUT" }];
  if (sec !== "d100") return null;
  return num === "225"
    ? { info: { title: "Data Structures and Programming", units: "3", prerequisites: "CMPT 125 and CMPT 120, with a minimum grade of C-.", designation: "" } }
    : { info: { title: "Intro", units: "3", prerequisites: "", designation: "Q" } };
};

test("lookup finds seasons and parses prerequisites", async () => {
  const c = makeClient(fake);
  const l = await c.lookup("CMPT 225", recentTerms(6, new Date("2026-11-07")));
  assert.ok(l);
  assert.deepEqual(l!.terms, ["fall"]);
  assert.deepEqual(l!.prereq, [["CMPT 125"], ["CMPT 120"]]);
  assert.equal(await c.lookup("CMPT 999"), null);
  const l2 = await c.lookup("cmpt120");
  assert.deepEqual(l2!.terms, ["spring", "fall"]);
});

test("runSync reports, then --apply fixes units and prereqs", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-"));
  fs.mkdirSync(path.join(root, "data/schools"), { recursive: true });
  const prog = { id: "t", courses: [
    { code: "CMPT 120", name: "Intro", units: 4, group: "g", prereq: [] },
    { code: "CMPT 225", name: "Data Structures", units: 3, group: "g", prereq: [["CMPT 120"]] },
    { code: "CMPT 125", name: "Intro II", units: 3, group: "g", prereq: [] },
    { code: "ZZZZ 1", name: "Gone", units: 3, group: "g", prereq: [] },
  ] };
  fs.writeFileSync(path.join(root, "data/schools/t.json"), JSON.stringify(prog));
  const terms = recentTerms(6, new Date("2026-11-07"));

  const dry = await runSync({ fetcher: fake, root, terms });
  assert.equal(dry.counts.units, 1);
  assert.equal(dry.counts.prereq, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "data/schools/t.json"), "utf8")).courses[0].units, 4); // untouched
  assert.ok(fs.existsSync(path.join(root, "data/catalog/report.md")));
  assert.deepEqual(dry.catalog.courses["CMPT 225"].terms, ["fall"]);

  const applied = await runSync({ fetcher: fake, root, terms, apply: true });
  assert.equal(applied.counts.appliedUnits, 1);
  assert.equal(applied.counts.appliedPrereq, 1);
  const out = JSON.parse(fs.readFileSync(path.join(root, "data/schools/t.json"), "utf8")).courses;
  assert.equal(out[0].units, 3);
  assert.deepEqual(out[1].prereq, [["CMPT 125"], ["CMPT 120"]]);
});

test("deptCourses surfaces network failure instead of an empty list", async () => {
  const down: Fetcher = async () => { throw new Error("offline"); };
  await assert.rejects(makeClient(down).deptCourses("cmpt"), /offline/);
  const list = await makeClient(fake).deptCourses("cmpt", recentTerms(4, new Date("2026-11-07")));
  assert.deepEqual(list.map((c) => c.number), ["120", "225"]);
});
