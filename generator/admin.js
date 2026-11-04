/*
 * Admin panel for pages/index.html: create, edit and delete signatures.
 *
 * How a save works:
 *   1. read the latest generator/people.json from GitHub (never the copy the
 *      page was built from, which can be minutes old)
 *   2. apply the one change to it
 *   3. one commit to main: people.json, plus the PNG when the artwork changed
 *   4. .github/workflows/publish.yml validates, tags new artwork, rebuilds
 *      pages/ and publishes; this panel follows that run until the page is live
 *
 * The token is a GitHub token of the person using the panel, kept in this
 * browser only. GitHub decides what it can do; this file holds no secrets.
 * Artwork is drawn with the font installed on this computer (renderer.js
 * explains why it must never be served from here).
 */
(function () {
"use strict";

const KEY = "so-admin-token";
const API = "https://api.github.com";
const core = window.SOCore, art = window.SOArt;
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = core.esc, attr = core.attr;

const S = {
  token: null, user: null, repo: null, cfg: null,
  people: [], peopleSha: null, headSha: null,
  font: false, started: false
};

/* ------------------------------ token store ------------------------------ */
const store = {
  get() { try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch (e) { return null; } },
  set(t, remember) {
    try {
      localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);
      (remember ? localStorage : sessionStorage).setItem(KEY, t);
    } catch (e) { /* private mode: keep it in memory only */ }
  },
  clear() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {} }
};

