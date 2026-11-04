/*
 * SleepOver signatures: the shared core.
 *
 * Loaded by build.mjs (Node) to write pages/, and by the admin panel on
 * pages/index.html (browser) for its live preview, so what Althia previews is
 * byte for byte what gets published. No dependencies, no DOM.
 *
 *   signature(emp, id, iconBase)  the email markup people paste / install
 *   toEmp(record, config, sizes)  a people.json record -> the object signature() takes
 *   slugs, address wrapping, phone tidying: the rules build-data.py used to apply
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SOCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

/* ---------- dark mode ------------------------------------------------------
   The signature paints NO background of its own, so it sits on whatever the
   client gives it. Media queries, prefers-color-scheme and [data-ogsc] hooks
   are useless here: the signature is pasted into the client's signature form,
   which keeps the inline styles and throws the <style> block away.

   All type is pure black, and that is deliberate. Gmail and Outlook dark mode
   do not read a colour and leave it alone: they run a lightness inversion over
   any message that looks light to them, and pure black is the value that comes
   out the other side as near-white. A mid-tone only gets nudged, which is why
   #3A0000 or #8C6E80 end up muddy instead of legible. Black in, white out.

   Artwork is never inverted by any client, so the yellow lockup, the
   yellow-and-purple name and the round icons carry their own fill and read
   either way.
--------------------------------------------------------------------------- */

