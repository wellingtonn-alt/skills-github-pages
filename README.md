# Chronology

A tap-to-place chronology game for IB History classes, in the style of the
New York Times *Flashback*. One event starts on a timeline as a free
"anchor". The rest are dealt one at a time, and the player taps where each
one belongs — before or after what's already there. Dates stay hidden
until a card is committed; a wrong guess slides the card to its true spot
and scores nothing.

It's a static site: no server, no database, no accounts, and no student
data ever leaves the device — scores only ever exist in the browser tab
that's playing.

## Playing a set

Every set has its own link:

```
https://your-site/?set=cold-war-americas
```

That's the only thing a teacher needs to paste into Canvas as the Do Now.
Opening the site with no `?set=` at all shows a small picker with the
built-in sets and a link to the builder.

## Building a new set

Open **`builder.html`** (linked from the top of the game page). Paste a
plain list of events, one per line:

```
1973-09-11 | The Chilean armed forces overthrow Allende | Bridges Topic 4 and the Topic 6 country study
```

The page checks it as you type, shows a preview table, and — once
everything looks right — lets you download a finished `.json` file. Drop
that file into the `sets/` folder and commit it; that's the entire
handoff. No one needs to write or edit JSON by hand. Full field reference:
[`SCHEMA.md`](SCHEMA.md).

## Publishing / hosting

This is a plain static site (HTML, CSS, and JavaScript — no build step).
To host it on GitHub Pages: **Settings → Pages → Source: "Deploy from a
branch" → Branch: `main`**, then save. GitHub gives you a URL a minute or
two later; that's the base for every `?set=` link.

## Repository layout

- `index.html`, `js/game.js`, `css/style.css` — the game itself.
- `builder.html`, `js/builder.js` — the set-authoring page.
- `js/dates.js` — shared date parsing, used by both the game and the builder.
- `sets/*.json` — one file per set. Two are included as examples.
- `SCHEMA.md` — the set file format, for reference.
