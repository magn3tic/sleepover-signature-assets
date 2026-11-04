#!/usr/bin/env node
/*
 * Builds pages/ from generator/people.json. Replaces build-data.py +
 * signature-generator.js + the workbook: people.json is the source of truth,
 * and the admin panel on pages/index.html is what edits it.
 *
 *   node generator/build.js            write pages/
 *   node generator/build.js --check    validate only, write nothing
 *
 * Image sizes are read from the PNGs in this repo, so a person whose artwork
 * is not committed fails the build instead of publishing a broken image.
 * Runs in the publish workflow (.github/workflows/publish.yml); runs locally
 * the same way with any Node >= 18, no npm install.
 */
const fs = require("fs");
const path = require("path");
const core = require("./core.js");
const { signature: coreSignature, T } = core;

const REPO = path.resolve(__dirname, "..");
const OUT = path.join(REPO, "pages");
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const records = JSON.parse(fs.readFileSync(path.join(__dirname, "people.json"), "utf8"));
if (process.env.SO_REPO) cfg.repo = process.env.SO_REPO;

const ICON_BASE = core.cdnBase(cfg) + "icons/";
const signature = (emp, id) => coreSignature(emp, id, ICON_BASE);

/* ------------------------------ load + check ------------------------------ */
const errors = [];
const sizeCache = {};
function size(rel) {
  if (!sizeCache[rel]) {
    const file = path.join(REPO, rel);
    if (!fs.existsSync(file)) return null;
    sizeCache[rel] = core.pngSize(fs.readFileSync(file));
  }
  return sizeCache[rel];
}

const employees = [];
records.forEach((rec, i) => {
  const who = rec.name || "record " + (i + 1);
  const errs = core.validate(rec, cfg, records.slice(0, i));
  const reg = core.region(cfg, rec.region);
  const nameSize = rec.nameImage && size(rec.nameImage);
  const logoPath = reg && (rec.logo || core.regionLogo(cfg, reg));
  const logoSize = logoPath && size(logoPath);
  if (rec.nameImage && !nameSize) errs.push("artwork " + rec.nameImage + " is not in the repo");
  if (logoPath && !logoSize) errs.push("lockup " + logoPath + " is not in the repo");
  if (errs.length) { errors.push(who + ": " + errs.join(" ")); return; }
  employees.push(core.toEmp(rec, cfg, { name: nameSize, logo: logoSize }));
});

// The index lists regions in config order, people in people.json order.
const order = cfg.regions.map((r) => r.key);
employees.sort((a, b) => order.indexOf(a.regionFolder) - order.indexOf(b.regionFolder));

if (errors.length) {
  console.error("people.json has " + errors.length + " problem(s):\n  - " + errors.join("\n  - "));
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log("people.json OK: " + employees.length + " signatures.");
  process.exit(0);
}

