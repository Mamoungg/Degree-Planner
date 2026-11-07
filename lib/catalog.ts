import catalogJson from "@/data/catalog/sfu.json";
import { Course, Program, Season } from "./types";

interface Entry { title?: string; units?: number; designation?: string; prereqText?: string; terms?: Season[]; lastOffered?: string }
export interface Catalog { generatedAt: string | null; termsScanned: string[]; courses: Record<string, Entry> }
export const catalog = catalogJson as unknown as Catalog;

/** Overlay API-derived info (terms offered, designation, calendar prereq text) onto a program's courses. */
export function withCatalog(p: Program, cat: Catalog = catalog): Program {
  if (!cat.generatedAt) return p;
  return {
    ...p,
    courses: p.courses.map((c): Course => {
      const e = cat.courses[c.code];
      if (!e) return c;
      return { ...c, terms: e.terms?.length ? e.terms : c.terms, designation: e.designation || c.designation,
        prereqText: e.prereqText ?? c.prereqText, lastOffered: e.lastOffered ?? c.lastOffered };
    }),
  };
}
