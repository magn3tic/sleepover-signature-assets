# Signature generator

Everything that turns the list of people into the published signature pages.
It replaces the workbook and the local pipeline (`build-data.py`,
`signature-generator.js`, `write-page-urls.py`, `publish-pages.sh`): nothing
runs on anyone's Mac any more.

```
people.json      THE SOURCE OF TRUTH. One record per signature, edited by the admin panel.
config.json      Repo, current image tag (cdnTag), regions, layout limits.
core.js          The signature markup + the data rules. Shared by the build and the browser.
build.js         people.json -> pages/*.html. Validates; fails on missing artwork.
renderer.js      Draws name artwork in the browser with the locally installed font.
admin-boot.js    Loaded by pages/index.html for everyone; does nothing until the gear is clicked.
admin.js         The admin panel: create / edit / delete, live preview, publish.
../.github/workflows/publish.yml   Validate, tag new artwork, rebuild pages, publish.
```

## How a change gets published

1. Someone with write access opens `pages/index.html`, clicks the gear (top
   right) and pastes their GitHub token once.
2. Edit / New signature / Delete. The panel previews the exact markup that will
   be published, light and dark.
3. Save makes **one commit on `main`**: `generator/people.json`, plus the PNG
   under `names/<region>/` when the artwork changed.
4. `publish.yml` runs:
   - `node generator/build.js --check`. A bad record stops here and nothing
     live changes.
   - If anything under `names/`, `regions/` or `icons/` changed since the tag
     in `config.json`, it cuts the next tag (`v1.8.0`, `v1.9.0`, …) and points
     `cdnTag` at it. jsDelivr caches a tag forever, which is what keeps the
     images in emails already sent from ever changing. A tag is never reused.
   - `node generator/build.js` writes `pages/`, the bot commits it, and Pages
     is asked to rebuild.
5. The panel follows the run and says when the page is live (about 2 minutes).

A correction only reaches a person once they **install their signature again**
from their link. That has always been true: what is in their mail client is a
copy.

## people.json

```json
{
  "slug": "Troy-Dods",                       page name, never changes (it is the person's link)
  "region": "International",                 a key from config.json regions
  "name": "Troy Dods",
  "position": "BUSINESS ADMINISTRATOR",
  "phone": "+27 ...",                        empty = row hidden
  "email": "troy@...",
  "officePhone": "+27 (0)10 110 9910",       empty = row hidden
  "website": "sleepover.travel",
  "address": ["line 1", "line 2"],
  "nameImage": "names/international/troy-dods.png",
  "logo": "regions/so-tagline.png"           optional: a lockup other than the region's
}
```

Order in the file is the order on the index page, within each region.

Rules carried over from `build-data.py`, now in `core.js`: name artwork placed
at half its size and capped at 300px wide (`nameMaxW`), lockups at 150px,
office phones normalised to `+27 (0)…`, single-line addresses wrapped on their
commas, the Fourways office gets its pinned map link, everyone else a map
search. Renaming a person keeps their slug, so their link keeps working.

## Name artwork and the font licence

The artwork font is **Obviously Narrow Black** (OH no Type), licensed to
Magnetic Creative as a *desktop* licence for 1–3 users. That licence does not
allow serving the font over the internet (§6d) or embedding it in software
(§6c), and allows PNGs made by a licensed user (§7). So:

- **No font file is ever committed, served or downloaded here.** Do not add
  one. `renderer.js` asks the browser for the copy installed on the admin's own
  computer through CSS `local()`.
- The admin needs the font installed and Chrome or Edge (Safari does not let
  pages use user-installed fonts). Restart the browser after installing.
- Without the font, the panel still edits text, and accepts a PNG made by
  design ("Upload a PNG from design").

Geometry in `renderer.js` was fitted to design's 86 originals by pixel overlap:
name 72px, first word `#C375E3`, the rest `#8E44AD`; position 24px uppercase
`#3E0046` rotated −1.8°; sticker `#FFF9C4`, a pill 55.75px tall, 41px longer
than the position, rotated −1.5°. Average overlap with the originals is 0.86 on
the name, 0.88 on the sticker; the rest is hand-placement variation between the
originals themselves.

## Running it locally

```bash
node generator/build.js --check   # validate
node generator/build.js           # write pages/
```

Node 18+, no `npm install`. Pushing to `main` is what publishes; there is no
other deploy step.

## Admin access

The panel works for anyone whose GitHub account has **write access to this
repo**, with a token for it:

- Fine-grained token (recommended): github.com → Settings → Developer settings →
  Fine-grained tokens → Generate. Resource owner `magn3tic`, only this
  repository; permissions Contents *Read and write*, Actions *Read*, Pages
  *Read*. The org may need to approve it.
- A classic token with the `repo` scope also works.

To take someone's access away, remove them from the repo (or revoke the token).
The token lives in that person's browser (`localStorage`, key
`so-admin-token`); "Sign out" in the panel's settings removes it.

## Undoing a change

Every save is a normal commit on `main` ("Add …", "Update …", "Delete …").
Revert it on GitHub (or `git revert`) and push: the workflow republishes.
Tags are never moved or deleted.

## Adding a region

Add the lockup as `regions/so-<asset-folder>.png`, add an entry to `regions` in
`config.json` (its position is the order on the index), push. The panel lists
it straight away.