/* ------------------------------- templates -------------------------------- */
/* ---------- MAG brand, for the wrapper pages only --------------------------
   Pulled from magneticcreative.com's own stylesheet so this tool looks like it
   belongs to the agency. None of it touches the copied signature markup.
--------------------------------------------------------------------------- */
const MAG = {
  dark: "#232323",
  darkAlt: "#323232",
  primary: "#d53703",
  secondary: "#b59756",
  warm: "#bab8ac",
  light: "#ffffff",
  lightAlt: "#f2f2f2",
  grayLight: "#d9d9d9",
  grayDarkest: "#707070",
  fontBody: "Aeonik,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  fontDisplay: "Fragment,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  fontUrl: "https://magneticcreative.com/hubfs/2023-web/fonts/"
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");

/* Lucide icons, inlined so the pages have no network dependency for UI chrome
   and stay on one stroke width. */
const ICON = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

/* Alt text for the seven install pictures in guide/ -- the readable version
   of each step for screen readers and when images are blocked. */
const GUIDE_STEPS = [
  "click Download signature (.htm). A file with your name is saved to Downloads.",
  "close Outlook.",
  "open File Explorer, paste %APPDATA%\\Microsoft\\Signatures into the address bar and press Enter.",
  "drag your .htm file from Downloads into the Signatures folder; replace the old one if asked.",
  "open Outlook, go to File, Options, Mail and click Signatures.",
  "select your signature, choose it for New messages and Replies/forwards, then click OK.",
  "click New Email: your signature appears on its own. Send yourself a test and reply to it."
];
const PASTE_STEPS = [
  "click Copy (Outlook Web / Mac only). Your signature is now on the clipboard.",
  "in Outlook on the web or the new Outlook open Settings, Account, Signatures (on a Mac: Outlook, Settings, Signatures).",
  "click Add signature, type your name as its name, click in the box and paste with Ctrl + V or Cmd + V.",
  "tick Set default for new messages and Set default for replies and forwards, then click Save.",
  "click New mail: your signature appears on its own. Send yourself a test and reply to it."
];
const SIG_FOLDER = "%APPDATA%\\Microsoft\\Signatures";

/* ========================== shared page chrome =========================== */

/** @font-face for MAG's own faces, served from MAG's CDN. */
const fontFaces = `
@font-face{font-family:Aeonik;font-style:normal;font-weight:400;font-display:swap;
  src:url(${MAG.fontUrl}Aeonik-Regular.woff2) format("woff2"),url(${MAG.fontUrl}Aeonik-Regular.woff) format("woff");}
@font-face{font-family:Aeonik;font-style:normal;font-weight:700;font-display:swap;
  src:url(${MAG.fontUrl}Aeonik-Bold.woff2) format("woff2"),url(${MAG.fontUrl}Aeonik-Bold.woff) format("woff");}
@font-face{font-family:Fragment;font-style:normal;font-weight:400;font-display:swap;
  src:url(${MAG.fontUrl}PPFragment-GlareRegular.woff2) format("woff2"),url(${MAG.fontUrl}PPFragment-GlareRegular.woff) format("woff");}`;

/** Tokens, reset and the pieces both page types share. */
const baseCSS = `
:root{
  --dark:${MAG.dark}; --dark-alt:${MAG.darkAlt}; --primary:${MAG.primary};
  --secondary:${MAG.secondary}; --warm:${MAG.warm}; --light:${MAG.light};
  --light-alt:${MAG.lightAlt}; --gray-light:${MAG.grayLight}; --gray-darkest:${MAG.grayDarkest};
  --surface:#2b2b2b; --border:rgba(186,184,172,.22); --border-strong:rgba(186,184,172,.38);
  --text:#f4f2ee; --text-dim:#a8a5a0;
  --r:4px; --r-lg:8px;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px; --sp-8:32px; --sp-12:48px;
}
*,*::before,*::after{box-sizing:border-box;}
html{-webkit-text-size-adjust:100%;}
body{
  margin:0; background:var(--dark); color:var(--text);
  font-family:${MAG.fontBody}; font-size:16px; line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
a{color:inherit;}
h1,h2,h3{margin:0; font-weight:700; line-height:1.15;}
:focus-visible{outline:2px solid var(--primary); outline-offset:3px; border-radius:2px;}

/* ---- shell ---- */
.wrap{max-width:1080px; margin:0 auto; padding:0 var(--sp-6);}
.topbar{
  border-bottom:1px solid var(--border); background:var(--dark);
  position:sticky; top:0; z-index:40;
}
.topbar .wrap{display:flex; align-items:center; gap:var(--sp-4); min-height:64px;}
.mark{
  font-family:${MAG.fontDisplay}; font-size:19px; letter-spacing:.14em;
  text-transform:uppercase; text-decoration:none; white-space:nowrap;
}
.mark b{color:var(--primary); font-weight:400;}
.topbar .sep{width:1px; align-self:stretch; margin:14px 0; background:var(--border);}
.topbar .ctx{
  font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.topbar .grow{margin-left:auto;}
.topbar .btn{white-space:nowrap;}
/* The region label is repeated in the page heading, so it is the first thing
   to go when the bar gets tight. */
@media (max-width:560px){
  .topbar .ctx,.topbar .sep{display:none;}
}

/* ---- buttons ---- */
.btn{
  display:inline-flex; align-items:center; justify-content:center; gap:var(--sp-2);
  min-height:44px; padding:0 var(--sp-4);
  font-family:inherit; font-size:14px; font-weight:700; letter-spacing:.02em;
  border:1px solid var(--border-strong); border-radius:var(--r);
  background:transparent; color:var(--text); text-decoration:none;
  cursor:pointer; transition:background 180ms ease,color 180ms ease,border-color 180ms ease;
}
.btn svg{width:17px; height:17px; flex:none;}
.btn:hover{background:rgba(186,184,172,.12);}
.btn:active{transform:translateY(1px);}
.btn-primary{background:var(--primary); border-color:var(--primary); color:#fff;}
.btn-primary:hover{background:#ef4109; border-color:#ef4109;}
.btn-sm{min-height:38px; padding:0 var(--sp-3); font-size:13px;}
.btn-sm svg{width:15px; height:15px;}
.btn.is-done{background:var(--secondary); border-color:var(--secondary); color:var(--dark);}
.btn.is-done:hover{background:var(--secondary);}
.btn.is-failed{background:transparent; border-color:var(--primary); color:var(--primary);}

/* ---- signature preview panes ---- */
.pane{border:1px solid var(--border); border-radius:var(--r-lg); overflow:hidden; background:var(--surface);}
.pane-head{
  display:flex; align-items:center; gap:var(--sp-2);
  padding:var(--sp-2) var(--sp-3); border-bottom:1px solid var(--border);
  font-size:11px; letter-spacing:.11em; text-transform:uppercase; color:var(--text-dim);
}
.pane-head svg{width:14px; height:14px; flex:none;}
.pane-body{overflow-x:auto; padding:var(--sp-4) var(--sp-2);}
.pane-body table.so-wrap{margin:0 auto;}
.pane-light .pane-body{background:#fff;}
.pane-dark .pane-body{background:#121212;}
/* Imitates the client-side inversion: black type comes back near-white, black
   fills too, and images are left untouched. Preview only -- these rules live
   in the page, never in the copied markup. */
.pane-dark .pane-body td,
.pane-dark .pane-body div,
.pane-dark .pane-body span,
.pane-dark .pane-body a,
.pane-dark .pane-body p{color:#fff !important;}
.pane-dark .pane-body .so-rule-fill{background-color:#fff !important;}
.note{margin:var(--sp-3) 0 0; font-size:13px; line-height:1.5; color:var(--text-dim);}

.sr-only{
  position:absolute; width:1px; height:1px; padding:0; margin:-1px;
  overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0;
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{transition-duration:.01ms !important; animation-duration:.01ms !important;}
}`;

/** Clipboard + download, shared verbatim by both page types. */
const copyScript = `
/*
 * Rich-HTML copy. navigator.clipboard.write is the correct path but it is not
 * everywhere and it needs a secure context, so a selection-based
 * execCommand("copy") stands behind it -- that one also works from file://,
 * which is how these pages usually get opened.
 */
async function copyRichHtml(html){
  try{
    if(navigator.clipboard && window.ClipboardItem && window.isSecureContext){
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], {type:"text/html"}),
        "text/plain": new Blob([htmlToText(html)], {type:"text/plain"})
      })]);
      return true;
    }
  }catch(e){ /* fall through to the selection path */ }

  var host = document.createElement("div");
  host.setAttribute("contenteditable", "true");
  host.style.cssText = "position:fixed;left:-9999px;top:0;white-space:normal;";
  host.innerHTML = html;
  document.body.appendChild(host);
  try{
    var range = document.createRange();
    range.selectNodeContents(host);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = document.execCommand("copy");
    sel.removeAllRanges();
    return ok;
  }catch(e){
    return false;
  }finally{
    document.body.removeChild(host);
  }
}

function htmlToText(html){
  var d = document.createElement("div");
  d.innerHTML = html;
  return (d.innerText || d.textContent || "").replace(/\\n{3,}/g, "\\n\\n").trim();
}

/* Button feedback in place of an alert(): the label carries the result and an
   aria-live region announces it, so nothing has to be dismissed. */
function flashButton(btn, ok, okLabel){
  if(btn.dataset.busy === "1") return;
  var original = btn.innerHTML;
  btn.dataset.busy = "1";
  btn.classList.add(ok ? "is-done" : "is-failed");
  btn.innerHTML = (ok ? ICON_CHECK : ICON_ALERT) +
    "<span>" + (ok ? (okLabel || "Copied") : "Copy failed") + "</span>";
  announce(ok ? (okLabel || "Signature") + " copied to the clipboard."
             : "Copy failed. Select the signature and copy it by hand.");
  setTimeout(function(){
    btn.innerHTML = original;
    btn.classList.remove("is-done", "is-failed");
    btn.dataset.busy = "0";
  }, 2200);
}

function announce(msg){
  var live = document.getElementById("live");
  if(live) live.textContent = msg;
}

function downloadHtm(html, filename){
  var doc = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>' +
            '<body style="margin:0;">' + html + '</body></html>';
  var url = URL.createObjectURL(new Blob([doc], {type:"text/html"}));
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* Every copy button on the page: data-target is the id of the wrapper whose
   innerHTML is the signature. Image URLs are already absolute, so the markup
   ships as-is. */
document.addEventListener("click", function(ev){
  var btn = ev.target.closest("[data-copy]");
  if(btn){
    var src = document.getElementById(btn.getAttribute("data-copy"));
    if(!src) return;
    copyRichHtml(src.innerHTML).then(function(ok){ flashButton(btn, ok); });
    return;
  }
  var dl = ev.target.closest("[data-download]");
  if(dl){
    var node = document.getElementById(dl.getAttribute("data-download"));
    if(node) downloadHtm(node.innerHTML, dl.getAttribute("data-filename"));
    return;
  }
  /* Plain-text copy of the published page URL, for sending someone their link. */
  /* Plain-text copy of a value shown on the page (the Signatures folder path). */
  var ct = ev.target.closest("[data-copy-text]");
  if(ct){ copyText(ct.getAttribute("data-copy-text")).then(function(ok){ flashButton(ct, ok, "Path copied"); }); return; }
  var lk = ev.target.closest("[data-link]");
  if(lk) copyText(lk.getAttribute("data-link")).then(function(ok){ flashButton(lk, ok, "Link copied"); });
});

async function copyText(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){ /* fall through */ }
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:0;";
  document.body.appendChild(ta);
  ta.select();
  try{ return document.execCommand("copy"); }
  catch(e){ return false; }
  finally{ document.body.removeChild(ta); }
}`;

const iconConsts = `
var ICON_CHECK = ${JSON.stringify(ICON.check)};
var ICON_ALERT = ${JSON.stringify(ICON.alert)};`;

function topbar(context, backHref, extra) {
  return `<header class="topbar">
  <div class="wrap">
    <a class="mark" href="https://magneticcreative.com" target="_blank" rel="noopener">Mag<b>.</b></a>
    <span class="sep" aria-hidden="true"></span>
    <span class="ctx">${context}</span>
    ${backHref ? `<a class="btn btn-sm grow" href="${backHref}">${ICON.back}<span>All signatures</span></a>` : '<span class="grow"></span>'}${extra || ""}
  </div>
</header>`;
}

/* ======================== the per-person page ============================ */

function page(emp) {
  const slug = emp.slug;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(emp.name)} &mdash; SleepOver Email Signature</title>
<meta name="robots" content="noindex">
<style>${fontFaces}${baseCSS}

.hero{padding:var(--sp-12) 0 var(--sp-8);}
.eyebrow{
  display:inline-block; margin-bottom:var(--sp-3);
  font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--secondary);
}
.hero h1{font-family:${MAG.fontDisplay}; font-size:clamp(34px,6vw,56px); font-weight:400; letter-spacing:-.01em;}
.hero .role{margin:var(--sp-3) 0 0; font-size:13px; letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim);}
.hero .mailto{margin:var(--sp-2) 0 0; font-size:15px; color:var(--warm);}

