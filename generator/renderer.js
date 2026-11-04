/*
 * Name artwork: "First Rest" in two purples over a yellow sticker carrying the
 * position, the way design drew the 86 originals.
 *
 * LICENSING — read before changing how the font is loaded.
 * The typeface is OH no Type's Obviously Narrow Black, licensed to Magnetic
 * Creative for desktop use (1–3 users). That licence forbids serving the font
 * over the internet (6d) and embedding it in software (6c). So this file never
 * ships, references or downloads a font file: it asks the browser for the copy
 * INSTALLED ON THE COMPUTER of the person using the admin panel, through
 * local(). Without it installed, fontStatus() says so and nothing is drawn.
 * Only the finished PNG leaves that computer (clause 7 allows images).
 *
 * Geometry was fitted to design's PNGs (pixel IoU against the originals, see
 * generator/README.md): same export scale, so a new artwork is placed in the
 * signature exactly like the old ones.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SOArt = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const FAMILY = "SO Artwork Font";
// Names the installed font answers to: full name and PostScript name.
const LOCAL_NAMES = ["Obviously Narrow Black", "Obviously-NarrowBlack"];

const ART = {
  light: "#C375E3",   // first word
  dark: "#8E44AD",    // the rest of the name
  sticker: "#FFF9C4",
  ink: "#3E0046",     // position
  name: { size: 72, x: 3, baseline: 56 },
  // Design kept the right-hand end of the sticker level and let a longer
  // position push the left end down, so both sit a little lower as the
  // position gets longer: baseline/centre = a + b * text width.
  pos: { size: 24, x: 21, baseline: [88.08, 0.0285], rotate: -1.8 },
  stk: { padRight: 41, x: 1, cy: [80.89, 0.0094], h: 55.75, rotate: -1.5 },
  margin: 3
};

let fontPromise = null;

/** Registers the local() face once and reports whether the font is installed. */
function fontStatus() {
  if (typeof document === "undefined") return Promise.resolve(false);
  if (!fontPromise) {
    const src = LOCAL_NAMES.map((n) => `local("${n}")`).join(", ");
    const face = new FontFace(FAMILY, src);
    document.fonts.add(face);
    fontPromise = face.load().then(() => true, () => false);
  }
  return fontPromise;
}

function split(name) {
  const clean = String(name || "").replace(/\s+/g, " ").trim();
  const i = clean.indexOf(" ");
  return i === -1 ? [clean, ""] : [clean.slice(0, i), clean.slice(i + 1)];
}

/**
 * Draws the artwork and returns a canvas sized to it.
 * opts.family lets the fitting harness use another face name; production
 * always uses the installed font.
 */
function render(name, position, opts) {
  opts = opts || {};
  const family = opts.family || FAMILY;
  const pos = String(position || "").replace(/\s+/g, " ").trim().toUpperCase();
  const [first, rest] = split(name);

  const make = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  };
  const probe = make(1, 1).getContext("2d");
  const fontOf = (px) => `${px}px "${family}"`;

  // Measure.
  probe.font = fontOf(ART.name.size);
  const mFirst = probe.measureText(first);
  const space = probe.measureText(" ").width;
  const restX = ART.name.x + mFirst.actualBoundingBoxLeft + mFirst.width + space;
  const mRest = rest ? probe.measureText(rest) : null;
  const nameRight = rest ? restX + mRest.actualBoundingBoxRight : ART.name.x + mFirst.actualBoundingBoxLeft + mFirst.actualBoundingBoxRight;
  const descent = Math.max(mFirst.actualBoundingBoxDescent, mRest ? mRest.actualBoundingBoxDescent : 0);

  probe.font = fontOf(ART.pos.size);
  const posW = pos ? probe.measureText(pos).width : 0;
  const stkW = pos ? posW + ART.stk.padRight : 0;
  const theta = ART.stk.rotate * Math.PI / 180;
  // Corners of the rotated sticker, for the canvas bounds.
  const halfExtentX = Math.abs(stkW / 2 * Math.cos(theta)) + Math.abs(ART.stk.h / 2 * Math.sin(theta));
  const halfExtentY = Math.abs(stkW / 2 * Math.sin(theta)) + Math.abs(ART.stk.h / 2 * Math.cos(theta));
  const stkCx = ART.stk.x + stkW / 2;
  const stkCy = ART.stk.cy[0] + ART.stk.cy[1] * posW;
  const posY = ART.pos.baseline[0] + ART.pos.baseline[1] * posW;

  const W = Math.ceil(Math.max(nameRight, pos ? stkCx + halfExtentX : 0)) + ART.margin;
  const H = Math.ceil(Math.max(ART.name.baseline + descent, pos ? stkCy + halfExtentY : 0)) + ART.margin;
  const canvas = make(W, H);
  const x = canvas.getContext("2d");

  if (pos) {
    x.save();
    x.translate(stkCx, stkCy);
    x.rotate(theta);
    x.beginPath();
    x.roundRect(-stkW / 2, -ART.stk.h / 2, stkW, ART.stk.h, ART.stk.h / 2);
    x.fillStyle = ART.sticker;
    x.fill();
    x.restore();

    x.save();
    x.translate(ART.pos.x, posY);
    x.rotate(ART.pos.rotate * Math.PI / 180);
    x.font = fontOf(ART.pos.size);
    x.fillStyle = ART.ink;
    x.fillText(pos, 0, 0);
    x.restore();
  }

  x.font = fontOf(ART.name.size);
  x.fillStyle = ART.light;
  x.fillText(first, ART.name.x + mFirst.actualBoundingBoxLeft, ART.name.baseline);
  if (rest) {
    x.fillStyle = ART.dark;
    x.fillText(rest, restX, ART.name.baseline);
  }
  return canvas;
}

function toPngBlob(canvas) {
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("PNG export failed"))), "image/png"));
}

return { ART, FAMILY, LOCAL_NAMES, fontStatus, render, toPngBlob, split };
});
