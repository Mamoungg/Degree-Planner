import { Profile, Program } from "@/lib/types";

const FIELDS: [keyof Profile, string, string?][] = [
  ["name", "NAME"], ["school", "SCHOOL"], ["program", "PROGRAM"], ["start", "START", "date"], ["end", "EXPECTED GRADUATION", "date"],
];

export default function ProfileForm({ profile, setProfile, programs, programId, setProgramId }: {
  profile: Profile; setProfile: (p: Profile) => void; programs: Program[]; programId: string; setProgramId: (id: string) => void;
}) {
  return (
    <>
      <div className="head"><h1 className="h1">PROFILE</h1></div>
      <div className="card form">
        {FIELDS.map(([k, label, type]) => (
          <label key={k}>{label}
            <input type={type ?? "text"} value={profile[k]} onChange={(e) => setProfile({ ...profile, [k]: e.target.value })} />
          </label>
        ))}
        <label>PROGRAM DATA
          <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.school} — {p.program}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}
