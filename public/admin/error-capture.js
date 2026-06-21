/* ============================================================
   SC Design Wirral — Admin portal error capture
   Tiny, self-contained, dependency-free. Loaded BEFORE admin.js so
   it also catches admin.js parse/init failures. Mirrors the public
   site's tracker (src/lib/error-report.ts) but compact, and tags every
   report with surface:"admin". Fire-and-forget; never throws.
   ============================================================ */
(function () {
  if (typeof window === "undefined" || window.__scAdminErr) return;
  window.__scAdminErr = true;

  var ENDPOINT = "https://scdesign-wirral.vercel.app/api/sc-error-collect";
  var MAX_CRUMBS = 25;
  var MAX_SENDS = 25;
  var MIN_INTERVAL = 300;

  var crumbs = [];
  var seen = {};
  var totalSent = 0;
  var loadTs = Date.now();
  var queue = [];
  var flushScheduled = false;
  var lastSendAt = 0;

  function crumb(kind, msg) {
    try {
      var m = typeof msg === "string" ? msg : JSON.stringify(msg);
      crumbs.push({ t: Date.now() - loadTs, k: kind, m: String(m || "").slice(0, 240) });
      if (crumbs.length > MAX_CRUMBS) crumbs.shift();
    } catch (e) {}
  }

  function send(body) {
    try {
      var data = JSON.stringify(body);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([data], { type: "text/plain" }));
      } else {
        fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: data,
          keepalive: true,
          mode: "cors",
          credentials: "omit",
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    var wait = Math.max(0, MIN_INTERVAL - (Date.now() - lastSendAt));
    setTimeout(flush, wait);
  }
  function flush() {
    flushScheduled = false;
    var payload = queue.shift();
    if (!payload) return;
    lastSendAt = Date.now();
    send(payload);
    if (queue.length) scheduleFlush();
  }

  function env() {
    var nav = navigator;
    var c = nav.connection;
    return {
      surface: "admin",
      online: nav.onLine,
      connection: c
        ? { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData }
        : undefined,
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: nav.hardwareConcurrency,
      title: document.title,
      visibility: document.visibilityState,
      sinceLoadMs: Date.now() - loadTs,
      breadcrumbs: crumbs.slice(-MAX_CRUMBS),
    };
  }

  function report(r) {
    try {
      var message = (r.message || "").slice(0, 2000);
      var source = r.source || "";
      var sig = r.type + "|" + message + "|" + source + "|" + (r.lineno == null ? "" : r.lineno);
      if (seen[sig]) return;
      if (totalSent >= MAX_SENDS) return;
      seen[sig] = 1;
      totalSent++;

      var props = env();
      if (r.props) for (var k in r.props) props[k] = r.props[k];

      var u;
      try { u = new URL(window.location.href); } catch (e) { u = null; }
      var q = function (k) { return (u && u.searchParams.get(k)) || undefined; };

      queue.push({
        p: window.location.pathname,
        url: window.location.href,
        r: document.referrer || undefined,
        lang: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dpr: window.devicePixelRatio,
        sw: window.screen && window.screen.width,
        sh: window.screen && window.screen.height,
        vw: window.innerWidth,
        vh: window.innerHeight,
        us: q("utm_source"), um: q("utm_medium"), uc: q("utm_campaign"),
        ut: q("utm_term"), uo: q("utm_content"),
        type: r.type,
        severity: r.severity || "error",
        message: message || undefined,
        source: source || undefined,
        lineno: r.lineno == null ? undefined : r.lineno,
        colno: r.colno == null ? undefined : r.colno,
        stack: r.stack ? String(r.stack).slice(0, 8000) : undefined,
        props: props,
      });
      scheduleFlush();
    } catch (e) {}
  }

  function strArg(a) {
    if (a instanceof Error) return a.message;
    if (typeof a === "string") return a;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }
  function argsToStr(args) {
    return Array.prototype.map.call(args, strArg).join(" ").slice(0, 2000);
  }

  // Uncaught errors + resource-load failures.
  window.addEventListener(
    "error",
    function (ev) {
      var target = ev.target;
      if (target && target !== window && target.tagName) {
        var tag = target.tagName.toLowerCase();
        if (["img", "script", "link", "audio", "video", "source", "track"].indexOf(tag) !== -1) {
          var resUrl = target.src || target.href || "";
          report({
            type: "resource_error",
            message: "Failed to load " + tag + (resUrl ? ": " + resUrl : ""),
            source: resUrl,
            props: { resourceUrl: resUrl, tagName: tag },
          });
          return;
        }
      }
      report({
        type: "js_error",
        message: ev.message || "Uncaught error",
        source: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        stack: ev.error && ev.error.stack ? String(ev.error.stack) : undefined,
      });
    },
    true
  );

  // Unhandled promise rejections.
  window.addEventListener("unhandledrejection", function (ev) {
    var reason = ev.reason;
    var message = "Unhandled promise rejection";
    var stack;
    if (reason instanceof Error) { message = reason.message || message; stack = reason.stack; }
    else if (typeof reason === "string") message = reason;
    else if (reason) { try { message = JSON.stringify(reason); } catch (e) { message = String(reason); } }
    report({ type: "unhandled_rejection", message: message, stack: stack });
  });

  // console.error → report + breadcrumb (keeps original behaviour).
  var origError = console.error;
  console.error = function () {
    try {
      var msg = argsToStr(arguments);
      crumb("console.error", msg);
      var errArg;
      for (var i = 0; i < arguments.length; i++) if (arguments[i] instanceof Error) { errArg = arguments[i]; break; }
      report({ type: "console_error", message: msg || "console.error", stack: errArg ? errArg.stack : undefined });
    } catch (e) {}
    return origError.apply(console, arguments);
  };
  var origWarn = console.warn;
  console.warn = function () {
    try { crumb("console.warn", argsToStr(arguments).slice(0, 240)); } catch (e) {}
    return origWarn.apply(console, arguments);
  };

  // Click breadcrumbs.
  document.addEventListener(
    "click",
    function (ev) {
      try {
        var t = ev.target;
        if (!t || !t.closest) return;
        var el = t.closest("a,button,[role=button],input,select,textarea") || t;
        var tag = el.tagName ? el.tagName.toLowerCase() : "?";
        var id = el.id ? "#" + el.id : "";
        var text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
        crumb("click", (tag + id + (text ? ' "' + text + '"' : "")).slice(0, 160));
      } catch (e) {}
    },
    true
  );
})();
