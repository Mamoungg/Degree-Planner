export type Status = "todo" | "planned" | "prog" | "done";
export type View = "dash" | "plan" | "prof";
export type Season = "spring" | "summer" | "fall";

export interface Group { id: string; name: string; pick: number } // pick 0 = all courses required
export interface Course {
  code: string; name: string; units: number; group: string;
  prereq: string[][]; // AND of ORs: [["A","B"],["C"]] = (A or B) and C
  // Filled in from the SFU Course Outlines API (see scripts/sync.ts and the in-app search):
  terms?: Season[];      // seasons the course has run in recently
  designation?: string;  // e.g. "W", "Q", "B-Sci"
  prereqText?: string;   // the calendar's own prerequisite sentence
  lastOffered?: string;  // e.g. "fall 2026"
}
export interface Program {
  id: string; school: string; program: string; source?: string;
  totalUnits: number; unitsPerLevel: number; notes?: string[]; groups: Group[]; courses: Course[];
}
export interface Profile { name: string; school: string; program: string; start: string; end: string }
export type Progress = Record<string, Status>;

/** What a lookup of one course in the SFU API returns. */
export interface Lookup {
  code: string; title: string; units: number; designation: string; description: string;
  prereqText: string; terms: Season[]; lastOffered: string;
  prereq: string[][]; // parsed from prereqText
  flags: string[];    // reasons the parse may be incomplete
}