/* The signature is a fixed 594px artifact, so the panes only go side by side
   once each half can actually hold one. Below that they stack full width --
   a scrollbar hiding the right-hand column is no use on a check page. */
.wrap{max-width:1340px;}
.panes{display:grid; gap:var(--sp-4); grid-template-columns:1fr;}
@media (min-width:1360px){ .panes{grid-template-columns:1fr 1fr;} }
.hero p,.note{max-width:76ch;}
.steps,.actions,.recommend{max-width:900px;}

/* The one line everyone must read before installing, so it sits directly
   above the buttons rather than inside the instruction card. */
.recommend{
  margin:var(--sp-8) 0 0; padding:var(--sp-3) var(--sp-4);
  border-left:3px solid var(--primary); background:rgba(213,55,3,.1);
  border-radius:var(--r); font-size:15px; line-height:1.55; color:var(--text);
}
.recommend b{color:var(--light);}

.actions{
  display:flex; flex-wrap:wrap; gap:var(--sp-3); align-items:center;
  margin:var(--sp-4) 0 var(--sp-8); padding:var(--sp-4);
  border:1px solid var(--border); border-radius:var(--r-lg); background:var(--dark-alt);
}
.actions .label{font-size:12px; letter-spacing:.11em; text-transform:uppercase; color:var(--text-dim); margin-right:var(--sp-2);}

