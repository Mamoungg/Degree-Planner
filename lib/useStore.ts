"use client";
import { useEffect, useState } from "react";
import { Course, Profile, Progress, View } from "./types";

const KEY = "degreelinked-v2";
export interface State { view: View; programId: string; st: Record<string, Progress>; p: Profile;
  plan: Record<string, Record<string, string>>;  // programId -> course code -> term key ("2027-spring")
  custom: Record<string, Course[]>;               // programId -> courses added from the SFU search
}

export const DEFAULT_STATE: State = {
  view: "dash", programId: "", st: {}, plan: {}, custom: {},
  p: { name: "Your Name", school: "Simon Fraser University", program: "Software Systems Major (BSc)", start: "2023-09-01", end: "2028-04-01" },
};

export function useStore() {
  const [s, setS] = useState<State>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const o = JSON.parse(raw); setS({ ...DEFAULT_STATE, ...o, p: { ...DEFAULT_STATE.p, ...o.p } }); }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }, [s, ready]);
  return { s, setS, ready };
}
