import test from "node:test";
import assert from "node:assert/strict";
import { parsePrereq, pruneClauses, sameClauses } from "../lib/prereq";

const p = (s: string) => parsePrereq(s);

test("simple AND with grade note", () => {
  const r = p("CMPT 125 and MACM 101, with a minimum grade of C-.");
  assert.deepEqual(r.clauses, [["CMPT 125"], ["MACM 101"]]);
  assert.deepEqual(r.flags, []);
});
test("bare numbers inherit department", () => {
  assert.deepEqual(p("MATH 150 or 151 or 154 or 157.").clauses, [["MATH 150", "MATH 151", "MATH 154", "MATH 157"]]);
});
test("parenthesised OR inside AND, comma list with and", () => {
  const r = p("CMPT 125, MACM 101, and (MATH 150 or MATH 151), all with a minimum grade of C-.");
  assert.ok(sameClauses(r.clauses, [["CMPT 125"], ["MACM 101"], ["MATH 150", "MATH 151"]]));
});
test("comma list without 'and' is OR", () => {
  assert.deepEqual(p("CMPT 225, CMPT 295 or CMPT 300").clauses, [["CMPT 225", "CMPT 295", "CMPT 300"]]);
});
test("OR of ANDs expands to CNF", () => {
  const r = p("(CMPT 120 and MATH 150) or (CMPT 130 and MATH 151)");
  assert.equal(r.clauses.length, 4);
  assert.ok(sameClauses(r.clauses, [["CMPT 120","CMPT 130"],["CMPT 120","MATH 151"],["MATH 150","CMPT 130"],["MATH 150","MATH 151"]]));
});
test("unit count and BC Math are not modelled and flagged", () => {
  const r = p("60 units and CMPT 225.");
  assert.deepEqual(r.clauses, [["CMPT 225"]]);
  assert.ok(r.flags.length > 0);
  const r2 = p("BC Math 12 or MATH 100, with a minimum grade of B.");
  assert.deepEqual(r2.clauses, []); // OR with a non-course option is satisfiable without courses
  assert.ok(r2.flags.length > 0);
});
test("or equivalent is flagged", () => {
  const r = p("MATH 152 or equivalent.");
  assert.deepEqual(r.clauses, [["MATH 152"]]);
  assert.ok(r.flags.some((f) => f.includes("equivalent")));
});
test("later sentences ignored and flagged", () => {
  const r = p("CMPT 225. Students with credit for CMPT 295 may not take this course.");
  assert.deepEqual(r.clauses, [["CMPT 225"]]);
  assert.equal(r.flags.length, 1);
});
test("empty", () => { assert.deepEqual(p("").clauses, []); assert.deepEqual(p(null).flags, []); });
test("redundant clauses simplified", () => {
  assert.deepEqual(p("CMPT 225 and (CMPT 225 or CMPT 295)").clauses, [["CMPT 225"]]);
});
test("too complex is refused, not guessed", () => {
  const big = Array.from({ length: 8 }, (_, i) => `(MATH ${100 + i}A and MATH ${200 + i}B)`).join(" or ");
  const r = p(big);
  assert.deepEqual(r.clauses, []);
  assert.ok(r.flags.some((f) => f.includes("complex")));
});
test("prune drops unknown options and impossible clauses", () => {
  const allowed = new Set(["CMPT 125", "MATH 150"]);
  assert.deepEqual(pruneClauses([["CMPT 125", "CMPT 130"], ["ZZZ 100"], ["MATH 150"]], allowed), [["CMPT 125"], ["MATH 150"]]);
});
