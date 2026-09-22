# SleepOver signature assets

The images used by the SleepOver email signatures, hosted here so they no longer
depend on HubSpot Files. Signature images are hotlinked, never embedded — every
time anyone opens an email, their client re-fetches these files. That is why
they live in a repo with stable, versioned URLs.

## How to reference an image

Always through jsDelivr, always pinned to a tag:

```
https://cdn.jsdelivr.net/gh/magn3tic/sleepover-signature-assets@v1.2.0/icons/mail.png
```

A tag is immutable on jsDelivr: once a version has been served it is cached
forever and will never change under a live signature. To ship new artwork, push
it and cut a **new** tag, then update the signatures to that tag. Never re-point
an existing tag.

`@main` also works and picks up pushes, but it is for previewing only — do not
put `@main` URLs into a signature that goes out to people.

GitHub Pages serves the same files as a fallback, without jsDelivr's caching:

```
https://magn3tic.github.io/sleepover-signature-assets/icons/mail.png
```

## Layout

```
icons/      shared chrome: location, mail, phone-1, phone-2, website
regions/    region lockups: so-tanzania.png, so-south-africa.png, …
            plus so-tagline.png, the region-neutral one
names/      per-person name artwork, by region: names/tanzania/agnes-busunzu.png
pages/      the 84 signature pages, plus index.html
```

## The pages

`pages/` is what the 84 people actually open to copy their signature:

```
https://magn3tic.github.io/sleepover-signature-assets/pages/index.html
https://magn3tic.github.io/sleepover-signature-assets/pages/Piers-Bunting.html
```

`index.html` is the master page — every signature, grouped by region, each with
its own copy button. Each person's own link is also written into column K of the
workbook, so it can be sent straight from there.

Two different jobs in one repo, and the difference matters. The images are
pinned by tag and must never change under a signature already sitting in
someone's mail client. The pages are expected to change, and are served off
`main`. Pushing a page therefore does not touch what `@v1.2.0` serves.

The pages are generated — they are built from the workbook by the pipeline in
`magn3tic/sleepover-signature-pipeline` and copied here by its
`publish-pages.sh`. Editing one by hand is overwritten on the next build.

## The tagline lockup

`regions/so-tagline.png` is the SleepOver lockup with *A SIMPLER WAY TO STAY*
under it, and it names no region. It sits in `regions/` because that is where
the build looks for a lockup, not because it is one.

It exists because the newer name artwork carries its own region badge — Zanele
Nkonki's PNG has *SOUTH AFRICA* on it, the other 52 South Africa images do not.
A card whose name artwork already says the region takes this lockup; a card
whose artwork does not takes `so-<region>.png`. Which one a person gets is
column J of the workbook, and the build measures whichever file that column
names, so the two shapes both place correctly.

## Filenames

Lowercase, no accents, hyphens instead of spaces. Nothing here is ever named
with a space: `%20` in an image URL is one of the most reliable ways to break a
signature in a mail client.

Artwork is stored at 2× the size it is displayed at, so it stays sharp on retina
screens — `names/tanzania/agnes-busunzu.png` is 462×112 for a 231×56 slot.

## Where the files came from

The originals in `SleepOver/assets`, not what HubSpot serves.

HubSpot re-compresses uploads with a lossy optimiser, and it does not do it
once: the same `location.png` came back as 784 bytes in one run of the mirroring
script and 527 bytes in the next, with different pixels. The larger variant is
pixel-identical to the local original, so the local file is the artwork and
HubSpot had been serving a degraded copy of it.

One exception: `names/international/claudie-osborne.png` came from HubSpot,
because the local file was a byte-identical copy of Charles Gover's artwork.
HubSpot had the only correct copy, so it is the lossy variant until someone
re-exports it.

The old URL → new path mapping lives outside this repo, in
`signature-migration/url-map.json`, next to the tooling that does the mirroring.

Nothing has been deleted from HubSpot. Those files stay live until every
signature has been migrated and confirmed.
