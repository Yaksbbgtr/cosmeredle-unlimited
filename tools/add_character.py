"""Add a character to tools/characters.source.json, matching the data's existing spellings.

Usage:
  python3 tools/add_character.py "Name Parts" "World" "First book" "Species[,Subtype]" "Ability, Ability"

The book's series is looked up from existing entries. Values that already exist in the
data (which uses soft hyphens) are reused exactly so comparisons match.
Then run: python3 tools/build_data.py
"""
import json, pathlib, sys

SHY = "­"
path = pathlib.Path(__file__).resolve().parent / "characters.source.json"
data = json.loads(path.read_text())
key = lambda s: s.replace(SHY, "").strip().lower()


def canon(values, v):
    m = {key(x): x for x in values}
    return m.get(key(v), v.strip())


name, world, book, species, abilities = sys.argv[1:6]
live = [c for c in data if "validUntil" not in c]
if any(key(" ".join(c["name"])) == key(name) for c in live):
    sys.exit(f"{name} is already in the list")

book_c = canon([c["firstAppearance"][0] for c in data], book)
series = next((c["firstAppearance"][1] for c in data if c["firstAppearance"][0] == book_c), book_c)
sp = [s for s in species.split(",") if s.strip()]
species_c = [canon([c["species"][0] for c in data], sp[0])] + (
    [canon([s for c in data for s in c["species"][1:]], sp[1])] if len(sp) > 1 else []
)
abil = [canon([a for c in data for a in c["abilities"]], a) for a in abilities.split(",") if a.strip()]

entry = {
    "name": [canon([p for c in data for p in c["name"]], p) for p in name.split()],
    "homeWorld": canon([c["homeWorld"] for c in data], world),
    "firstAppearance": [book_c, series],
    "species": species_c,
    "abilities": sorted(abil, key=key) or [canon([a for c in data for a in c["abilities"]], "Uninvested")],
    "validFrom": 0,
    "shippable": True,
}
data.append(entry)
# Append as text so the rest of the file keeps its original formatting.
text = path.read_text().rstrip()
assert text.endswith("]")
block = json.dumps(entry, indent="\t", ensure_ascii=False).replace("\n", "\n\t")
path.write_text(text[:-1].rstrip() + ",\n\t" + block + "\n]\n")
print("added:", json.dumps({k: v for k, v in entry.items()}, ensure_ascii=False).replace(SHY, ""))