/* Instruction card: light surface, because it is the part people read. */
.steps{
  background:var(--light); color:var(--dark); border-radius:var(--r-lg);
  padding:var(--sp-8); margin-bottom:var(--sp-12); line-height:1.65;
}
.steps h2{
  font-size:17px; letter-spacing:.01em; margin:var(--sp-8) 0 var(--sp-4);
  padding-bottom:var(--sp-2); border-bottom:1px solid var(--gray-light);
}
.steps h2:first-child{margin-top:0;}
.steps .steps-mine{margin:0 0 var(--sp-4); font-size:15px;}
.steps h2 .opt{display:inline-block; margin-right:var(--sp-2); padding:2px 10px; border-radius:999px;
  background:var(--primary); color:#fff; font-size:12px; letter-spacing:.08em; text-transform:uppercase; vertical-align:2px;}
.steps .copy-path{display:flex; flex-wrap:wrap; align-items:center; gap:var(--sp-3); margin-top:var(--sp-3);
  padding:var(--sp-3) var(--sp-4); border:1px solid var(--gray-light); border-radius:var(--r-lg); background:var(--light-alt); font-size:15px;}
.steps .copy-path code{font-size:15px; background:#fff;}
.steps .copy-path .btn{color:var(--dark); border-color:#bdbdc2;}
.steps .copy-path .btn:hover{background:var(--gray-light);}
.steps ol.steps-visual{list-style:none; padding:0; display:grid; gap:var(--sp-4);}
.steps ol.steps-visual li{margin:0;}
.steps ol.steps-visual img{display:block; width:100%; height:auto; border:1px solid var(--gray-light); border-radius:var(--r-lg);}
.steps .steps-note{margin:0 0 var(--sp-3); font-size:14px; color:var(--gray-darkest);}
.steps ol{margin:0; padding-left:22px;}
.steps li{margin-bottom:var(--sp-3); font-size:15px;}
.steps li:last-child{margin-bottom:0;}
.steps b{font-weight:700;}
.steps code{
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px;
  background:var(--light-alt); border:1px solid var(--gray-light);
  padding:1px 6px; border-radius:3px; word-break:break-all;
}
@media (max-width:560px){ .steps{padding:var(--sp-6) var(--sp-4);} }
</style>
</head>
<body>
${topbar(esc(emp.region) + " &middot; Email signature", "index.html")}

<main class="wrap">
  <div class="hero">
    <span class="eyebrow">SleepOver ${esc(emp.regionFolder)}</span>
    <h1>${esc(emp.name)}</h1>
    <p class="role">${esc(emp.position)}</p>
    <p class="mailto"><a href="mailto:${attr(emp.email)}">${esc(emp.email)}</a></p>
  </div>

  <!-- The same signature twice. Only #content is what gets copied; #content-2
       is repainted by the .pane-dark rules to imitate the inversion Gmail and
       Outlook run on a light message. -->
  <div class="panes">
    <div class="pane pane-light">
      <div class="pane-head">${ICON.sun}<span>Light &mdash; this is your signature</span></div>
      <div class="pane-body">
${signature(emp, "content", ICON_BASE)}
      </div>
    </div>
    <div class="pane pane-dark">
      <div class="pane-head">${ICON.moon}<span>Dark &mdash; simulated inversion</span></div>
      <div class="pane-body">
${signature(emp, "content-2", ICON_BASE)}
      </div>
    </div>
  </div>
  <p class="note">Gmail and Outlook dark mode invert the black type to white and leave the
     artwork alone. Worth checking on a phone before rollout.</p>

  <!-- Download first: the .htm goes into Outlook untouched, which is how the
       signatures were tested in classic Outlook for Windows. Pasting runs the
       markup through the browser's clipboard and Outlook's editor, which shifts
       the spacing slightly, so it stays only for clients with no Signatures
       folder (Outlook Web, new Outlook, Mac). -->
  <p class="recommend"><b>Recommended:</b> download your signature and install it with the
     steps below. It is the method we tested in Outlook for Windows, and the only one that
     guarantees your signature looks exactly as designed. Copy and paste can change the
     spacing slightly.</p>
  <div class="actions">
    <span class="label">Install</span>
    <button class="btn btn-primary" data-download="content" data-filename="${attr(slug)}.htm">${ICON.download}<span>Download signature (.htm)</span></button>
    <button class="btn" data-copy="content">${ICON.copy}<span>Copy (Outlook Web / Mac only)</span></button>
    <button class="btn" data-link="${attr(emp.pageUrl)}" title="${attr(emp.pageUrl)}">${ICON.link}<span>Copy link to this page</span></button>
  </div>

<div class="steps">
    <h2><span class="opt">Option 1 &middot; recommended</span> Outlook for Windows &mdash; download</h2>
    <!-- The same pictures on every page (guide/, drawn by
         install-guide/step.html with ?generic=1); the person's own file and
         signature name are spelled out here, above them. -->
    <p class="steps-mine">Your file is <code>${esc(slug)}.htm</code>, and in Outlook your
       signature is listed as <b>${esc(slug)}</b>.</p>
    <ol class="steps-visual">
${GUIDE_STEPS.map((alt, i) => `        <li><img src="guide/step-${i + 1}.png" width="1200" height="720" loading="lazy" alt="Step ${i + 1}: ${alt}">${i === 2 ? `
          <div class="copy-path"><span>Paste this into the File Explorer address bar:</span>
            <code>${SIG_FOLDER}</code>
            <button class="btn btn-sm" data-copy-text="${SIG_FOLDER}">${ICON.copy}<span>Copy path</span></button></div>` : ""}</li>`).join("\n")}
    </ol>

    <h2><span class="opt">Option 2</span> Outlook Web, new Outlook and Mac &mdash; paste</h2>
    <p class="steps-note">Only for these apps, which have no signature file to install. On Outlook for Windows, use Option 1.</p>
    <ol class="steps-visual">
${PASTE_STEPS.map((alt, i) => `        <li><img src="guide/paste-step-${i + 1}.png" width="1200" height="720" loading="lazy" alt="Option 2, step ${i + 1}: ${alt}"></li>`).join("\n")}
    </ol>

</div>
</main>

<div id="live" class="sr-only" role="status" aria-live="polite"></div>
<script>${iconConsts}${copyScript}</script>
</body>
</html>`;
}

/* ======================= the master QA index ============================= */

function indexPage() {
  // Where the pages are published. Derived from the people rather than
  // hard-coded twice -- build-data.py owns PAGES_BASE.
  const pagesBase = employees[0].pageUrl.replace(/[^/]+$/, "");

  // Group in sheet order, so the page reads the way the workbook does.
  const regions = [];
  employees.forEach((emp) => {
    let group = regions.find((r) => r.sheet === emp.sheet);
    if (!group) {
      group = { sheet: emp.sheet, folder: emp.regionFolder, id: emp.regionFolder.replace(/\s+/g, "-").toLowerCase(), people: [] };
      regions.push(group);
    }
    group.people.push(emp);
  });

  const nav = regions.map((r) =>
    `<a class="chip" href="#${r.id}" data-chip="${r.id}">${esc(r.folder)}<span data-chip-count>${r.people.length}</span></a>`
  ).join("\n      ");

  const sections = regions.map((r) => `
  <section class="region" id="${r.id}" data-region="${r.id}">
    <div class="region-head">
      <h2>SleepOver ${esc(r.folder)}</h2>
      <span class="count" data-count data-total="${r.people.length}">${r.people.length} ${r.people.length === 1 ? "signature" : "signatures"}</span>
    </div>
    ${r.people.map((emp) => {
      const id = `sig-${emp.slug}`;
      // data-search is what the filter matches on, pre-lowercased.
      const haystack = [emp.name, emp.position, emp.email, emp.regionFolder].join(" ").toLowerCase();
      return `
    <article class="card" data-search="${attr(haystack)}" data-slug="${attr(emp.slug)}">
      <div class="card-head">
        <div class="who">
          <h3>${esc(emp.name)}</h3>
          <p class="role">${esc(emp.position)}</p>
          <p class="mail"><a href="mailto:${attr(emp.email)}">${esc(emp.email)}</a></p>
        </div>
        <div class="card-actions">
          <a class="btn btn-primary btn-sm" href="${attr(emp.slug)}.html">${ICON.external}<span>Open signature page</span></a>
        </div>
      </div>
      <div class="pane-body">
${signature(emp, id, ICON_BASE)}
      </div>
    </article>`;
    }).join("\n")}
  </section>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SleepOver Email Signatures &mdash; Master Check</title>
<meta name="so-source" content="${esc(process.env.SO_SOURCE || "")}">
<meta name="robots" content="noindex">
<style>${fontFaces}${baseCSS}

.hero{padding:var(--sp-12) 0 var(--sp-6);}
.eyebrow{display:inline-block; margin-bottom:var(--sp-3); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--secondary);}
.hero h1{font-family:${MAG.fontDisplay}; font-size:clamp(32px,5.5vw,52px); font-weight:400; letter-spacing:-.01em;}
.hero p{margin:var(--sp-4) 0 0; max-width:62ch; color:var(--text-dim); font-size:15px;}

/* Search + region jump-nav + the light/dark switch all live on one row, so the
   container is wider here than on a person page. */
.wrap{max-width:1240px;}

.toolbar{
  position:sticky; top:64px; z-index:30; background:var(--dark);
  border-bottom:1px solid var(--border); padding:var(--sp-3) 0;
}
.toolbar .wrap{display:flex; align-items:center; gap:var(--sp-2); flex-wrap:wrap;}
.chip{
  display:inline-flex; align-items:center; gap:var(--sp-2);
  min-height:38px; padding:0 var(--sp-3);
  border:1px solid var(--border); border-radius:var(--r);
  font-size:13px; font-weight:700; text-decoration:none; color:var(--text);
  transition:border-color 180ms ease,background 180ms ease;
}
.chip span{
  font-size:11px; font-weight:400; color:var(--dark);
  background:var(--warm); border-radius:9px; padding:1px 7px;
}
.chip:hover{background:rgba(186,184,172,.12); border-color:var(--border-strong);}
.chip[data-empty]{opacity:.35;}
.switch{margin-left:auto;}

/* ---- search ---- */
.search{position:relative; display:flex; align-items:center; margin-right:var(--sp-2);}
.search > svg{
  position:absolute; left:11px; width:16px; height:16px;
  color:var(--text-dim); pointer-events:none;
}
.search input{
  width:220px; height:38px; padding:0 38px 0 34px;
  font-family:inherit; font-size:14px; color:var(--text);
  background:var(--dark-alt); border:1px solid var(--border);
  border-radius:var(--r); transition:border-color 180ms ease;
}
.search input::placeholder{color:var(--text-dim);}
.search input:hover{border-color:var(--border-strong);}
.search input:focus{outline:none; border-color:var(--primary);}
.search input:focus-visible{outline:none;}
/* Safari paints its own clear affordance on type=search; ours is the one that
   also resets the filter, so hide the native one. */
.search input::-webkit-search-cancel-button{-webkit-appearance:none; appearance:none;}
.search .clear{
  position:absolute; right:2px;
  display:flex; align-items:center; justify-content:center;
  width:34px; height:34px; padding:0;
  background:none; border:0; border-radius:var(--r);
  color:var(--text-dim); cursor:pointer;
}
.search .clear svg{width:15px; height:15px;}
.search .clear:hover{color:var(--text); background:rgba(186,184,172,.12);}
@media (max-width:700px){ .search{width:100%; margin-right:0;} .search input{width:100%;} }

.empty{
  margin:var(--sp-12) 0; padding:var(--sp-8);
  border:1px dashed var(--border-strong); border-radius:var(--r-lg);
  text-align:center; color:var(--text-dim); font-size:15px;
}
.empty b{color:var(--text);}
.linkish{
  font:inherit; color:var(--primary); background:none; border:0; padding:0;
  text-decoration:underline; cursor:pointer;
}

/* While a search is active the intro is about the whole set, not the handful
   on screen, so it gets out of the way and the results sit directly under the
   toolbar. */
body.is-filtering .hero{display:none;}
body.is-filtering .region:first-of-type{margin-top:var(--sp-8);}

.region{margin:var(--sp-12) 0;}
.region-head{
  display:flex; align-items:baseline; gap:var(--sp-4);
  padding-bottom:var(--sp-3); margin-bottom:var(--sp-6);
  border-bottom:1px solid var(--border-strong);
}
.region-head h2{font-size:22px; letter-spacing:-.01em;}
.region-head .count{font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);}

.card{
  border:1px solid var(--border); border-radius:var(--r-lg);
  background:var(--surface); overflow:hidden; margin-bottom:var(--sp-4);
}
.card-head{
  display:flex; align-items:flex-start; gap:var(--sp-4); flex-wrap:wrap;
  padding:var(--sp-4); border-bottom:1px solid var(--border);
}
.who{min-width:0;}
.who h3{font-size:17px;}
.who .role{margin:var(--sp-1) 0 0; font-size:11px; letter-spacing:.11em; text-transform:uppercase; color:var(--secondary);}
.who .mail{margin:var(--sp-1) 0 0; font-size:13px; color:var(--text-dim);}
.who .mail a{text-decoration:none;}
.who .mail a:hover{text-decoration:underline;}
.card-actions{margin-left:auto; display:flex; gap:var(--sp-2); flex-wrap:wrap;}

/* Preview theme is switched for every card at once, so 29 signatures can be
   scanned in one pass in either mode. */
.card .pane-body{background:#fff; overflow-x:auto; padding:var(--sp-4) var(--sp-2);}
.card .pane-body table.so-wrap{margin:0 auto;}
body.dark-preview .card .pane-body{background:#121212;}
body.dark-preview .card .pane-body td,
body.dark-preview .card .pane-body div,
body.dark-preview .card .pane-body span,
body.dark-preview .card .pane-body a,
body.dark-preview .card .pane-body p{color:#fff !important;}
body.dark-preview .card .pane-body .so-rule-fill{background-color:#fff !important;}

footer{border-top:1px solid var(--border); padding:var(--sp-8) 0 var(--sp-12); color:var(--text-dim); font-size:13px;}
footer p{margin:0 0 var(--sp-2);}
footer code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12px; color:var(--warm);}
@media (max-width:560px){ .toolbar{position:static;} .card-actions{margin-left:0; width:100%;} }
</style>
</head>
<body>
${topbar("SleepOver &middot; Master check", null, ADMIN_BUTTON)}

<div class="toolbar">
  <div class="wrap">
      <div class="search">
        ${ICON.search}
        <label class="sr-only" for="q">Search signatures by name</label>
        <input id="q" type="search" autocomplete="off" spellcheck="false"
               placeholder="Search by name&hellip;" aria-describedby="q-hint">
        <button type="button" class="clear" id="q-clear" hidden aria-label="Clear search">${ICON.x}</button>
      </div>
      <p id="q-hint" class="sr-only">Also matches job title, email address and region. Press slash to focus, Escape to clear.</p>
      ${nav}
      <button class="btn btn-sm switch" id="theme-toggle" aria-pressed="false">${ICON.moon}<span>Dark preview</span></button>
  </div>
</div>

<main class="wrap">
  <div class="hero">
    <span class="eyebrow">Quality check</span>
    <h1>SleepOver email signatures</h1>
    <p>All ${employees.length} signatures across ${regions.length} regions, rendered from the
       exact markup each person installs. Flip the preview to dark to check the
       inversion. To install a signature, open its page and follow the steps there.</p>
  </div>

${sections}

  <p class="empty" id="empty" hidden>No signature matches <b id="empty-q"></b>.
     Check the spelling, or <button type="button" class="linkish" id="empty-clear">clear the search</button>.</p>
</main>

<footer class="wrap">
  <p>Published at <a href="${attr(pagesBase)}"><code>${esc(pagesBase)}</code></a> &mdash;
     each person's link is that plus their name, e.g.
     <code>${esc(employees[0].slug)}.html</code>.</p>
  <p>Generated from <code>generator/people.json</code> by <code>generator/build.js</code>; every change to it is published automatically.</p>
  <p>Images load from <code>${ICON_BASE}</code>, so this page renders exactly what gets pasted.</p>
</footer>

<div id="live" class="sr-only" role="status" aria-live="polite"></div>
<script>${iconConsts}${copyScript}

/* ---------------------------- name search --------------------------------
   29 cards is more than fits on a screen, so the toolbar filters them in
   place. Every token in the query has to match somewhere in the card's
   data-search string, which means "van horst" finds Ryneveld van der Horst
   without the words having to be adjacent. */
var q = document.getElementById("q");
var qClear = document.getElementById("q-clear");
var cards = Array.prototype.slice.call(document.querySelectorAll(".card[data-search]"));
var sections = Array.prototype.slice.call(document.querySelectorAll(".region[data-region]"));
var chips = Array.prototype.slice.call(document.querySelectorAll("[data-chip]"));
var empty = document.getElementById("empty");
var emptyQ = document.getElementById("empty-q");

function applyFilter(){
  var terms = q.value.toLowerCase().split(/\\s+/).filter(Boolean);
  var total = 0;
  document.body.classList.toggle("is-filtering", terms.length > 0);

  cards.forEach(function(card){
    var hay = card.getAttribute("data-search");
    var hit = terms.every(function(t){ return hay.indexOf(t) !== -1; });
    card.hidden = !hit;
    if(hit) total++;
  });

  // A region with nothing left disappears, and its heading count and nav chip
  // report what is actually showing.
  sections.forEach(function(section){
    var shown = section.querySelectorAll(".card:not([hidden])").length;
    section.hidden = shown === 0;

    var count = section.querySelector("[data-count]");
    var all = Number(count.getAttribute("data-total"));
    count.textContent = terms.length && shown !== all
      ? shown + " of " + all
      : all + (all === 1 ? " signature" : " signatures");

    var chip = chips.filter(function(c){ return c.getAttribute("data-chip") === section.getAttribute("data-region"); })[0];
    if(chip){
      chip.querySelector("[data-chip-count]").textContent = shown;
      if(shown === 0) chip.setAttribute("data-empty", "");
      else chip.removeAttribute("data-empty");
    }
  });

  empty.hidden = total !== 0;
  emptyQ.textContent = q.value.trim();
  qClear.hidden = q.value === "";

  announce(terms.length
    ? total + (total === 1 ? " signature matches " : " signatures match ") + q.value.trim()
    : "Showing all " + total + " signatures.");
}

function clearSearch(){
  q.value = "";
  applyFilter();
  q.focus();
}

q.addEventListener("input", applyFilter);
q.addEventListener("keydown", function(ev){
  if(ev.key === "Escape" && q.value !== ""){ ev.preventDefault(); clearSearch(); }
});
qClear.addEventListener("click", clearSearch);
document.getElementById("empty-clear").addEventListener("click", clearSearch);

/* "/" jumps to the field, the way it does in most list UIs. */
document.addEventListener("keydown", function(ev){
  if(ev.key !== "/" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  var el = document.activeElement;
  if(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  ev.preventDefault();
  q.focus();
  q.select();
});

var toggle = document.getElementById("theme-toggle");
var ICON_SUN = ${JSON.stringify(ICON.sun)};
var ICON_MOON = ${JSON.stringify(ICON.moon)};
toggle.addEventListener("click", function(){
  var dark = document.body.classList.toggle("dark-preview");
  toggle.setAttribute("aria-pressed", String(dark));
  toggle.innerHTML = (dark ? ICON_SUN : ICON_MOON) +
    "<span>" + (dark ? "Light" : "Dark") + " preview</span>";
  announce("Previews switched to " + (dark ? "dark" : "light") + " mode.");
});
</script>
<script src="../generator/admin-boot.js" defer></script>
</body>
</html>`;
}
/* Admin entry point, top right of the index. Does nothing for anyone without
   a GitHub token that can write to this repo; see generator/admin.js. */
const ADMIN_BUTTON = `<button class="btn btn-sm" id="admin-open" type="button" title="Admin" aria-label="Admin settings" style="margin-left:var(--sp-2);min-width:38px;padding:0 10px;opacity:.55;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></button>`;

/* ================================= write ================================== */
fs.mkdirSync(OUT, { recursive: true });
const keep = new Set(["index.html"]);
employees.forEach((emp) => {
  fs.writeFileSync(path.join(OUT, `${emp.slug}.html`), page(emp), "utf8");
  keep.add(`${emp.slug}.html`);
});
fs.writeFileSync(path.join(OUT, "index.html"), indexPage(), "utf8");

// A signature taken out of people.json loses its page. Its images stay in the
// repo and on every earlier tag, so emails already sent are not affected.
const removed = fs.readdirSync(OUT).filter((f) => f.endsWith(".html") && !keep.has(f));
removed.forEach((f) => fs.unlinkSync(path.join(OUT, f)));

console.log(`pages/: ${employees.length} signatures + index.html` +
  (removed.length ? `, removed ${removed.join(", ")}` : "") + ` (images @${cfg.cdnTag})`);
