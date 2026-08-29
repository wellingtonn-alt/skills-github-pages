# Set file format

A "set" is one JSON file in the `sets/` folder. You will not normally write
this file by hand — the builder page (`builder.html`) generates it for you
from a plain pasted list. This page is the reference for what's inside it,
in case you (or a future maintainer) ever need to read or hand-edit one.

## File name

The file name (without `.json`) is the set's **slug**, and the slug is what
goes in the shareable link:

```
sets/cold-war-americas.json  →  https://your-site/?set=cold-war-americas
```

Use lowercase letters, numbers, and hyphens only.

## Top-level fields

```json
{
  "id": "cold-war-americas",
  "title": "Cold War: The Americas",
  "description": "Cuba, Chile, and the interventions that followed.",
  "events": [ ... ]
}
```

| Field         | Required | Notes                                                             |
|---------------|----------|---------------------------------------------------------------------|
| `id`          | yes      | Should match the file name (the slug).                              |
| `title`       | yes      | Shown at the top of the game screen.                                 |
| `description` | no      | A one-line subtitle, shown under the title.                          |
| `events`      | yes      | An array of event objects, described below. Needs at least 4-5 for a meaningful round. |

## Event fields

```json
{
  "id": "evt-1",
  "date": "1973-09-11",
  "text": "The Chilean armed forces overthrow Allende",
  "note": "Bridges Topic 4 and the Topic 6 country study",
  "displayDate": "11 September 1973"
}
```

| Field         | Required | Notes                                                             |
|---------------|----------|---------------------------------------------------------------------|
| `id`          | no       | Auto-generated (`evt-1`, `evt-2`, ...) if left out.                  |
| `date`        | yes      | The true date, used for sorting. See "Date format" below.           |
| `text`        | yes      | The event description shown on the card.                             |
| `note`        | no       | A short curriculum note, shown once the card is revealed (e.g. which syllabus topic it connects to). Never shown before the card is committed. |
| `displayDate` | no       | Overrides the human-readable date shown after reveal. Auto-generated from `date` if left out (e.g. `1973-09-11` → "11 September 1973"). Useful for approximate dates, e.g. set `date` to a best-guess year for sorting but `displayDate` to `"c. 1200 BCE"`. |

### The first event is the anchor

Whichever event is **first** in the `events` array is placed on the timeline
for free at the start of the round, with its date already revealed. It is
not scored. Every other event is dealt one at a time, in random order, for
the player to place.

### Date format

`date` accepts:

- `"YYYY"` — year only, e.g. `"1973"`
- `"YYYY-MM"` — year and month, e.g. `"1973-09"`
- `"YYYY-MM-DD"` — year, month, and day, e.g. `"1973-09-11"`
- A leading `-` for BCE dates, e.g. `"-0323"` means 323 BCE.

Two events with the same `date` (at whatever precision each is given) are
treated as **tied** — placing a new card on either side of a tied event
counts as correct, since the true order between them isn't distinguishable
from the data given.

## Minimal example

```json
{
  "id": "example",
  "title": "Example set",
  "description": "A tiny set for testing.",
  "events": [
    { "date": "1917", "text": "The Bolsheviks seize power in Russia" },
    { "date": "1922", "text": "Mussolini marches on Rome" },
    { "date": "1933", "text": "Hitler is appointed Chancellor of Germany" },
    { "date": "1938", "text": "Germany annexes Austria" }
  ]
}
```
