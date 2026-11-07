/**
 * Turns an SFU prerequisite sentence into the planner's format: string[][] = AND of ORs.
 *   "CMPT 125 and (MACM 101 or MATH 151)"  ->  [["CMPT 125"], ["MACM 101", "MATH 151"]]
 * Anything that is not a course (unit counts, "BC Math 12", permission...) cannot be modelled; it is
 * reported in `unmodelled` and `flags` so callers can decide whether to trust the result.
 */
export interface Parsed { clauses: string[][]; unmodelled: string[]; flags: string[] }

type Tok =
  | { k: "code"; v: string }
  | { k: "u"; text: string }
  | { k: "and" | "or" | "comma" | "semi" | "(" | ")" };
type Node = { t: "c"; code: string } | { t: "u" } | { t: "and" | "or"; kids: Node[] };
type El = Node | "and" | "or" | "comma" | "semi";

const MAX_CLAUSES = 64;
const UNK = "?";

function tokenize(s: string): Tok[] {
  const re = /(\d+)\s+(?:units?|credits?)|\b([A-Z]{2,4})\s?(\d{3}[A-Z]?)\b|\b(\d{3}[A-Z]?)\b|\b(and|or)\b|([(),;])|([^\s(),;]+)/g;
  const toks: Tok[] = [];
  let dept = "";
  const unk = (text: string) => {
    const last = toks[toks.length - 1];
    if (last && last.k === "u") last.text += " " + text;
    else toks.push({ k: "u", text });
  };
  for (const m of s.matchAll(re)) {
    if (m[1]) unk(m[0]);
    else if (m[2]) { dept = m[2]; toks.push({ k: "code", v: `${m[2]} ${m[3]}` }); }
    else if (m[4]) { dept ? toks.push({ k: "code", v: `${dept} ${m[4]}` }) : unk(m[4]); }
    else if (m[5]) toks.push({ k: m[5] as "and" | "or" });
    else if (m[6]) toks.push({ k: m[6] === "," ? "comma" : m[6] === ";" ? "semi" : (m[6] as "(" | ")") });
    else if (m[7]) unk(m[7]);
  }
  return toks;
}

function build(els: El[]): Node | null {
  const seps = els.filter((e): e is "and" | "or" | "comma" | "semi" => typeof e === "string");
  const hard = seps.includes("semi") ? "semi" : seps.includes("and") ? "and" : null;
  const segs: El[][] = [[]];
  for (const e of els) {
    if (typeof e === "string" && (e === "semi" || (hard === "and" && (e === "and" || e === "comma")))) segs.push([]);
    else segs[segs.length - 1].push(e);
  }
  const nodes: Node[] = [];
  for (const seg of segs) {
    let n: Node | null;
    if (hard === "semi") n = build(seg);
    else {
      const items = seg.filter((e): e is Node => typeof e !== "string");
      n = items.length === 0 ? null : items.length === 1 ? items[0] : { t: "or", kids: items };
    }
    if (n) nodes.push(n);
  }
  return nodes.length === 0 ? null : nodes.length === 1 ? nodes[0] : { t: "and", kids: nodes };
}

function parseTokens(toks: Tok[]): Node | null {
  let i = 0;
  const level = (): El[] => {
    const els: El[] = [];
    while (i < toks.length) {
      const t = toks[i];
      if (t.k === ")") return els;
      i++;
      if (t.k === "(") {
        const inner = build(level());
        if (toks[i]?.k === ")") i++;
        if (inner) els.push(inner);
      } else if (t.k === "code") els.push({ t: "c", code: t.v });
      else if (t.k === "u") els.push({ t: "u" });
      else els.push(t.k as "and" | "or" | "comma" | "semi");
    }
    return els;
  };
  const all: El[] = [];
  while (i < toks.length) {
    all.push(...level());
    if (toks[i]?.k === ")") i++; // stray ")"
  }
  return build(all);
}

function cnf(n: Node): string[][] {
  if (n.t === "c") return [[n.code]];
  if (n.t === "u") return [[UNK]];
  if (n.t === "and") return n.kids.flatMap(cnf);
  let acc = cnf(n.kids[0]);
  for (const kid of n.kids.slice(1)) {
    const next = cnf(kid);
    const out: string[][] = [];
    for (const a of acc) for (const b of next) {
      out.push([...new Set([...a, ...b])]);
      if (out.length > MAX_CLAUSES) throw new Error("too-complex");
    }
    acc = out;
  }
  return acc;
}

export const clauseKey = (clauses: string[][]) =>
  clauses.map((c) => [...new Set(c)].sort().join("|")).sort().join("&");
export const sameClauses = (a: string[][], b: string[][]) => clauseKey(a) === clauseKey(b);

/** Remove duplicates and clauses implied by a smaller clause: (A) makes (A or B) redundant. */
function simplify(clauses: string[][]): string[][] {
  const sets = clauses.map((c) => [...new Set(c)]);
  const keep = sets.filter((c, i) => !sets.some((d, j) =>
    j !== i && d.every((x) => c.includes(x)) && (d.length < c.length || j < i)));
  return keep;
}

export function parsePrereq(input: string | null | undefined): Parsed {
  const flags: string[] = [];
  const unmodelled: string[] = [];
  let s = (input ?? "").replace(/\s+/g, " ").trim().replace(/^pre-?requisites?\s*:?\s*/i, "");
  if (!s) return { clauses: [], unmodelled, flags };

  // Only the first sentence states the requirement; later ones are usually "students who have credit for X may not...".
  const cut = s.search(/\.\s+(?=[A-Z])/);
  if (cut >= 0) {
    const rest = s.slice(cut + 1);
    s = s.slice(0, cut);
    if (/\b[A-Z]{2,4}\s?\d{3}/.test(rest)) flags.push("later sentences mention courses and were ignored");
  }
  s = s.replace(/\.$/, "");

  s = s.replace(/,?\s*(?:all\s+)?(?:with|of)\s+(?:a\s+)?(?:minimum\s+)?grades?\s+(?:of\s+)?[A-D][+-]?(?:\s+or\s+(?:better|higher))?/gi, "")
       .replace(/\(?\s*minimum\s+grade\s+of\s+[A-D][+-]?\s*\)?/gi, "");
  if (/\bor equivalent\b/i.test(s)) {
    flags.push("'or equivalent' ignored");
    s = s.replace(/,?\s*\(?or equivalent\)?/gi, "");
  }

  const toks = tokenize(s);
  for (const t of toks) if (t.k === "u") unmodelled.push(t.text);
  const tree = parseTokens(toks);
  if (!tree) return { clauses: [], unmodelled, flags: unmodelled.length ? [...flags, "no course requirement found"] : flags };

  let clauses: string[][];
  try { clauses = cnf(tree); }
  catch { return { clauses: [], unmodelled, flags: [...flags, "too complex to convert"] }; }

  const dropped = clauses.filter((c) => c.includes(UNK));
  if (dropped.length) flags.push("non-course requirement dropped: " + unmodelled.join("; "));
  clauses = simplify(clauses.filter((c) => !c.includes(UNK)));
  return { clauses, unmodelled, flags };
}

/** Keep only courses in `allowed`; a clause with no allowed option is dropped (it could never be satisfied in-app). */
export function pruneClauses(clauses: string[][], allowed: Set<string>): string[][] {
  return simplify(clauses.map((c) => c.filter((x) => allowed.has(x))).filter((c) => c.length > 0));
}
