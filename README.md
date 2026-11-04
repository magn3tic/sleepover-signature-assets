# SleepOver signature assets

The images used by the SleepOver email signatures, hosted here so they no longer
depend on HubSpot Files. Signature images are hotlinked, never embedded — every
time anyone opens an email, their client re-fetches these files. That is why
they live in a repo with stable, versioned URLs.

## How to reference an image

Always through jsDelivr, always pinned to a tag:

```
https://cdn.jsdelivr.net/gh/magn3tic/sleepover-signature-assets@v1.3.0/icons/mail.png
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
pages/      the signature pages, plus index.html (generated)
generator/  people.json (the data), the build, the admin panel
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
`main`. Pushing a page therefore does not touch what `@v1.3.0` serves.

The pages are generated from `generator/people.json` by `generator/build.js`,
and published automatically by `.github/workflows/publish.yml` on every change
to it. Editing a page by hand is overwritten on the next build.

To add, change or remove a signature, use the admin panel: open
`pages/index.html`, click the gear at the top right. Everything about it, and
about the font licence that shapes how name artwork is made, is in
[`generator/README.md`](generator/README.md).

The old route (the workbook, `magn3tic/sleepover-signature-pipeline` and its
`publish-pages.sh`) is retired. Do not use it: it would overwrite changes made
in the panel.