/* ---------- design tokens (measured on the mockup, scale 0.615) ---------- */
const T = {
  width: 594,
  // The split follows the content, not the mockup's 380/213: the widest name
  // artwork is 300px, while the old 166px of address text wrapped "7 Georgian
  // Crescent West," and the farm addresses onto an extra line in Outlook.
  leftCol: 340,
  rightCol: 253,
  // Breathing room on either side of the vertical rule. The left column keeps
  // its own padding-right because clients that compress the signature (Gmail on
  // a phone) collapse the 380px cell down to the width of the email address,
  // which would otherwise sit flush against the rule.
  gutterLeft: 22,
  gutterRight: 25,
  pad: 16,
  // Pure black, so the dark-mode inversion in Gmail and Outlook turns it into
  // near-white. See the note above.
  ink: "#000000",
  rule: "#000000",
  // Outlook for Windows renders with Word, which reads only the FIRST family in
  // the stack and drops to Times New Roman when that one is not installed. So
  // the first entry has to be a font every Windows machine ships with: Nunito
  // Sans used to lead here and turned the contact block into Times for every
  // sender and recipient who did not happen to have it installed.
  font: "'Segoe UI',Arial,Helvetica,sans-serif",
  fontCondensed: "'Arial Narrow',Arial,Helvetica,sans-serif",
  size: 9,
  leading: 12,
  icon: 12,
  // Name artwork and region lockup are drawn this many px shorter than their
  // measured height, width scaled to match, so the artwork keeps its shape.
  imgShrink: 2
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");

/** Style for a cell that holds nothing but an image of height `h`.
    font-size:0 kills the gap browsers leave under an image. For Outlook on
    Windows, which lays the message out with Word, the line must be allowed to
    GROW: Word sits an inline image on the text baseline, so any fixed line
    (mso-line-height-rule:exactly) cuts the top off the image -- even one
    exactly as tall as the image. "at-least" lets Word make room instead.
    Tested in classic Outlook 16.0.20430 at 125%: "exactly" cropped the name,
    lockup and icons in every reply; "at-least" rendered them whole. */
/** Measured artwork drawn T.imgShrink px shorter, width in proportion. */
const shrink = (img) => {
  const h = img.h - T.imgShrink;
  return { ...img, w: Math.round(img.w * h / img.h), h };
};

const imgCell = (h) => `font-size:0;line-height:${h}px;mso-line-height-rule:at-least;`;

/** Inline style for the text run inside a link or span. Word ignores the
    td's font and the <a>'s own text-decoration and paints its blue underlined
    Hyperlink style instead, so the run carries colour, font and decoration
    itself. */
const runStyle = () => `color:${T.ink};text-decoration:none;font-family:${T.font};`;

/** Icon + text row. `lines` is either a string or an array (multi-line block).
    `href` may be null: the two phone numbers are deliberately not links. */
function contactRow(icon, lines, href, topPad, iconBase) {
  const multi = Array.isArray(lines);
  const valign = multi ? "top" : "middle";
  const link = (inner) => `<a href="${href}"${href.startsWith("http") ? ' target="_blank"' : ""} style="${runStyle()}"><span style="${runStyle()}">${inner}</span></a>`;
  // Bare text is still wrapped in a styled span. Phones and Gmail auto-detect
  // phone numbers and paint their own blue underlined link around them; a span
  // that already carries the colour and text-decoration is what most clients
  // keep, so the number goes on reading as text.
  const plain = (inner) => `<span style="${runStyle()}">${inner}</span>`;
  const wrap = href ? link : plain;
  const body = wrap(multi ? lines.map(esc).join("<br />") : esc(lines));

  return `
              <tr>
                <td style="padding:${topPad}px 0 0 0;">
                  <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
                    <tr>
                      <td width="${T.icon}" valign="${valign}" style="width:${T.icon}px;${imgCell(T.icon)}">
                        <img src="${iconBase}${icon}" width="${T.icon}" height="${T.icon}" alt="" style="display:block;border:0;outline:none;width:${T.icon}px;height:${T.icon}px;" />
                      </td>
                      <td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                      <td valign="${valign}" style="font-family:${T.font};font-size:${T.size}px;line-height:${T.leading - (multi ? 1 : 0)}px;mso-line-height-rule:exactly;font-weight:600;color:${T.ink};">${body}</td>
                    </tr>
                  </table>
                </td>
              </tr>`;
}

/**
 * Height of the vertical rule: whichever column is taller.
 *
 * The rule used to be a hard-coded 148px measured off the Fourways mockup, but
 * the right column now varies by a lot -- five address lines and an office
 * phone for International, two lines and no office phone for Namibia -- so a
 * fixed value either overshoots the block or stops short of it.
 */
function ruleHeight(emp) {
  const rowH = T.leading;          // single-line contact row
  const addrH = T.leading - 1;     // per line inside the address block

  // name artwork, optional phone row, email row
  const left = shrink(emp.nameImage).h +
    (emp.phone ? 12 + rowH : 0) +
    10 + rowH;

  // lockup, optional office phone, website, address block
  const right = shrink(emp.logo).h +
    (emp.officePhone ? 7 + rowH : 0) +
    10 + rowH +
    10 + Math.max(emp.address.length, 1) * addrH;

  return Math.max(left, right);
}

/** Legal footer under every signature. A plain paragraph with no width of its
    own, so it runs the full width the client gives it. */
const CONFIDENTIALITY = `<strong>CONFIDENTIALITY NOTICE:</strong><br>The contents of this email message and any attachments are intended solely for the addressee(s) and may contain confidential and/or privileged information and may be legally protected from disclosure. If you are not the intended recipient of this message or their agent, or if this message has been addressed to you in error, please immediately alert the sender by reply email and then delete this message and any attachments. If you are not the intended recipient, you are hereby notified that any use, dissemination, copying, or storage of this message or its attachments is strictly prohibited.`;

function signature(emp, id, iconBase) {
  const rule = ruleHeight(emp);
  const art = shrink(emp.nameImage);
  const logo = shrink(emp.logo);

  return `<div id="${id}">
<style type="text/css">
/* Only the stacked mobile layout lives here. Signature forms strip <style>, so
   nothing that matters for legibility may depend on it. */
@media only screen and (max-width:620px){
  .so-wrap,.so-grid{width:100% !important;max-width:100% !important;}
  .so-col{display:block !important;width:100% !important;max-width:100% !important;padding-left:16px !important;padding-right:16px !important;box-sizing:border-box !important;}
  .so-rule{display:none !important;}
  .so-right{padding-top:16px !important;border-top:1px solid ${T.rule};}
  .so-name img{width:100% !important;max-width:${art.w}px !important;height:auto !important;}
}
</style>
<table class="so-wrap" cellpadding="0" cellspacing="0" border="0" role="presentation" width="${T.width}" style="width:${T.width}px;max-width:${T.width}px;border-collapse:collapse;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <tr>
    <td style="padding:${T.pad}px 0;">
      <table class="so-grid" cellpadding="0" cellspacing="0" border="0" role="presentation" width="${T.width}" style="width:100%;border-collapse:collapse;">
        <tr>

          <!-- ============ left column ============ -->
          <td class="so-col" width="${T.leftCol}" valign="bottom" style="width:${T.leftCol - 15 - T.gutterLeft}px;padding:0 ${T.gutterLeft}px 0 15px;">
            <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
              <tr>
                <td class="so-name" style="padding:0;${imgCell(art.h)}">
                  <img src="${art.url}" width="${art.w}" height="${art.h}" alt="${attr(emp.name + ", " + emp.position)}" style="display:block;border:0;outline:none;width:${art.w}px;height:${art.h}px;" />
                </td>
              </tr>
${emp.phone ? contactRow("phone-2.png", emp.phone, null, 12, iconBase) : ""}
${contactRow("mail.png", emp.email, "mailto:" + emp.email, 10, iconBase)}
            </table>
          </td>

          <!-- ============ vertical rule ============ -->
          <td class="so-rule" width="1" valign="top" style="width:1px;font-size:0;line-height:0;">
            <table cellpadding="0" cellspacing="0" border="0" role="presentation" width="1" style="width:1px;border-collapse:collapse;">
              <tr>
                <td class="so-rule-fill" width="1" height="${rule}" bgcolor="${T.rule}" style="width:1px;height:${rule}px;background-color:${T.rule};font-size:1px;line-height:1px;">&nbsp;</td>
              </tr>
            </table>
          </td>

          <!-- ============ right column ============ -->
          <td class="so-col so-right" width="${T.rightCol}" valign="top" style="width:${T.rightCol - T.gutterRight}px;padding:0 0 0 ${T.gutterRight}px;">
            <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
              <tr>
                <td style="padding:0;${imgCell(logo.h)}">
                  <a href="${emp.websiteUrl}" target="_blank" style="text-decoration:none;">
                    <img src="${logo.url}" width="${logo.w}" height="${logo.h}" alt="${attr(logo.alt)}" style="display:block;border:0;outline:none;width:${logo.w}px;height:${logo.h}px;" />
                  </a>
                </td>
              </tr>${emp.officePhone ? contactRow("phone-1.png", emp.officePhone, null, 7, iconBase) : ""}
${contactRow("website.png", emp.website, emp.websiteUrl, 10, iconBase)}
${contactRow("location.png", emp.address, emp.mapsUrl, 10, iconBase)}
            </table>
          </td>

        </tr>
      </table>
    </td>
  </tr>
</table>
<p style="margin:0 0 0 15px;font-family:${T.font};font-size:${T.size}px;line-height:${T.leading}px;mso-line-height-rule:exactly;color:${T.ink};">${CONFIDENTIALITY}</p>
</div>`;
}

/* ======================= data rules (ex build-data.py) =================== */

/** Python's round(): halves go to the even neighbour. The published sizes
    were computed with it, and 194.5 has to come out 194, not 195. */
function pyRound(x) {
  const f = Math.floor(x), d = x - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

/** Python's urllib.parse.quote(s) (safe="/"), so URLs match what was published. */
function pyQuote(s) {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, "/");
}

const tidy = (raw) => String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();

/** Lowercase, no accents, no spaces: the filenames in the asset repo. */
function assetSlug(text) {
  return String(text).trim().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

/** Page name: the person's name with hyphens for spaces, as it always was. */
function pageSlug(text) {
  return tidy(text).normalize("NFC").replace(/\s+/g, "-").replace(/[\/\\?#%"<>|:*]/g, "");
}

/** A single-line address is wrapped on its commas into ~30-character lines;
    an address that already has line breaks is kept as typed. */
function wrapAddress(raw) {
  raw = String(raw || "").trim();
  if (!raw) return [];
  if (raw.indexOf("\n") !== -1) return raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const lines = []; let cur = "";
  parts.forEach((part, i) => {
    const piece = part + (i < parts.length - 1 ? "," : "");
    if (cur && cur.length + 1 + piece.length > 30) { lines.push(cur); cur = piece; }
    else cur = (cur + " " + piece).trim();
  });
  if (cur) lines.push(cur);
  return lines;
}

/** Office phone: always starts with +, "+27(0)" reads "+27 (0)". */
function normPhone(raw) {
  let v = tidy(raw);
  if (!v) return "";
  if (v[0] !== "+") v = "+" + v;
  return v.replace(/^\+(\d+)\(/, "+$1 (");
}

function cdnBase(cfg) { return "https://cdn.jsdelivr.net/gh/" + cfg.repo + "@" + cfg.cdnTag + "/"; }
function pagesBase(cfg) {
  const [owner, name] = cfg.repo.split("/");
  return "https://" + owner.toLowerCase() + ".github.io/" + name + "/pages/";
}
function region(cfg, key) { return cfg.regions.find((r) => r.key === key); }
function regionLogo(cfg, reg) { return "regions/so-" + assetSlug(reg.assetFolder) + ".png"; }

function mapsUrl(cfg, lines) {
  const joined = lines.join(", ");
  if (joined.indexOf("Little Fourways") !== -1) return cfg.fourwaysPin;
  return "https://www.google.com/maps/search/?api=1&query=" + pyQuote(joined);
}

/**
 * One people.json record -> the object signature() and the page templates take.
 * `sizes` is the measured pixel size of the two images: {name:{w,h}, logo:{w,h}}.
 * `nameUrl` optionally overrides the artwork URL (the admin preview passes a
 * blob: URL for artwork that has not been published yet).
 */
function toEmp(rec, cfg, sizes, nameUrl) {
  const reg = region(cfg, rec.region);
  if (!reg) throw new Error("Unknown region: " + rec.region);
  const cdn = cdnBase(cfg);
  const scale = Math.min(cfg.nameScale, cfg.nameMaxW / sizes.name.w);
  const website = tidy(rec.website) || "sleepover.travel";
  const address = (rec.address || []).map(tidy).filter(Boolean);
  return {
    name: tidy(rec.name),
    slug: rec.slug,
    pageUrl: pagesBase(cfg) + pyQuote(rec.slug) + ".html",
    position: tidy(rec.position).toUpperCase(),
    phone: tidy(rec.phone),
    email: tidy(rec.email),
    region: reg.heading,
    regionLabel: reg.label,
    regionFolder: reg.key,
    assetFolder: reg.assetFolder,
    sheet: reg.sheet,
    nameImage: {
      url: nameUrl || cdn + rec.nameImage,
      w: pyRound(sizes.name.w * scale),
      h: pyRound(sizes.name.h * scale),
      scaled: scale < cfg.nameScale
    },
    logo: {
      url: cdn + (rec.logo || regionLogo(cfg, reg)),
      w: cfg.logoW,
      h: pyRound(cfg.logoW * sizes.logo.h / sizes.logo.w),
      alt: reg.label
    },
    officePhone: normPhone(rec.officePhone),
    website: website,
    websiteUrl: "https://" + website.replace("https://", "").replace("http://", ""),
    address: address,
    mapsUrl: rec.mapsUrl || mapsUrl(cfg, address)
  };
}

/** Problems that would publish a broken or wrong signature. Empty = fine. */
function validate(rec, cfg, others) {
  const errs = [];
  if (!tidy(rec.name)) errs.push("Name is required.");
  if (!tidy(rec.email)) errs.push("Email is required.");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tidy(rec.email))) errs.push("Email does not look right: " + rec.email);
  if (!region(cfg, rec.region)) errs.push("Pick a region.");
  if (tidy(rec.name) && !rec.slug) errs.push("Missing page name (slug).");
  if (tidy(rec.name) && !rec.nameImage) errs.push("Missing name artwork.");
  if (!(rec.address || []).length) errs.push("Address is required.");
  if (others && others.some((o) => o.slug === rec.slug)) errs.push("Another signature already uses the page name " + rec.slug + ".");
  return errs;
}

/** A page name nobody has yet. Mirrors the old rule: name first, then the
    region appended (Michael-Richardson-South-Africa), then a number. A
    "SleepOver <property>" desk takes its PM / REC suffix like the old files did. */
function newSlug(rec, cfg, taken) {
  const suffix = { "PROPERTY MANAGER": "PM", "RECEPTION": "REC" }[tidy(rec.position).toUpperCase()];
  let base = pageSlug(rec.name);
  if (suffix && /^SleepOver\s/i.test(tidy(rec.name))) base += "-" + suffix;
  const has = (s) => taken.some((t) => t.toLowerCase() === s.toLowerCase());
  if (!has(base)) return base;
  const reg = region(cfg, rec.region);
  const withRegion = base + "-" + pageSlug(reg ? reg.key : "x");
  if (!has(withRegion)) return withRegion;
  for (let i = 2; ; i++) if (!has(withRegion + "-" + i)) return withRegion + "-" + i;
}

function nameImagePath(rec, cfg) {
  const reg = region(cfg, rec.region);
  return "names/" + assetSlug(reg.assetFolder) + "/" + assetSlug(rec.slug) + ".png";
}

/** Width/height from a PNG's IHDR (Uint8Array or Buffer). */
function pngSize(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) throw new Error("not a PNG");
  const u32 = (o) => ((bytes[o] << 24) >>> 0) + (bytes[o + 1] << 16) + (bytes[o + 2] << 8) + bytes[o + 3];
  return { w: u32(16), h: u32(20) };
}

return {
  T, esc, attr, signature, toEmp, validate, newSlug, nameImagePath, pngSize,
  wrapAddress, normPhone, tidy, assetSlug, pageSlug, pyQuote, pyRound,
  cdnBase, pagesBase, region, regionLogo
};
});
