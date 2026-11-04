/*
 * Loaded by pages/index.html for everyone. Does nothing visible: the admin
 * panel (admin.js) is only fetched when someone clicks the gear in the top bar,
 * or when this browser already holds an admin token from an earlier visit.
 * Anyone can open the settings; only a GitHub token with write access to this
 * repo can change anything, and that is checked by GitHub, not by this page.
 */
(function () {
  "use strict";
  var KEY = "so-admin-token";
  var here = document.currentScript && document.currentScript.src;
  var base = here ? here.replace(/[^/]*$/, "") : "../generator/";
  var loading = null;

  function load(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = base + src + "?v=" + Date.now();   // always the latest admin code
      s.onload = ok;
      s.onerror = function () { fail(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
  }

  function start(openSettings) {
    if (!loading) {
      loading = load("core.js").then(function () { return load("renderer.js"); })
        .then(function () { return load("admin.js"); });
    }
    loading.then(function () { window.SOAdmin.start({ openSettings: openSettings }); })
      .catch(function (e) { console.error(e); });
  }

  function stored() {
    try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch (e) { return null; }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("admin-open");
    if (btn) btn.addEventListener("click", function () { start(true); });
    if (stored()) start(false);
  });
})();