/* --------------------------------- GitHub -------------------------------- */
async function gh(path, opts) {
  opts = opts || {};
  const res = await fetch(path.startsWith("http") ? path : API + path, {
    method: opts.method || "GET",
    headers: Object.assign({
      Authorization: "Bearer " + S.token,
      Accept: opts.accept || "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }, opts.body ? { "Content-Type": "application/json" } : {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
    // A request that hangs (GitHub having a bad day) must not freeze the panel.
    signal: AbortSignal.timeout(opts.timeout || 30000)
  }).catch((e) => {
    const err = new Error(e.name === "TimeoutError" ? "GitHub did not answer in time. Try again in a minute." : "Could not reach GitHub: " + e.message);
    err.status = 0; throw err;
  });
  if (!res.ok) {
    let msg = res.status + " " + res.statusText;
    try { const j = await res.json(); if (j.message) msg = j.message + " (" + res.status + ")"; } catch (e) {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  if (opts.raw) return new Uint8Array(await res.arrayBuffer());
  return res.status === 204 ? null : res.json();
}

function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function bytesToB64(bytes) {
  let s = ""; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}
function utf8ToB64(text) { return bytesToB64(new TextEncoder().encode(text)); }

/** The repo this page is served from (owner.github.io/<repo>/...), so the
    same code runs on staging and production; config.json otherwise. */
function detectRepo(fallback) {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  const name = location.pathname.split("/")[1];
  return m && name ? m[1] + "/" + name : fallback;
}

async function loadData() {
  const ref = await gh(`/repos/${S.repo}/git/ref/heads/main`);
  S.headSha = ref.object.sha;
  const [cfgFile, peopleFile] = await Promise.all([
    gh(`/repos/${S.repo}/contents/generator/config.json?ref=${S.headSha}`),
    gh(`/repos/${S.repo}/contents/generator/people.json?ref=${S.headSha}`)
  ]);
  S.cfg = JSON.parse(b64ToUtf8(cfgFile.content));
  S.cfg.repo = S.repo;
  S.people = JSON.parse(b64ToUtf8(peopleFile.content));
  S.peopleSha = peopleFile.sha;
}

const imgCache = {};
/** Bytes of a file at main, through the API: Pages can serve a stale copy for minutes. */
async function repoFile(path) {
  if (!imgCache[path]) imgCache[path] = gh(`/repos/${S.repo}/contents/${encodeURI(path)}?ref=${S.headSha}`, { accept: "application/vnd.github.raw+json", raw: true });
  return imgCache[path];
}

/* ------------------------------- commit flow ------------------------------ */
/**
 * One commit on main. `change(people)` returns the new array (or throws);
 * it is re-applied to the latest people.json if main moved meanwhile.
 * `png` = {path, bytes} when artwork is part of the change.
 */
async function commit(message, change, png) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh(`/repos/${S.repo}/git/ref/heads/main`);
    const head = ref.object.sha;
    const file = await gh(`/repos/${S.repo}/contents/generator/people.json?ref=${head}`);
    const latest = JSON.parse(b64ToUtf8(file.content));
    const next = change(latest);
    const text = JSON.stringify(next, null, 2) + "\n";

    const headCommit = await gh(`/repos/${S.repo}/git/commits/${head}`);
    const tree = [{ path: "generator/people.json", mode: "100644", type: "blob",
      sha: (await gh(`/repos/${S.repo}/git/blobs`, { method: "POST", body: { content: utf8ToB64(text), encoding: "base64" } })).sha }];
    if (png) {
      tree.push({ path: png.path, mode: "100644", type: "blob",
        sha: (await gh(`/repos/${S.repo}/git/blobs`, { method: "POST", body: { content: bytesToB64(png.bytes), encoding: "base64" } })).sha });
    }
    const newTree = await gh(`/repos/${S.repo}/git/trees`, { method: "POST", body: { base_tree: headCommit.tree.sha, tree } });
    const c = await gh(`/repos/${S.repo}/git/commits`, { method: "POST", body: {
      message: message + "\n\nSaved from the admin panel by @" + S.user.login + ".",
      tree: newTree.sha, parents: [head] } });
    try {
      await gh(`/repos/${S.repo}/git/refs/heads/main`, { method: "PATCH", body: { sha: c.sha, force: false } });
    } catch (e) {
      if (e.status === 422 && attempt < 2) continue;   // main moved under us: redo on top of it
      throw e;
    }
    S.people = next; S.headSha = c.sha;
    return c.sha;
  }
}

/** Follows the publish run for `sha` and resolves when the pages are live. */
async function follow(sha, onStep) {
  const started = Date.now(), deadline = started + 15 * 60 * 1000;
  const slow = () => Date.now() - started > 3 * 60 * 1000 ? " GitHub is slow right now; this can take a few more minutes." : "";
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let run = null;
  onStep("publish", "Publishing…");
  while (Date.now() < deadline) {
    try {
      const runs = await gh(`/repos/${S.repo}/actions/runs?head_sha=${sha}&per_page=5`);
      run = runs.workflow_runs.find((r) => r.name === "Publish signatures") || run;
    } catch (e) { if (e.status === 403 || e.status === 404) { onStep("publish", "Saved. Publishing takes about two minutes."); return "unknown"; } }
    if (run && run.status === "completed") break;
    if (slow()) onStep("publish", "Publishing…" + slow());
    await wait(4000);
  }
  if (!run || run.status !== "completed") return "timeout";
  if (run.conclusion !== "success") return { failed: run.html_url };

  onStep("pages", "Updating the website…");
  // Live = the published index carries the commit it was built from (see
  // SO_SOURCE in publish.yml). The Pages API says "built" a minute or two
  // before the new files are actually served, so it is not asked.
  const index = new URL("index.html", location.href);
  while (Date.now() < deadline) {
    try {
      index.search = "?live=" + Date.now();
      const html = await (await fetch(index, { cache: "no-store", signal: AbortSignal.timeout(20000) })).text();
      const m = html.match(/<meta name="so-source" content="([0-9a-f]{40})"/);
      if (m && m[1] === sha) return "live";
      // A later save was built on top of ours: ours is live too.
      if (m && m[1] !== sha) {
        try {
          const cmp = await gh(`/repos/${S.repo}/compare/${sha}...${m[1]}`);
          if (cmp.status === "ahead" || cmp.status === "identical") return "live";
        } catch (e) { /* keep waiting */ }
      }
    } catch (e) { /* keep waiting */ }
    if (slow()) onStep("pages", "Updating the website…" + slow());
    await wait(5000);
  }
  return "timeout";
}

/* ------------------------------------ UI ---------------------------------- */
const STYLE = `
.adm-bar{position:sticky;top:64px;z-index:35;background:#3a1d0f;border-bottom:1px solid var(--primary);}
.adm-bar .wrap{display:flex;align-items:center;gap:var(--sp-3);flex-wrap:wrap;min-height:52px;font-size:14px;}
.adm-bar .tag{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:var(--primary);padding:3px 8px;border-radius:3px;}
.adm-bar .who{color:var(--text-dim);}
.adm-bar .grow{margin-left:auto;}
.adm-bar .font-bad{color:#ffb38f;}
body.adm-on .toolbar{top:116px;}
.card-actions .adm-btn{display:inline-flex;}
.adm-pending{outline:2px solid var(--secondary);}
.adm-dialog{border:1px solid var(--border-strong);border-radius:var(--r-lg);background:var(--dark-alt);color:var(--text);padding:0;max-width:min(1180px,96vw);width:100%;max-height:94vh;}
.adm-dialog[open]{display:flex;flex-direction:column;}
.adm-dialog .adm-body{overflow:auto;flex:1 1 auto;}
.adm-dialog::backdrop{background:rgba(0,0,0,.7);}
.adm-dialog.small{max-width:560px;}
.adm-head{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-4) var(--sp-6);border-bottom:1px solid var(--border);}
.adm-head h2{font-size:19px;}
.adm-head .x{margin-left:auto;}
.adm-body{padding:var(--sp-6);}
.adm-foot{display:flex;gap:var(--sp-3);justify-content:flex-end;align-items:center;flex-wrap:wrap;padding:var(--sp-4) var(--sp-6);border-top:1px solid var(--border);}
.adm-foot .msg{margin-right:auto;font-size:13px;color:var(--text-dim);}
.adm-grid{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:var(--sp-6);}
@media (max-width:900px){.adm-grid{grid-template-columns:1fr;}}
.adm-form label{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);margin:var(--sp-3) 0 4px;}
.adm-form label:first-child{margin-top:0;}
.adm-form label i{text-transform:none;letter-spacing:0;font-style:normal;opacity:.8;}
.adm-form input[type=text],.adm-form input[type=email],.adm-form input[type=password],.adm-form select,.adm-form textarea{
  width:100%;min-height:40px;padding:8px 10px;font:inherit;font-size:14px;color:var(--text);
  background:var(--dark);border:1px solid var(--border-strong);border-radius:var(--r);}
.adm-form textarea{min-height:110px;resize:vertical;line-height:1.45;}
.adm-form input:focus,.adm-form select:focus,.adm-form textarea:focus{outline:none;border-color:var(--primary);}
.adm-form .hint{margin:4px 0 0;font-size:12px;color:var(--text-dim);}
.adm-art{margin-top:var(--sp-4);padding:var(--sp-3);border:1px solid var(--border);border-radius:var(--r-lg);}
.adm-art .opts{display:flex;flex-direction:column;gap:6px;font-size:14px;}
.adm-art .opts label{display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-size:14px;color:var(--text);margin:0;}
.adm-art input[type=file]{margin-top:6px;font-size:13px;}
.adm-preview h3{font-size:12px;letter-spacing:.11em;text-transform:uppercase;color:var(--text-dim);margin:0 0 var(--sp-2);font-weight:400;}
.adm-artbox{background:#fff;border-radius:var(--r-lg);padding:var(--sp-3);margin-bottom:var(--sp-4);overflow:auto;min-height:72px;display:flex;align-items:center;}
.adm-artbox img,.adm-artbox canvas{display:block;max-width:100%;height:auto;}
.adm-preview .pane{margin-bottom:var(--sp-3);}
.adm-errors{margin:0 0 var(--sp-4);padding:var(--sp-3) var(--sp-4);border-left:3px solid var(--primary);background:rgba(213,55,3,.12);border-radius:var(--r);font-size:14px;}
.adm-errors ul{margin:0;padding-left:18px;}
.adm-note{padding:var(--sp-3) var(--sp-4);border-left:3px solid var(--secondary);background:rgba(181,151,86,.12);border-radius:var(--r);font-size:14px;margin:0 0 var(--sp-4);}
.adm-steps{list-style:none;margin:0;padding:0;font-size:15px;}
.adm-steps li{display:flex;gap:10px;align-items:center;padding:6px 0;color:var(--text-dim);}
.adm-steps li.on{color:var(--text);}
.adm-steps li.done{color:var(--text);}
.adm-steps li .dot{width:10px;height:10px;border-radius:50%;background:var(--border-strong);flex:none;}
.adm-steps li.on .dot{background:var(--secondary);animation:admPulse 1s infinite alternate;}
.adm-steps li.done .dot{background:#5fbf75;}
.adm-steps li.bad .dot{background:var(--primary);}
@keyframes admPulse{from{opacity:.4}to{opacity:1}}
.adm-ok{color:#7fd492;} .adm-bad{color:#ff9a76;}
.adm-form code,.adm-body code{font-family:ui-monospace,Menlo,monospace;font-size:12px;background:var(--dark);padding:1px 5px;border-radius:3px;}
.adm-body ol{padding-left:20px;font-size:14px;line-height:1.6;}
`;

function ui(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

function dialog(cls, html) {
  const d = ui(`<dialog class="adm-dialog ${cls || ""}">${html}</dialog>`);
  document.body.appendChild(d);
  d.addEventListener("close", () => d.remove());
  $$("[data-close]", d).forEach((b) => b.addEventListener("click", () => d.close()));
  d.showModal();
  return d;
}

/* ------------------------------ settings ------------------------------ */
function openSettings(reason) {
  const fontLine = S.font
    ? `<span class="adm-ok">Installed: artwork can be generated on this computer.</span>`
    : `<span class="adm-bad">Not found.</span> Install <b>Obviously Narrow Black</b> on this computer and use Chrome or Edge (Safari does not let web pages use installed fonts). Without it you can still edit text and upload artwork made by design.`;
  const d = dialog("small", `
    <div class="adm-head"><h2>Admin settings</h2><button class="btn btn-sm x" data-close type="button" aria-label="Close">${ICONS.x}</button></div>
    <form class="adm-body adm-form" method="dialog">
      ${reason ? `<div class="adm-errors">${esc(reason)}</div>` : ""}
      <p style="margin-top:0;font-size:14px;color:var(--text-dim)">Only people with write access to
        <code>${esc(S.repo || "the signatures repo")}</code> can make changes. Everyone else sees this page as usual.</p>
      <label for="adm-token">GitHub token</label>
      <input id="adm-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_… or ghp_…" value="${attr(S.token || "")}">
      <label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-size:14px;color:var(--text);margin-top:10px">
        <input type="checkbox" id="adm-remember" checked> Remember on this computer</label>
      <p class="hint">Stored in this browser only. Create one at
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Settings → Fine-grained tokens</a>:
        resource owner <b>${esc((S.repo || "magn3tic/x").split("/")[0])}</b>, only the repository <b>${esc((S.repo || "x/sleepover-signature-assets").split("/")[1])}</b>,
        permissions <b>Contents: Read and write</b> and <b>Actions: Read</b>.</p>
      <label>Artwork font</label>
      <p style="margin:0;font-size:14px">${fontLine}</p>
      <p id="adm-test" class="hint" role="status"></p>
    </form>
    <div class="adm-foot">
      ${S.user ? `<button class="btn btn-sm" type="button" id="adm-signout">Sign out</button>` : ""}
      <span class="msg"></span>
      <button class="btn" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="button" id="adm-save">Save and connect</button>
    </div>`);
  const out = $("#adm-test", d);
  $("#adm-save", d).addEventListener("click", async () => {
    const t = $("#adm-token", d).value.trim();
    if (!t) { out.innerHTML = `<span class="adm-bad">Paste a token first.</span>`; return; }
    out.textContent = "Checking with GitHub…";
    const ok = await connect(t, $("#adm-remember", d).checked).catch((e) => { out.innerHTML = `<span class="adm-bad">${esc(e.message)}</span>`; return false; });
    if (ok) d.close();
  });
  const so = $("#adm-signout", d);
  if (so) so.addEventListener("click", () => { store.clear(); location.reload(); });
  setTimeout(() => $("#adm-token", d).focus(), 30);
}

async function connect(token, remember) {
  S.token = token;
  let user;
  try { user = await gh("/user"); }
  catch (e) { throw new Error(e.status === 401 ? "GitHub did not accept that token. Check it was copied whole and has not expired." : "Could not reach GitHub: " + e.message); }
  let repo;
  try { repo = await gh(`/repos/${S.repo}`); }
  catch (e) { throw new Error(`That token cannot see ${S.repo}. Give it access to that repository.`); }
  if (!repo.permissions || !repo.permissions.push) throw new Error(`@${user.login} can see ${S.repo} but cannot change it. Ask for write access to the repository.`);
  S.user = user;
  if (remember !== undefined) store.set(token, remember);
  await loadData();
  enable();
  return true;
}

/* ------------------------------ admin mode ------------------------------ */
const ICONS = {
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
};

function enable() {
  document.body.classList.add("adm-on");
  let bar = $(".adm-bar");
  if (!bar) {
    bar = ui(`<div class="adm-bar"><div class="wrap">
      <span class="tag">Admin</span>
      <span class="who"></span>
      <span class="font"></span>
      <span class="grow"></span>
      <button class="btn btn-sm btn-primary" type="button" id="adm-new">${ICONS.plus}<span>New signature</span></button>
      <button class="btn btn-sm" type="button" id="adm-settings">Settings</button>
    </div></div>`);
    $(".topbar").after(bar);
    $("#adm-new").addEventListener("click", () => openEditor(null));
    $("#adm-settings").addEventListener("click", () => openSettings());
  }
  $(".who", bar).textContent = "Signed in as @" + S.user.login + " · " + S.people.length + " signatures";
  $(".font", bar).innerHTML = S.font ? "" : `<span class="font-bad">Artwork font not installed on this computer</span>`;

  $$(".card[data-slug]").forEach((card) => {
    const actions = $(".card-actions", card);
    if (!actions || $(".adm-btn", actions)) return;
    const slug = card.getAttribute("data-slug");
    const edit = ui(`<button class="btn btn-sm adm-btn" type="button">${ICONS.edit}<span>Edit</span></button>`);
    const del = ui(`<button class="btn btn-sm adm-btn" type="button">${ICONS.trash}<span>Delete</span></button>`);
    edit.addEventListener("click", () => openEditor(slug));
    del.addEventListener("click", () => openDelete(slug));
    actions.prepend(edit); actions.append(del);
  });
}

/* -------------------------------- editor -------------------------------- */
function blankRecord() {
  const first = S.cfg.regions[0].key;
  const like = S.people.find((p) => p.region === first) || {};
  return { slug: "", region: first, name: "", position: "", phone: "", email: "",
    officePhone: like.officePhone || "", website: "sleepover.travel", address: (like.address || []).slice(), nameImage: "" };
}

function openEditor(slug) {
  const orig = slug ? S.people.find((p) => p.slug === slug) : null;
  if (slug && !orig) { alertBox("Not found", `${slug} is not in the latest data. Someone may have deleted it; reload the page.`); return; }
  const rec = JSON.parse(JSON.stringify(orig || blankRecord()));
  const isNew = !orig;
  const regionOpts = S.cfg.regions.map((r) => `<option value="${attr(r.key)}"${r.key === rec.region ? " selected" : ""}>${esc(r.key)}</option>`).join("");
  const d = dialog("", `
    <div class="adm-head"><h2>${isNew ? "New signature" : "Edit " + esc(orig.name)}</h2>
      <button class="btn btn-sm x" data-close type="button" aria-label="Close">${ICONS.x}</button></div>
    <div class="adm-body">
      <div class="adm-errors" hidden></div>
      <div class="adm-grid">
        <form class="adm-form" autocomplete="off" onsubmit="return false">
          <label for="f-region">Region</label><select id="f-region" name="region">${regionOpts}</select>
          <label for="f-name">Full name</label><input id="f-name" name="name" type="text" value="${attr(rec.name)}" placeholder="Jane Doe">
          <p class="hint">The first word is drawn light purple, the rest dark purple.</p>
          <label for="f-position">Position</label><input id="f-position" name="position" type="text" value="${attr(rec.position)}" placeholder="Reservations Manager">
          <label for="f-phone">Mobile <i>(optional, leave empty to hide)</i></label><input id="f-phone" name="phone" type="text" value="${attr(rec.phone)}" placeholder="+27 (0)82 000 0000">
          <label for="f-email">Email</label><input id="f-email" name="email" type="email" value="${attr(rec.email)}">
          <label for="f-office">Office phone <i>(optional)</i></label><input id="f-office" name="officePhone" type="text" value="${attr(rec.officePhone)}">
          <label for="f-web">Website</label><input id="f-web" name="website" type="text" value="${attr(rec.website)}">
          <label for="f-address">Address <i>(one line per row)</i></label><textarea id="f-address" name="address">${esc((rec.address || []).join("\n"))}</textarea>
          <p class="hint">Typed on one line, it is wrapped on its commas for you.</p>

          <div class="adm-art">
            <label>Name artwork</label>
            <div class="opts">
              ${isNew ? "" : `<label><input type="radio" name="artmode" value="keep" checked> Keep the current artwork</label>`}
              <label><input type="radio" name="artmode" value="generate"${isNew ? " checked" : ""}${S.font ? "" : " disabled"}> Generate from name and position${S.font ? "" : " <i>(font not installed)</i>"}</label>
              <label><input type="radio" name="artmode" value="upload"${isNew && !S.font ? " checked" : ""}> Upload a PNG from design</label>
            </div>
            <input type="file" accept="image/png" id="f-file" hidden>
            <p class="hint" id="f-arthint"></p>
          </div>
        </form>
        <div class="adm-preview">
          <h3>Name artwork</h3>
          <div class="adm-artbox" id="p-art"></div>
          <h3>Signature</h3>
          <div class="pane pane-light"><div class="pane-body" id="p-light"></div></div>
          <div class="pane pane-dark"><div class="pane-body" id="p-dark"></div></div>
          <p class="hint" id="p-link"></p>
        </div>
      </div>
    </div>
    <div class="adm-foot">
      <span class="msg">${isNew ? "Publishing creates the page and its link." : "Once published, the person has to install the signature again from their link."}</span>
      <button class="btn" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="button" id="f-save">${isNew ? "Create and publish" : "Save and publish"}</button>
    </div>`);

  const f = $("form", d);
  const errBox = $(".adm-errors", d);
  let upload = null;          // {bytes, url, size} from a picked file
  let generated = null;       // {canvas, url, size}
  let currentArt = null;      // {url, size} of the published artwork
  let artTouched = false;     // the user chose the artwork mode themselves
  let tick = 0;

  const read = () => {
    const v = (n) => f.elements[n].value;
    const r = Object.assign({}, rec, {
      region: v("region"), name: core.tidy(v("name")), position: core.tidy(v("position")).toUpperCase(),
      phone: core.tidy(v("phone")), email: core.tidy(v("email")), officePhone: core.normPhone(v("officePhone")),
      website: core.tidy(v("website")) || "sleepover.travel", address: core.wrapAddress(v("address"))
    });
    if (isNew) {
      const others = S.people.map((p) => p.slug);
      r.slug = r.name ? core.newSlug(r, S.cfg, others) : "";
      r.nameImage = r.slug ? core.nameImagePath(r, S.cfg) : "";
    }
    return r;
  };
  const mode = () => (f.querySelector("input[name=artmode]:checked") || {}).value;

  // Name or position edited: the old artwork is now wrong, so switch to
  // generating it (unless the user already picked a mode).
  ["name", "position"].forEach((n) => f.elements[n].addEventListener("input", () => {
    if (isNew || artTouched) return;
    const r = read();
    const changed = r.name !== orig.name || r.position !== core.tidy(orig.position).toUpperCase();
    const want = changed ? (S.font ? "generate" : "upload") : "keep";
    const radio = f.querySelector(`input[name=artmode][value=${want}]`);
    if (radio && !radio.disabled) radio.checked = true;
  }));
  $$("input[name=artmode]", f).forEach((r) => r.addEventListener("change", () => { artTouched = true; if (mode() === "upload" && !upload) $("#f-file", d).click(); refresh(); }));
  $("#f-file", d).addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    try { upload = { bytes, size: core.pngSize(bytes), url: URL.createObjectURL(file) }; }
    catch (e) { upload = null; showErrors(["That file is not a PNG."]); }
    refresh();
  });
  f.addEventListener("input", () => refresh());

  // A new signature starts with its region's office details; switching region
  // swaps them, unless they were already edited by hand.
  if (isNew) {
    let prefill = { address: rec.address.join("\n"), officePhone: rec.officePhone };
    f.elements.region.addEventListener("change", () => {
      const like = S.people.find((p) => p.region === f.elements.region.value) || {};
      const next = { address: (like.address || []).join("\n"), officePhone: like.officePhone || "" };
      ["address", "officePhone"].forEach((k) => { if (f.elements[k].value === prefill[k]) f.elements[k].value = next[k]; });
      prefill = next;
      refresh();
    });
  }

  function showErrors(list) {
    errBox.hidden = !list.length;
    errBox.innerHTML = list.length ? `<ul>${list.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : "";
  }

  async function artFor(r) {
    const m = mode();
    $("#f-file", d).hidden = m !== "upload";
    const hint = $("#f-arthint", d);
    if (m === "keep") {
      hint.textContent = "";
      if (!currentArt) {
        const bytes = await repoFile(orig.nameImage);
        currentArt = { size: core.pngSize(bytes), url: URL.createObjectURL(new Blob([bytes], { type: "image/png" })) };
      }
      return currentArt;
    }
    if (m === "upload") {
      hint.textContent = upload ? `${upload.size.w}×${upload.size.h}px. Design exports these at the same scale as the others (about 115px tall).` : "Choose a PNG.";
      return upload;
    }
    if (!r.name) { hint.textContent = "Type a name to draw the artwork."; return null; }
    const canvas = art.render(r.name, r.position);
    if (generated && generated.url) URL.revokeObjectURL(generated.url);
    const blob = await art.toPngBlob(canvas);
    generated = { canvas, blob, size: { w: canvas.width, h: canvas.height }, url: URL.createObjectURL(blob) };
    hint.textContent = "Drawn on this computer with the installed font.";
    return generated;
  }

  async function refresh() {
    const my = ++tick;
    const r = read();
    let a;
    try { a = await artFor(r); } catch (e) { a = null; showErrors(["Could not load the current artwork: " + e.message]); }
    if (my !== tick) return;
    const box = $("#p-art", d);
    box.innerHTML = a ? `<img alt="" src="${attr(a.url)}" width="${a.size.w}" height="${a.size.h}">` : `<span style="color:#666;font-size:13px">No artwork yet</span>`;
    const reg = core.region(S.cfg, r.region);
    const logoPath = r.logo || core.regionLogo(S.cfg, reg);
    let logoSize;
    try { logoSize = core.pngSize(await repoFile(logoPath)); } catch (e) { logoSize = { w: 300, h: 72 }; }
    if (my !== tick) return;
    if (a) {
      const emp = core.toEmp(r, S.cfg, { name: a.size, logo: logoSize }, a.url);
      const iconBase = core.cdnBase(S.cfg) + "icons/";
      $("#p-light", d).innerHTML = core.signature(emp, "adm-prev-1", iconBase);
      $("#p-dark", d).innerHTML = core.signature(emp, "adm-prev-2", iconBase);
      $("#p-link", d).innerHTML = r.slug ? `Page: <code>${esc(emp.pageUrl)}</code>${emp.nameImage.scaled ? " · long name, placed a little smaller than the rest" : ""}` : "";
    } else {
      $("#p-light", d).innerHTML = $("#p-dark", d).innerHTML = "";
    }
    if (!errBox.dataset.sticky) showErrors([]);
  }

  $("#f-save", d).addEventListener("click", async () => {
    const r = read();
    const m = mode();
    const errs = core.validate(r, S.cfg, S.people.filter((p) => p.slug !== (orig && orig.slug)));
    if (m === "upload" && !upload) errs.push("Choose the PNG to upload, or pick another artwork option.");
    if (m === "generate" && !S.font) errs.push("The artwork font is not installed on this computer.");
    if (m === "generate" && !r.position) errs.push("Position is required to draw the artwork.");
    if (errs.length) { errBox.dataset.sticky = "1"; showErrors(errs); return; }
    delete errBox.dataset.sticky;

    let png = null;
    if (m === "generate") {
      const g = generated && generated.blob ? generated : await artFor(r);
      png = { path: r.nameImage, bytes: new Uint8Array(await g.blob.arrayBuffer()) };
    } else if (m === "upload") {
      png = { path: r.nameImage, bytes: upload.bytes };
    }
    const before = orig ? JSON.stringify(orig) : null;
    const message = (isNew ? "Add " : "Update ") + r.name + (png ? "" : " (details only)");
    d.close();
    publish(message, (latest) => {
      if (isNew) {
        if (latest.some((p) => p.slug === r.slug)) throw new Error("Someone else just created " + r.slug + ". Reload the page and try again.");
        let at = -1;
        latest.forEach((p, i) => { if (p.region === r.region) at = i; });
        const copy = latest.slice();
        copy.splice(at === -1 ? copy.length : at + 1, 0, r);
        return copy;
      }
      const i = latest.findIndex((p) => p.slug === orig.slug);
      if (i === -1) throw new Error(orig.name + " was deleted by someone else meanwhile.");
      if (JSON.stringify(latest[i]) !== before) throw new Error(orig.name + " was changed by someone else meanwhile. Reload the page and make the change again.");
      const copy = latest.slice(); copy[i] = r; return copy;
    }, png, { name: r.name, slug: r.slug, isNew, art: !!png, pageUrl: core.toEmp(r, S.cfg, { name: { w: 2, h: 2 }, logo: { w: 1, h: 1 } }).pageUrl });
  });

  refresh();
}

/* -------------------------------- delete -------------------------------- */
function openDelete(slug) {
  const rec = S.people.find((p) => p.slug === slug);
  if (!rec) { alertBox("Not found", `${slug} is not in the latest data. Reload the page.`); return; }
  const d = dialog("small", `
    <div class="adm-head"><h2>Delete ${esc(rec.name)}?</h2><button class="btn btn-sm x" data-close type="button" aria-label="Close">${ICONS.x}</button></div>
    <div class="adm-body">
      <p style="margin-top:0">Their signature page (<code>${esc(slug)}.html</code>) is taken down and the link stops working.</p>
      <p>Emails already sent keep their signature: the images stay online. To bring it back later, create it again.</p>
      <label class="adm-form" style="display:block"><span style="font-size:13px;color:var(--text-dim)">Type <b>${esc(rec.name)}</b> to confirm</span>
        <input type="text" id="d-confirm" autocomplete="off" style="width:100%;margin-top:6px;min-height:40px;padding:8px 10px;font:inherit;color:var(--text);background:var(--dark);border:1px solid var(--border-strong);border-radius:var(--r)"></label>
    </div>
    <div class="adm-foot"><button class="btn" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="button" id="d-go" disabled>Delete signature</button></div>`);
  const input = $("#d-confirm", d), go = $("#d-go", d);
  input.addEventListener("input", () => { go.disabled = core.tidy(input.value).toLowerCase() !== core.tidy(rec.name).toLowerCase(); });
  go.addEventListener("click", () => {
    d.close();
    publish("Delete " + rec.name, (latest) => {
      const i = latest.findIndex((p) => p.slug === slug);
      if (i === -1) throw new Error(rec.name + " was already deleted.");
      const copy = latest.slice(); copy.splice(i, 1); return copy;
    }, null, { name: rec.name, slug, deleted: true });
  });
  setTimeout(() => input.focus(), 30);
}

function alertBox(title, text) {
  dialog("small", `<div class="adm-head"><h2>${esc(title)}</h2></div><div class="adm-body"><p style="margin:0">${esc(text)}</p></div>
    <div class="adm-foot"><button class="btn btn-primary" type="button" data-close>OK</button></div>`);
}

/* ------------------------------- publishing ------------------------------- */
async function publish(message, change, png, info) {
  const d = dialog("small", `
    <div class="adm-head"><h2>${esc(message.replace(/ \(details only\)$/, ""))}</h2></div>
    <div class="adm-body">
      <ol class="adm-steps">
        <li data-step="save"><span class="dot"></span><span>Saving to GitHub…</span></li>
        <li data-step="publish"><span class="dot"></span><span>Publishing (validate${png ? ", new image version" : ""}, rebuild pages)</span></li>
        <li data-step="pages"><span class="dot"></span><span>Updating the website</span></li>
      </ol>
      <div id="pub-result" style="margin-top:var(--sp-4)"></div>
    </div>
    <div class="adm-foot"><span class="msg">You can close this; publishing carries on.</span>
      <button class="btn" type="button" id="pub-close">Close</button></div>`);
  $("#pub-close", d).addEventListener("click", () => d.close());
  const step = (name, text, state) => {
    $$(".adm-steps li", d).forEach((li) => {
      const order = ["save", "publish", "pages"];
      const i = order.indexOf(li.dataset.step), j = order.indexOf(name);
      li.classList.toggle("done", i < j || (i === j && state === "done"));
      li.classList.toggle("on", i === j && state !== "done" && state !== "bad");
      li.classList.toggle("bad", i === j && state === "bad");
      if (i === j && text) li.lastElementChild.textContent = text;
    });
  };
  const result = $("#pub-result", d);
  step("save", "Saving to GitHub…");
  let sha;
  try { sha = await commit(message, change, png); }
  catch (e) {
    step("save", "Not saved", "bad");
    result.innerHTML = `<div class="adm-errors">${esc(e.message)}</div>`;
    return;
  }
  step("save", "Saved to GitHub", "done");
  markPending(info.slug);
  const out = await follow(sha, (s, t) => step(s, t));
  if (out === "live") {
    step("pages", "Live", "done");
    const link = info.deleted ? "" : `<p style="margin:0 0 var(--sp-3)"><a class="btn btn-primary btn-sm" href="${attr(info.pageUrl || info.slug + ".html")}?v=${Date.now()}" target="_blank" rel="noopener">Open ${esc(info.name)}'s page</a>
        <button class="btn btn-sm" type="button" data-link="${attr(info.pageUrl || "")}">Copy link</button></p>`;
    result.innerHTML = `${link}
      ${info.deleted ? `<p class="adm-note">${esc(info.name)}'s page has been taken down.</p>` :
        info.isNew ? `<p class="adm-note">Send ${esc(info.name)} the link so they can install the signature.</p>` :
        `<p class="adm-note">Ask ${esc(info.name)} to install the signature again from their link${info.art ? ": the artwork changed" : ""}. Their old one keeps working until then.</p>`}
      <button class="btn btn-sm" type="button" id="pub-reload">Reload this page to see the change</button>`;
    $("#pub-reload", d).addEventListener("click", () => { location.href = location.pathname + "?v=" + Date.now() + location.hash; });
  } else if (out && out.failed) {
    step("publish", "Publishing failed", "bad");
    result.innerHTML = `<div class="adm-errors">The change was saved but not published. <a href="${attr(out.failed)}" target="_blank" rel="noopener">See what went wrong</a>, or ask Gabriel. Nothing on the live pages changed.</div>`;
  } else {
    result.innerHTML = `<p class="adm-note">Saved. Publishing is taking longer than usual; check back in a few minutes.</p>`;
  }
}

function markPending(slug) {
  const card = slug && document.querySelector(`.card[data-slug="${CSS.escape(slug)}"]`);
  if (card) card.classList.add("adm-pending");
}

/* --------------------------------- start --------------------------------- */
async function start(opts) {
  if (!S.started) {
    S.started = true;
    document.head.appendChild(ui(`<style>${STYLE}</style>`));
    let fallback = "magn3tic/sleepover-signature-assets";
    try { fallback = (await (await fetch("../generator/config.json", { cache: "no-store" })).json()).repo || fallback; } catch (e) {}
    S.repo = detectRepo(fallback);
    S.font = await art.fontStatus();
    const saved = store.get();
    if (saved) {
      try { await connect(saved); if (opts && opts.openSettings) openSettings(); return; }
      catch (e) { S.token = null; if (!(opts && opts.openSettings)) return; openSettings(e.message); return; }
    }
  }
  if (opts && opts.openSettings) openSettings();
}

window.SOAdmin = { start, _state: S };
})();
