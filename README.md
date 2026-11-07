# DegreeLinked

Degree planner (Next.js + TypeScript). Course pipeline, requirement tracking, prerequisite locking, XP levels.

## Run
```bash
npm install
npm run dev      # http://localhost:3000
```

## Structure
- `app/page.tsx` – state + view switching
- `components/` – Sidebar, Dashboard, Pipeline, ProfileForm
- `lib/planner.ts` – requirement and prerequisite logic (pure functions)
- `lib/useStore.ts` – state saved in localStorage
- `data/schools/*.json` – one file per program; `data/programs.ts` lists them
- `scripts/import_program.py` – starter that uses Claude to convert a calendar page into JSON

## Programs included
- SFU Software Systems (BSc)
- SFU Computing Science (BSc)
- SFU Business, Beedie (BBA)
- SFU Engineering Science, Computer Engineering option (BASc)

All four were built from the Spring 2027 calendar. Each JSON file has a `notes` list describing what is and is not modelled. Switch programs on the Profile page.

## Adding a school
1. `python scripts/import_program.py <calendar-url> my-school-program`
2. Check the JSON against the page
3. Import it in `data/programs.ts`

Prerequisites are `string[][]`: AND of ORs. `[["A","B"],["C"]]` means (A or B) and C.

## SFU Course Outlines API features

All of these use SFU's read-only API (`https://www.sfu.ca/bin/wcm/course-outlines`).

1. **Sync / verify** — `npm run sync` checks every course in `data/schools/*.json` against the API and writes
   `data/catalog/sfu.json` (seasons each course runs, designation, calendar prerequisite text) and
   `data/catalog/report.md` (missing courses, unit mismatches, title differences, prerequisite differences).
   `npm run sync:apply` also fixes `units` and any `prereq` whose sentence parsed with no warnings
   (this rewrites the program JSON files; review `git diff`). Needs internet access to sfu.ca; cached 24h in `.cache/sfu`.
2. **Term planning** — on the Courses page each card has a TERM dropdown. Warnings appear if the course hasn't run in
   that season recently (needs `npm run sync` to have been run) or a prerequisite isn't done / scheduled earlier.
3. **Prerequisite parser** — `lib/prereq.ts` converts sentences like "CMPT 125 and (MATH 150 or MATH 151), with a
   minimum grade of C-" into `[["CMPT 125"],["MATH 150","MATH 151"]]`. Unit counts, "BC Math 12", "or equivalent" and
   permission clauses can't be modelled; they're flagged rather than guessed.
4. **Add any course** — the search box on the Courses page looks up any SFU department (`/api/sfu?dept=CMPT`) and adds
   a course (units, title, terms, prerequisites) to your plan under "Added courses".

`npm test` runs the parser and sync tests (the sync tests use a fake API; they don't touch sfu.ca).
Terms offered are inferred from the last ~7 terms, so a course that runs every second year may show only one season.
