import { Program } from "@/lib/types";
import softwareSystems from "./schools/sfu-software-systems.json";
import computingScience from "./schools/sfu-computing-science.json";
import business from "./schools/sfu-business-bba.json";
import computerEngineering from "./schools/sfu-computer-engineering.json";

// To add a program: drop a JSON file in data/schools/ (see scripts/import_program.py) and list it here.
export const programs: Program[] = [
  softwareSystems as Program,
  computingScience as Program,
  business as Program,
  computerEngineering as Program,
];
