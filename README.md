# SleepOver signature assets

The images used by the SleepOver email signatures, hosted here so they no longer
depend on HubSpot Files. Signature images are hotlinked, never embedded — every
time anyone opens an email, their client re-fetches these files. That is why
they live in a repo with stable, versioned URLs.

## How to reference an image

Always through jsDelivr, always pinned to a tag:

```
https://cdn.jsdelivr.net/gh/magn3tic/sleepover-signature-assets@v1.0.0/icons/mail.png
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
names/      per-person name artwork, by region: names/tanzania/agnes-busunzu.png
```

## Filenames

Lowercase, no accents, hyphens instead of spaces. Nothing here is ever named
with a space: `%20` in an image URL is one of the most reliable ways to break a
signature in a mail client.

Artwork is stored at 2× the size it is displayed at, so it stays sharp on retina
screens — `names/tanzania/agnes-busunzu.png` is 462×112 for a 231×56 slot.

## Where the files came from

Downloaded from the live HubSpot URLs (`magneticcreative.com/hubfs/SleepOver
Signature/…`) — the exact bytes recipients were already loading, not the local
originals, which HubSpot had re-optimized on upload. The old URL → new path
mapping is kept outside this repo in `signature-migration/url-map.json`, next to
the tooling that does the mirroring.

Nothing has been deleted from HubSpot. Those files stay live until every
signature has been migrated and confirmed.
