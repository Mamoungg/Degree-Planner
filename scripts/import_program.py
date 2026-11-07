"""Starter: turn a school's calendar program page into a data/schools/*.json file.

Usage:  pip install requests beautifulsoup4 anthropic
        export ANTHROPIC_API_KEY=...
        python scripts/import_program.py <url> <output-name>

Untested starter. Always review the generated JSON against the calendar page.
"""
import json, sys, requests
from bs4 import BeautifulSoup
import anthropic

SCHEMA = """Return ONLY JSON (no markdown) shaped like:
{"id": str, "school": str, "program": str, "source": str, "totalUnits": 120, "unitsPerLevel": 10,
 "groups": [{"id": str, "name": str, "pick": int}],   // pick = how many courses are required from the group, 0 = all of them
 "courses": [{"code": "CMPT 225", "name": str, "units": int, "group": group id,
              "prereq": [["A","B"],["C"]]}]}          // prereq = AND of ORs, i.e. (A or B) and C; [] if none
Only include prerequisites that are courses in this program."""

url, name = sys.argv[1], sys.argv[2]
html = requests.get(url, timeout=30).text
text = BeautifulSoup(html, "html.parser").get_text("\n", strip=True)[:60000]

client = anthropic.Anthropic()
msg = client.messages.create(
    model="claude-sonnet-5-5", max_tokens=8000,
    messages=[{"role": "user", "content": f"{SCHEMA}\n\nSource URL: {url}\n\nPage text:\n{text}"}],
)
data = json.loads(msg.content[0].text)
with open(f"data/schools/{name}.json", "w") as f:
    json.dump(data, f, indent=2)
print(f"Wrote data/schools/{name}.json. Now add it to data/programs.ts")
