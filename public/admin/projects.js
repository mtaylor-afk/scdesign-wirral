/**
 * SC Design Wirral — admin: the "Projects & portfolio" section.
 *
 * Sean writes a case study here, uploads the photographs, and publishes it.
 * Publishing commits `content/projects/<slug>.json` plus the images into the
 * git repo; Cloudflare Pages rebuilds from that commit, so every case study is
 * a real prerendered page rather than something fetched from a database at
 * runtime. That is why publishing takes a minute or two and why this file never
 * claims a change is already live.
 *
 * WHY THIS IS A SEPARATE FILE rather than another 800 lines of admin.js:
 * admin.js is a read-only analytics client — fetch, render, done. This section
 * holds an editing session with a dirty working copy, staged uploads and
 * destructive actions, and mixing the two would make both harder to follow.
 *
 * It is a classic script (no modules, no bundler), loaded with `defer` BEFORE
 * admin.js so `window.SCProjects` exists by the time admin.js wires its hooks.
 * admin.js runs second, so its top-level `const`s (PROJECTS, PUBLISH, esc,
 * apiPost, showToast …) are only referenced from inside functions here, never
 * at load time.
 *
 * Shape of the contract with admin.js:
 *   window.SCProjects = { title, view(), load(), onClick(e), onChange(e), reset() }
 * onClick/onChange return true when they handled the event.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Vocabularies                                                        *
   * ------------------------------------------------------------------ *
   * These mirror serverlib/cms-vocab.js, which is the source of truth and is
   * what the validator enforces. They are duplicated here because this file is
   * served as a static asset to the browser and cannot `require` it. If a
   * service or area is added there, add it here too — the server will reject
   * anything not on its own list, so the failure is loud rather than silent.
   */
  var SERVICES = [
    ["house-extensions", "House extensions"],
    ["loft-conversions", "Loft conversions"],
    ["residential-design", "Residential design"],
    ["planning-drawings-wirral", "Planning drawings"],
    ["building-regulations-drawings-wirral", "Building regulations drawings"],
    ["garage-conversion-drawings-wirral", "Garage conversion drawings"],
    ["front-porch-extension-design", "Front porch extension design"],
    ["bespoke-garden-room-design", "Bespoke garden room design"],
    ["change-of-use-applications", "Change of use applications"],
    ["measured-building-surveys", "Measured building surveys"],
    ["concept-design-feasibility", "Concept design & feasibility"],
  ];
  var AREAS = [
    ["wallasey", "Wallasey"],
    ["birkenhead", "Birkenhead"],
    ["bebington", "Bebington"],
    ["heswall", "Heswall"],
    ["west-kirby", "West Kirby"],
    ["hoylake", "Hoylake"],
    ["bromborough", "Bromborough"],
    ["new-brighton", "New Brighton"],
    ["moreton", "Moreton"],
    ["upton", "Upton"],
    ["greasby", "Greasby"],
    ["oxton", "Oxton"],
    ["port-sunlight", "Port Sunlight"],
    ["eastham", "Eastham"],
    ["prenton", "Prenton"],
    ["neston", "Neston"],
    ["ellesmere-port", "Ellesmere Port"],
    ["liverpool", "Liverpool"],
    ["chester", "Chester"],
    ["crosby", "Crosby"],
  ];
  var STAGES = [
    ["completed", "Completed"],
    ["under-construction", "Under construction"],
    ["in-planning", "In planning"],
    ["concept", "Concept design"],
  ];
  var KINDS = [
    ["photo", "Photograph"],
    ["drawing", "Drawing"],
    ["render", "Design visualisation"],
  ];
  var MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  var SITE = "https://scdesignwirral.co.uk";
  /** Where an unsaved editing session is mirrored. The admin session is 12
   *  hours with no renewal, so a 401 mid-edit must not cost Sean his typing. */
  var DRAFT_KEY = "sc_admin_project_draft_v1";

  /* ------------------------------------------------------------------ *
   * Module state                                                        *
   * ------------------------------------------------------------------ *
   * The fetched list lives in the shared `state.projects` so reset() can null
   * it like every other slice. Everything to do with the OPEN EDITOR lives
   * here instead, because renderView() (and the topbar Range/Bots controls,
   * and Refresh) wipe the shared slices — and must not wipe Sean's typing.
   */
  var S = {
    filter: "all",
    editing: null, // working copy of the content JSON, or null for the list
    meta: null, // {status, sortOrder, updatedAt, publishedAt, lastPublishSha}
    savedSlug: null, // slug the server has a row for; null = never saved
    isNew: false,
    slugTouched: false, // once Sean edits the slug, stop deriving it from the title
    addKind: "photo", // what the next batch of files is
    dirty: false,
    mediaUrls: {}, // file -> short-lived signed preview URL
    problems: null, // [{field, rule, message}] shown verbatim
    pending: [], // files staged for upload, not yet added
    pendErrors: [],
    redactIdx: null, // which pending item is open for redaction
    redactMode: "pixelate",
    confirm: null, // {mode, slug, where}
    confirmText: "",
    notice: null, // {kind, text, href, label}
    busy: "",
    restored: false,
    loadError: null,
    // When the last publish/unpublish happened, so the editor does not offer a
    // "View the live page" link to a page Cloudflare has not built yet.
    justPublishedAt: 0,
  };

  /** Roughly how long a Cloudflare rebuild takes before the page is there. */
  var REBUILD_MS = 180000;

  /* ------------------------------------------------------------------ *
   * Small helpers                                                       *
   * ------------------------------------------------------------------ *
   * These call through to admin.js's top-level functions lazily, so this file
   * can load first.
   */
  function E(v) { return esc(v); }
  function href(v) { return safeHref(v); }
  function label(pairs, v) {
    for (var i = 0; i < pairs.length; i++) if (pairs[i][0] === v) return pairs[i][1];
    return v || "";
  }
  function opts(pairs, cur) {
    return pairs
      .map(function (p) {
        return '<option value="' + E(p[0]) + '"' + (p[0] === cur ? " selected" : "") + ">" + E(p[1]) + "</option>";
      })
      .join("");
  }
  function kb(n) {
    if (n === null || n === undefined) return "";
    if (n >= 1000000) return (Math.round(n / 100000) / 10).toFixed(1) + " MB";
    return Math.max(1, Math.round(n / 1024)) + " KB";
  }
  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }
  function slugifyLocal(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }
  function currentReviewed() {
    var d = new Date();
    return MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function parseReviewed(s) {
    var m = /^([A-Z][a-z]+)\s+(20\d{2})$/.exec(String(s || ""));
    var d = new Date();
    return {
      month: m && MONTHS.indexOf(m[1]) !== -1 ? m[1] : MONTHS[d.getMonth()],
      year: m ? m[2] : String(d.getFullYear()),
    };
  }
  function yearOpts(cur) {
    var now = new Date().getFullYear();
    var out = [];
    for (var y = 2025; y <= now + 1; y++) out.push([String(y), String(y)]);
    if (!out.some(function (p) { return p[0] === cur; })) out.unshift([cur, cur]);
    return out;
  }
  /** A canvas-produced preview. Never a server-supplied URL — those go
   *  through safeHref() instead, which rejects data: on purpose. */
  function safeDataImg(v) {
    return /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(String(v || "")) ? String(v) : null;
  }
  function liveUrl(slug) { return SITE + "/projects/" + slug + "/"; }

  /* Machine codes are snake_case; anything else the API sends is already a
     sentence written for Sean, so it is shown verbatim. */
  var CODE_TEXT = {
    unauthorized: "Your sign-in has expired. Sign in again.",
    method: "That request was not allowed.",
    origin: "That request was blocked for security reasons.",
    action: "Something went wrong with that action. Try again.",
    confirm: "The web address you typed did not match.",
    not_found: "That project could not be found.",
    save_failed: "Saving failed. Nothing was changed — try again.",
    upload_failed: "That picture could not be uploaded. Try again.",
    publish_failed: "Publishing failed. Nothing on the website was changed — try again.",
    unpublish_failed: "Taking it off the website failed. Try again.",
    delete_failed: "Deleting failed. Try again.",
    reorder_failed: "Saving the new order failed. Try again.",
    path_not_permitted: "Publishing was stopped by a safety check. Nothing was changed.",
  };
  function errText(j) {
    var e = j && j.error ? String(j.error) : "";
    if (!e) return "Something went wrong. Try again.";
    if (/^[a-z0-9_]+$/.test(e)) return CODE_TEXT[e] || "Something went wrong (" + e + ").";
    return e;
  }

  /* ------------------------------------------------------------------ *
   * Requests                                                            *
   * ------------------------------------------------------------------ */
  function get(url) {
    return apiGet(url).then(function (r) {
      if (r.status === 401) { showLogin(); return { halt: true }; }
      return r.json().catch(function () { return {}; }).then(function (j) {
        return { status: r.status, ok: r.ok, json: j || {} };
      });
    });
  }
  function post(url, body) {
    return apiPost(url, body).then(function (r) {
      if (r.status === 401) {
        // The working copy is already mirrored to localStorage, so signing back
        // in and returning here restores it.
        saveLocal();
        showLogin();
        return { halt: true };
      }
      return r.json().catch(function () { return {}; }).then(function (j) {
        return { status: r.status, ok: r.ok, json: j || {} };
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * The working copy                                                    *
   * ------------------------------------------------------------------ */
  function blankProject() {
    return {
      slug: "",
      title: "",
      town: "",
      propertyType: "",
      projectType: "",
      stage: "completed",
      status: "draft",
      summary: "",
      brief: "",
      challenge: "",
      designResponse: "",
      planningRoute: "",
      buildingRegsRoute: "",
      outcome: "",
      drawings: [],
      homeownerPermissionConfirmed: false,
      relatedServices: [],
      relatedAreas: [],
      seoTitle: "",
      metaDescription: "",
      reviewed: currentReviewed(),
      images: [],
      beforeAfter: null,
    };
  }

  /** Fill in anything a stored project is missing, so the form never reads
   *  `undefined` into an input. */
  function intoWorking(p) {
    var b = blankProject();
    var out = {};
    Object.keys(b).forEach(function (k) {
      var v = p && p[k] !== undefined && p[k] !== null ? p[k] : b[k];
      out[k] = v;
    });
    out.drawings = Array.isArray(out.drawings) ? out.drawings.slice() : [];
    out.relatedServices = Array.isArray(out.relatedServices) ? out.relatedServices.slice() : [];
    out.relatedAreas = Array.isArray(out.relatedAreas) ? out.relatedAreas.slice() : [];
    out.images = (Array.isArray(out.images) ? out.images : []).map(function (im) {
      return {
        file: im.file || "",
        kind: im.kind || "photo",
        alt: im.alt || "",
        caption: im.caption || "",
        cover: !!im.cover,
      };
    });
    if (p && p.beforeAfter) {
      out.beforeAfter = {
        label: p.beforeAfter.label || "",
        before: p.beforeAfter.before || "",
        drawing: p.beforeAfter.drawing || "",
        after: p.beforeAfter.after || "",
        aligned: !!p.beforeAfter.aligned,
      };
    } else {
      out.beforeAfter = null;
    }
    return out;
  }

  /**
   * The working copy → exactly what validateProject() accepts.
   * Optional fields are dropped when empty rather than sent as "", so the
   * committed JSON has no empty sections for the site to render.
   */
  function toPayload() {
    var w = S.editing;
    var t = function (v) { return String(v == null ? "" : v).trim(); };
    var p = {
      slug: slugifyLocal(w.slug),
      title: t(w.title),
      town: t(w.town),
      propertyType: t(w.propertyType),
      projectType: t(w.projectType),
      stage: w.stage,
      status: w.status === "published" ? "published" : "draft",
      summary: t(w.summary),
      brief: t(w.brief),
      drawings: w.drawings.map(t).filter(Boolean),
      homeownerPermissionConfirmed: !!w.homeownerPermissionConfirmed,
      relatedServices: w.relatedServices.slice(0, 6),
      relatedAreas: w.relatedAreas.slice(0, 6),
      reviewed: t(w.reviewed),
      images: w.images.map(function (im) {
        var o = { file: im.file, kind: im.kind, alt: t(im.alt) };
        if (t(im.caption)) o.caption = t(im.caption);
        if (im.cover) o.cover = true;
        return o;
      }),
    };
    ["challenge", "designResponse", "planningRoute", "buildingRegsRoute", "outcome", "seoTitle", "metaDescription"].forEach(
      function (k) { if (t(w[k])) p[k] = t(w[k]); }
    );
    if (w.beforeAfter && t(w.beforeAfter.after)) {
      var ba = { label: t(w.beforeAfter.label), after: t(w.beforeAfter.after) };
      if (t(w.beforeAfter.before)) ba.before = t(w.beforeAfter.before);
      if (t(w.beforeAfter.drawing)) ba.drawing = t(w.beforeAfter.drawing);
      if (w.beforeAfter.aligned) ba.aligned = true;
      p.beforeAfter = ba;
    }
    return p;
  }

  /* --- local mirror, so a 401 or a closed tab does not lose the typing --- */
  function saveLocal() {
    if (!S.editing) return;
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          project: S.editing,
          savedSlug: S.savedSlug,
          isNew: S.isNew,
          meta: S.meta,
          at: new Date().toISOString(),
        })
      );
    } catch (e) { /* private mode / blocked storage — the session still works */ }
  }
  function clearLocal() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  function readLocal() {
    try {
      var raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var j = JSON.parse(raw);
      return j && j.project ? j : null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ *
   * Problems (server messages are shown verbatim)                       *
   * ------------------------------------------------------------------ */
  var FIELD_LABELS = {
    slug: "Web address",
    title: "Project title",
    town: "Town or area",
    propertyType: "Type of property",
    projectType: "Type of work",
    stage: "Stage",
    status: "Status",
    summary: "Short summary",
    brief: "The brief",
    challenge: "The challenge",
    designResponse: "The design response",
    planningRoute: "Planning route",
    buildingRegsRoute: "Building regulations",
    outcome: "Outcome",
    drawings: "Drawings list",
    homeownerPermissionConfirmed: "Homeowner's permission",
    relatedServices: "Related services",
    relatedAreas: "Related areas",
    seoTitle: "Google title",
    metaDescription: "Google description",
    reviewed: "Last checked",
    images: "Pictures",
    "beforeAfter.label": "Before / after heading",
    "beforeAfter.before": "Before / after — before picture",
    "beforeAfter.drawing": "Before / after — drawing",
    "beforeAfter.after": "Before / after — after picture",
    "(root)": "This project",
  };
  function fieldLabel(f) {
    if (FIELD_LABELS[f]) return FIELD_LABELS[f];
    var m = /^images\[(\d+)\]\.(\w+)$/.exec(String(f || ""));
    if (m) {
      var which = { alt: "alt text", caption: "caption", kind: "type", file: "filename" }[m[2]] || m[2];
      return "Picture " + (Number(m[1]) + 1) + " — " + which;
    }
    var d = /^drawings\[(\d+)\]$/.exec(String(f || ""));
    if (d) return "Drawing " + (Number(d[1]) + 1);
    return String(f || "This project");
  }
  function probsFor(field) {
    if (!S.problems) return [];
    return S.problems.filter(function (p) { return p.field === field; });
  }
  function inlineErr(field) {
    var list = probsFor(field);
    if (!list.length) return "";
    return list
      .map(function (p) { return '<div class="prj-err">' + E(p.message) + "</div>"; })
      .join("");
  }
  function badCls(field) { return probsFor(field).length ? " prj-bad" : ""; }

  function problemsBlock() {
    if (!S.problems || !S.problems.length) return "";
    var rows = S.problems
      .map(function (p) {
        return '<div class="errf"><dt>' + E(fieldLabel(p.field)) + "</dt><dd>" + E(p.message) + "</dd></div>";
      })
      .join("");
    return (
      '<div class="card prj-problems" id="prjProblems">' +
      "<h3>" + S.problems.length + (S.problems.length === 1 ? " thing needs" : " things need") + " fixing</h3>" +
      '<div class="csub">Nothing has been changed on the website. Fix these and try again.</div>' +
      '<dl class="errdl">' + rows + "</dl></div>"
    );
  }

  /** Checks the server cannot make for us, or that save a pointless round trip. */
  function preSaveProblems() {
    var w = S.editing, out = [];
    if (!slugifyLocal(w.slug)) out.push({ field: "slug", rule: "local", message: "Give the project a web address (it is filled in from the title)." });
    if (w.beforeAfter && !String(w.beforeAfter.after || "").trim())
      out.push({ field: "beforeAfter.after", rule: "local", message: 'Choose the "after" picture, or switch the before / after comparison off.' });
    return out;
  }
  function prePublishProblems() {
    var w = S.editing, out = preSaveProblems();
    if (!w.homeownerPermissionConfirmed)
      out.push({
        field: "homeownerPermissionConfirmed",
        rule: "local",
        message: "Tick the box to confirm the homeowner has agreed to their project appearing on the website.",
      });
    if (!w.images.length) out.push({ field: "images", rule: "local", message: "Add at least one picture before publishing." });
    var covers = w.images.filter(function (im) { return im.cover; });
    if (w.images.length && covers.length !== 1)
      out.push({ field: "images", rule: "local", message: "Pick exactly one cover picture (currently " + covers.length + ")." });
    w.images.forEach(function (im, i) {
      if (String(im.alt || "").trim().length < 10)
        out.push({ field: "images[" + i + "].alt", rule: "local", message: "Describe this picture in a few words so screen readers and Google can understand it." });
    });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Rendering — the list                                                *
   * ------------------------------------------------------------------ */
  function statusPill(status) {
    return status === "published"
      ? '<span class="pill green">On the website</span>'
      : '<span class="pill grey">Draft</span>';
  }

  function projectRow(p, i) {
    var rows = state.projects && state.projects.rows ? state.projects.rows : [];
    var open = S.confirm && S.confirm.where === "list" && S.confirm.slug === p.slug;
    var main =
      '<tr class="prjrow">' +
      '<td class="prj-ord">' +
      '<button class="prj-arrow" data-projup="' + E(p.slug) + '"' + (i === 0 ? " disabled" : "") + ' title="Move up" aria-label="Move up">↑</button>' +
      '<button class="prj-arrow" data-projdown="' + E(p.slug) + '"' + (i >= rows.length - 1 ? " disabled" : "") + ' title="Move down" aria-label="Move down">↓</button>' +
      "</td>" +
      "<td><button class=\"prj-linkbtn\" data-projedit=\"" + E(p.slug) + '">' + E(p.title || p.slug) + "</button>" +
      '<div class="prj-rowsub">/projects/' + E(p.slug) + "/</div>" +
      /* Shown only on narrow screens, where the Status column is hidden so the
         title has room to read as a title rather than one word per line. */
      '<div class="prj-rowstatus">' + statusPill(p.status) + "</div></td>" +
      "<td>" + E(p.town || "—") + "</td>" +
      "<td>" + E(label(STAGES, p.stage)) + "</td>" +
      "<td>" + statusPill(p.status) + "</td>" +
      '<td class="num">' + fmt(p.imageCount || 0) + "</td>" +
      '<td class="prj-when">' + E(p.updatedAt ? fmtDateTime(p.updatedAt) : "—") + "</td>" +
      '<td class="prj-rowacts">' +
      '<button class="btn btn-ghost prj-sm" data-projedit="' + E(p.slug) + '">Edit</button>' +
      '<button class="btn btn-ghost prj-sm" data-projtoggle="' + E(p.slug) + '">' + (open ? "Close" : "Remove…") + "</button>" +
      "</td></tr>";
    if (!open) return main;
    return main + '<tr class="prj-confirmrow"><td colspan="8">' + confirmPanel(p.slug, p.status, p.title) + "</td></tr>";
  }

  function viewProjects() {
    var d = state.projects;
    var callout =
      '<div class="callout"><strong>Your case studies.</strong> Write a project up here and it becomes its own page on the website at ' +
      "<code>/projects/…/</code>. Nothing appears publicly until you press <strong>Publish</strong>, and the website then " +
      "<strong>rebuilds itself — which takes a minute or two</strong>. You can take a page back off the site at any time, " +
      "or delete a project completely if it turns out not to be suitable.</div>";
    if (S.loadError) {
      return callout + '<div class="card"><div class="empty">' + E(S.loadError) + '</div><div style="margin-top:12px">' +
        '<button class="btn" data-projreload>Try again</button></div></div>';
    }
    if (!d) return callout + loader();

    var rows = d.rows || [];
    var pub = rows.filter(function (r) { return r.status === "published"; }).length;
    var list = rows;
    if (S.filter === "published") list = rows.filter(function (r) { return r.status === "published"; });
    else if (S.filter === "draft") list = rows.filter(function (r) { return r.status !== "published"; });

    var chip = function (id, text) {
      return '<button class="jchip ' + (S.filter === id ? "active" : "") + '" data-projfilter="' + id + '">' + E(text) + "</button>";
    };
    var body = list.length
      ? list.map(function (p, i) { return projectRow(p, S.filter === "all" ? i : rows.indexOf(p)); }).join("")
      : '<tr><td colspan="8" class="empty">' +
        (rows.length ? "No projects match this filter." : "No projects yet. Press “Add a project” to write your first case study.") +
        "</td></tr>";

    return (
      callout +
      noticeBlock() +
      '<div class="grid kpis">' +
      kpi("Projects", fmt(rows.length), "in total") +
      kpi("On the website", fmt(pub), "live pages") +
      kpi("Drafts", fmt(rows.length - pub), "not published yet") +
      "</div>" +
      '<div class="prj-listtop">' +
      '<div class="jfilters" style="margin:0">' + chip("all", "All") + chip("published", "On the website") + chip("draft", "Drafts") + "</div>" +
      '<button class="btn" data-projnew>＋ Add a project</button>' +
      "</div>" +
      '<div class="card"><table class="tbl prjtbl">' +
      "<thead><tr><th>Order</th><th>Project</th><th>Town</th><th>Stage</th><th>Status</th>" +
      '<th class="num">Pictures</th><th>Last edited</th><th></th></tr></thead>' +
      "<tbody>" + body + "</tbody></table>" +
      '<div class="csub" style="margin-top:14px">The order above is the order the projects appear on the website’s ' +
      "portfolio page. On a computer, use the arrows to change it — it saves straight away.</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------ *
   * Rendering — shared bits                                             *
   * ------------------------------------------------------------------ */
  function noticeBlock() {
    if (!S.notice) return "";
    var n = S.notice;
    var link = "";
    var h = n.href ? href(n.href) : null;
    if (h) link = ' <a href="' + E(h) + '" target="_blank" rel="noopener noreferrer">' + E(n.label || "Open") + "</a>";
    return (
      '<div class="prj-notice prj-notice-' + (n.kind === "warn" ? "warn" : "ok") + '">' +
      "<div>" + E(n.text) + link + "</div>" +
      '<button class="prj-noticex" data-projnoticex aria-label="Dismiss">✕</button></div>'
    );
  }

  /**
   * The two-step confirm. No modal, no window.confirm — the row or the panel
   * expands and says in plain English what is about to happen, which is how the
   * rest of this admin behaves.
   */
  function confirmPanel(slug, status, title) {
    var c = S.confirm || {};
    var published = status === "published";
    var name = title || slug;
    if (c.mode === "leave") {
      return (
        '<div class="prj-confirm">' +
        "<h4>You have changes that are not saved</h4>" +
        "<p>Leaving now will lose what you have typed since the last save.</p>" +
        '<div class="prj-confirmacts">' +
        '<button class="btn" data-projconfirmgo="savego">Save the draft, then go back</button>' +
        '<button class="btn btn-danger" data-projconfirmgo="discard">Discard my changes</button>' +
        '<button class="btn btn-ghost" data-projconfirmcancel>Keep editing</button>' +
        "</div></div>"
      );
    }
    if (c.mode === "delete") {
      var typed = S.confirmText === slug;
      return (
        '<div class="prj-confirm prj-confirm-danger">' +
        "<h4>Delete “" + E(name) + "” completely</h4>" +
        "<p>This removes the project altogether: the page comes off the website, the pictures you uploaded are deleted, " +
        "and the draft is gone. <strong>It cannot be undone.</strong>" +
        (published ? " The old web address will redirect visitors to the projects page." : "") +
        "</p>" +
        "<p>If you only want it off the website but want to keep working on it, use <strong>Take off the website</strong> instead.</p>" +
        '<label class="prj-conflabel" for="prjConfirmSlug">Type <code>' + E(slug) + "</code> to confirm</label>" +
        '<input id="prjConfirmSlug" class="prj-confinput" type="text" data-projconfirmtext value="' + E(S.confirmText) + '" ' +
        'autocomplete="off" spellcheck="false" placeholder="' + E(slug) + '" />' +
        '<div class="prj-confirmacts">' +
        '<button class="btn btn-danger" data-projconfirmgo="delete"' + (typed ? "" : " disabled") + ">Yes, delete it completely</button>" +
        '<button class="btn btn-ghost" data-projconfirmcancel>Cancel</button>' +
        "</div>" +
        (published ? '<div class="prj-confnote">Removing it takes a minute or two to show on the website, because the site rebuilds itself.</div>' : "") +
        "</div>"
      );
    }
    if (c.mode === "unpublish") {
      return (
        '<div class="prj-confirm">' +
        "<h4>Take “" + E(name) + "” off the website</h4>" +
        "<p>The page stops being on the website, and its old web address will redirect visitors to the projects page. " +
        "<strong>Your draft and your pictures are kept</strong>, so you can change it and publish it again whenever you like.</p>" +
        '<div class="prj-confirmacts">' +
        '<button class="btn btn-danger" data-projconfirmgo="unpublish">Yes, remove it from the website</button>' +
        '<button class="btn btn-ghost" data-projconfirmcancel>Cancel</button>' +
        "</div>" +
        '<div class="prj-confnote">It takes a minute or two to disappear, because the website rebuilds itself.</div>' +
        "</div>"
      );
    }
    // The chooser shown from a list row.
    return (
      '<div class="prj-confirm">' +
      "<h4>Remove “" + E(name) + "”</h4>" +
      "<p><strong>Take it off the website</strong> — the page comes down, but the draft and the pictures stay here so you can fix it and publish again.<br />" +
      "<strong>Delete it completely</strong> — everything goes, including the pictures. This cannot be undone.</p>" +
      '<div class="prj-confirmacts">' +
      (published ? '<button class="btn btn-danger" data-projunpublish="' + E(slug) + '">Take it off the website</button>' : "") +
      '<button class="btn btn-danger" data-projdelete="' + E(slug) + '">Delete it completely</button>' +
      '<button class="btn btn-ghost" data-projconfirmcancel>Cancel</button>' +
      "</div></div>"
    );
  }

  /* ------------------------------------------------------------------ *
   * Rendering — the editor                                              *
   * ------------------------------------------------------------------ */
  function tf(field, labelText, o) {
    o = o || {};
    var v = S.editing[field] == null ? "" : String(S.editing[field]);
    var max = o.max ? ' maxlength="' + o.max + '"' : "";
    return (
      '<div class="prj-field' + badCls(field) + '">' +
      "<label for=\"prjf-" + field + '">' + E(labelText) + (o.req ? ' <span class="prj-req">needed</span>' : "") + "</label>" +
      '<input id="prjf-' + field + '" type="text" data-f="' + field + '" value="' + E(v) + '"' + max +
      (o.ph ? ' placeholder="' + E(o.ph) + '"' : "") + (o.ro ? " readonly" : "") + " />" +
      (o.help ? '<div class="prj-help">' + o.help + "</div>" : "") +
      inlineErr(field) +
      "</div>"
    );
  }
  function ta(field, labelText, o) {
    o = o || {};
    // `drawings` is a list in the JSON but one-per-line in the box.
    var raw = S.editing[field];
    var v = Array.isArray(raw) ? raw.join("\n") : raw == null ? "" : String(raw);
    var count = o.max
      ? '<span class="prj-count" id="prjcount-' + field + '" data-max="' + o.max + '">' + v.length + " / " + o.max + "</span>"
      : "";
    return (
      '<div class="prj-field' + badCls(field) + '">' +
      "<label for=\"prjf-" + field + '">' + E(labelText) + (o.req ? ' <span class="prj-req">needed</span>' : "") + count + "</label>" +
      '<textarea id="prjf-' + field + '" data-f="' + field + '" rows="' + (o.rows || 4) + '"' +
      (o.max ? ' maxlength="' + o.max + '"' : "") + (o.ph ? ' placeholder="' + E(o.ph) + '"' : "") + ">" + E(v) + "</textarea>" +
      (o.help ? '<div class="prj-help">' + o.help + "</div>" : "") +
      inlineErr(field) +
      "</div>"
    );
  }

  function chipPicker(field, pairs, labelText, help) {
    var chosen = S.editing[field] || [];
    var remaining = pairs.filter(function (p) { return chosen.indexOf(p[0]) === -1; });
    var full = chosen.length >= 6;
    var picked = chosen.length
      ? chosen
          .map(function (v) {
            return (
              '<span class="prj-chip">' + E(label(pairs, v)) +
              '<button class="prj-chipx" data-projrm="' + field + ":" + E(v) + '" aria-label="Remove ' + E(label(pairs, v)) + '">✕</button></span>'
            );
          })
          .join("")
      : '<span class="prj-none">None chosen yet.</span>';
    return (
      '<div class="prj-field' + badCls(field) + '">' +
      "<label>" + E(labelText) + "</label>" +
      '<div class="prj-chips">' + picked + "</div>" +
      '<select data-projadd="' + field + '" aria-label="' + E(labelText) + '"' + (full || !remaining.length ? " disabled" : "") + ">" +
      '<option value="">' + (full ? "Six is the maximum" : remaining.length ? "Add…" : "All added") + "</option>" +
      opts(remaining, "") +
      "</select>" +
      (help ? '<div class="prj-help">' + help + "</div>" : "") +
      inlineErr(field) +
      "</div>"
    );
  }

  function imageOptions(cur, allowBlank) {
    var pairs = S.editing.images.map(function (im) { return [im.file, im.file]; });
    return (allowBlank ? '<option value="">Not used</option>' : "") + opts(pairs, cur);
  }

  function imageCard(im, i) {
    var url = S.mediaUrls[im.file] ? href(S.mediaUrls[im.file]) : null;
    var thumb = url
      ? '<img src="' + E(url) + '" alt="" loading="lazy" />'
      : '<div class="prj-nothumb">preview<br />unavailable</div>';
    var rm = S.confirm && S.confirm.mode === "imgrm" && S.confirm.slug === im.file;
    return (
      '<div class="prj-img' + (im.cover ? " is-cover" : "") + '">' +
      '<div class="prj-imgthumb">' + thumb + (im.cover ? '<span class="prj-coverflag">Cover</span>' : "") + "</div>" +
      '<div class="prj-imgbody">' +
      '<div class="prj-imgname"><code>' + E(im.file) + "</code></div>" +
      '<div class="prj-field"><label for="prjk-' + i + '">What is this picture?</label>' +
      '<select id="prjk-' + i + '" data-imgf="kind" data-i="' + i + '">' + opts(KINDS, im.kind) + "</select></div>" +
      '<div class="prj-field' + badCls("images[" + i + "].alt") + '">' +
      '<label for="prja-' + i + '">Describe the picture <span class="prj-req">needed</span></label>' +
      '<input id="prja-' + i + '" type="text" maxlength="300" data-imgf="alt" data-i="' + i + '" value="' + E(im.alt) + '" ' +
      'placeholder="e.g. Rear of a 1930s semi with a single-storey glazed extension" />' +
      '<div class="prj-help">This is read aloud to anyone using a screen reader, and Google uses it too. ' +
      "Say what is in the picture in a short sentence — not “photo 1”.</div>" +
      inlineErr("images[" + i + "].alt") +
      "</div>" +
      '<div class="prj-field' + badCls("images[" + i + "].caption") + '">' +
      '<label for="prjc-' + i + '">Caption shown under the picture (optional)</label>' +
      '<input id="prjc-' + i + '" type="text" maxlength="300" data-imgf="caption" data-i="' + i + '" value="' + E(im.caption) + '" />' +
      inlineErr("images[" + i + "].caption") +
      "</div>" +
      '<div class="prj-imgfoot">' +
      '<label class="prj-check"><input type="radio" name="prjcover" data-imgf="cover" data-i="' + i + '"' +
      (im.cover ? " checked" : "") + " /> Use as the cover picture</label>" +
      '<span class="prj-imgacts">' +
      '<button class="prj-arrow" data-projimgup="' + i + '"' + (i === 0 ? " disabled" : "") + ' title="Move up" aria-label="Move up">↑</button>' +
      '<button class="prj-arrow" data-projimgdown="' + i + '"' + (i >= S.editing.images.length - 1 ? " disabled" : "") + ' title="Move down" aria-label="Move down">↓</button>' +
      '<button class="btn btn-ghost prj-sm" data-projimgrm="' + E(im.file) + '">Remove</button>' +
      "</span></div>" +
      (rm
        ? '<div class="prj-confirm prj-confirm-inline"><p>Remove <code>' + E(im.file) +
          "</code> from this project? The file is deleted from storage. If the project is on the website it stays there until you publish again.</p>" +
          '<div class="prj-confirmacts">' +
          '<button class="btn btn-danger prj-sm" data-projconfirmgo="imgrm">Yes, remove it</button>' +
          '<button class="btn btn-ghost prj-sm" data-projconfirmcancel>Cancel</button></div></div>'
        : "") +
      "</div></div>"
    );
  }

  function pendingBlock() {
    if (!S.pending.length && !S.pendErrors.length) return "";
    var errs = S.pendErrors.length
      ? '<div class="prj-errbox">' + S.pendErrors.map(function (t) { return "<div>" + E(t) + "</div>"; }).join("") + "</div>"
      : "";
    if (!S.pending.length) return '<div class="prj-pend">' + errs + "</div>";
    var items = S.pending
      .map(function (p, i) {
        var t = safeDataImg(p.thumb);
        var open = S.redactIdx === i;
        return (
          '<div class="prj-penditem">' +
          '<div class="prj-pendthumb">' + (t ? '<img src="' + E(t) + '" alt="" />' : "") + "</div>" +
          '<div class="prj-pendbody">' +
          "<div><code>" + E(p.name) + "</code></div>" +
          '<div class="prj-help">' + E(label(KINDS, p.kind)) + " · " + E(p.w + "×" + p.h) + " · " + E(kb(p.bytes)) +
          // Say "hidden" only when the preview actually carries the redaction.
          // Boxes drawn but not yet applied are described as "marked", because
          // claiming a house number is hidden when the picture still shows it is
          // the one thing this must never do. (Uploading applies them anyway —
          // see addPending — so this is about not lying in the meantime.)
          (p.boxes.length
            ? " · " +
              p.boxes.length +
              (p.boxes.length === 1 ? " area " : " areas ") +
              (JSON.stringify(p.boxes) === (p.applied || "[]") ? "hidden" : "marked, not yet applied")
            : "") +
          "</div>" +
          '<div class="prj-pendacts">' +
          '<button class="btn btn-ghost prj-sm" data-projredact="' + i + '">' + (open ? "Done hiding" : "Hide something out ▸") + "</button>" +
          (p.boxes.length ? '<button class="btn btn-ghost prj-sm" data-projredactclear="' + i + '">Undo hiding</button>' : "") +
          '<button class="btn btn-ghost prj-sm" data-projpendrm="' + i + '">Don’t add this one</button>' +
          "</div>" +
          (open ? redactPanel(p) : "") +
          "</div></div>"
        );
      })
      .join("");
    return (
      '<div class="prj-pend">' +
      "<h4>Check these before they go in</h4>" +
      '<div class="prj-help">Nothing has been uploaded yet. Photographs are already resized and stripped of location data on ' +
      "this computer — and if a house number, a car registration or a name board is visible, you can hide it here so the " +
      "original never leaves the machine.</div>" +
      errs +
      items +
      '<div class="prj-pendfoot">' +
      '<button class="btn" data-projpendadd' + (S.busy ? " disabled" : "") + ">" +
      (S.busy === "upload" ? "Adding…" : "Add " + (S.pending.length === 1 ? "this picture" : "these " + S.pending.length + " pictures")) +
      "</button>" +
      '<button class="btn btn-ghost" data-projpendclear>Clear</button>' +
      "</div></div>"
    );
  }

  function redactPanel(p) {
    var img = safeDataImg(p.preview);
    if (!img) return "";
    var boxes = p.boxes
      .map(function (b) {
        return (
          '<div class="prj-redbox' + (b.mode === "solid" ? " is-solid" : "") + '" style="left:' + (b.x * 100).toFixed(2) +
          "%;top:" + (b.y * 100).toFixed(2) + "%;width:" + (b.w * 100).toFixed(2) + "%;height:" + (b.h * 100).toFixed(2) + '%"></div>'
        );
      })
      .join("");
    return (
      '<div class="prj-redwrap">' +
      '<div class="prj-help"><strong>Optional.</strong> Drag a box over anything that should not be identifiable — a house ' +
      "number, a car registration, a name on a van. Choose “Blur” to destroy the detail, or “White out” to cover it " +
      "completely. Then press <strong>Apply</strong> and the picture is re-made with those areas hidden.</div>" +
      '<div class="seg prj-redmode">' +
      '<button data-projredactmode="pixelate" class="' + (S.redactMode === "pixelate" ? "active" : "") + '">Blur</button>' +
      '<button data-projredactmode="solid" class="' + (S.redactMode === "solid" ? "active" : "") + '">White out</button>' +
      "</div>" +
      '<div class="prj-redsurface" id="prjRedact">' +
      '<img src="' + E(img) + '" alt="" draggable="false" />' +
      boxes +
      '<div class="prj-redlive" hidden></div>' +
      "</div>" +
      '<div class="prj-pendacts">' +
      '<button class="btn prj-sm" data-projredactapply>' + (S.busy === "redact" ? "Applying…" : "Apply to the picture") + "</button>" +
      '<button class="btn btn-ghost prj-sm" data-projredactclear="' + S.redactIdx + '">Start again</button>' +
      "</div></div>"
    );
  }

  function imagesSection() {
    var locked = !S.savedSlug;
    var add = locked
      ? '<div class="prj-lock">Save the draft first. Pictures are filed under the project’s web address, so it has to exist before they can be uploaded.</div>'
      : '<div class="prj-addrow">' +
        '<div class="prj-field"><label for="prjKind">These files are</label>' +
        '<select id="prjKind" data-projkind>' + opts(KINDS, S.addKind || "photo") + "</select></div>" +
        // The input is nested rather than paired with `for=`, because a label
        // that does both can fire the picker twice.
        '<label class="prj-drop" id="prjDrop">' +
        "<span><strong>Drop photographs here</strong> or click to choose them</span>" +
        '<span class="prj-help">JPEG or PNG. Straight off a phone is fine — they are resized here before upload.</span>' +
        '<input id="prjFiles" type="file" accept="image/jpeg,image/png" multiple data-projfiles />' +
        "</label></div>";
    var cards = S.editing.images.length
      ? S.editing.images.map(imageCard).join("")
      : '<div class="empty">No pictures yet. Every project needs at least one, and one of them has to be the cover.</div>';
    return (
      '<div class="card prj-section">' +
      "<h3>Pictures</h3>" +
      '<div class="csub">Photographs, drawings and design visualisations. Exactly one has to be the cover — that is the ' +
      "picture used on the portfolio page.</div>" +
      add +
      pendingBlock() +
      (S.savedSlug
        ? '<div class="prj-mediahint">Previews below use temporary links. If they stop showing, ' +
          "<button class=\"prj-linkbtn\" data-projreloadmedia>refresh the previews</button>.</div>"
        : "") +
      '<div class="prj-imgs">' + cards + "</div>" +
      inlineErr("images") +
      "</div>"
    );
  }

  function beforeAfterSection() {
    var ba = S.editing.beforeAfter;
    var on = !!ba;
    var inner = on
      ? '<div class="cols-2 grid">' +
        '<div class="prj-field' + badCls("beforeAfter.label") + '"><label for="prjba-label">Heading for the comparison</label>' +
        '<input id="prjba-label" type="text" maxlength="120" data-baf="label" value="' + E(ba.label) + '" placeholder="e.g. Rear elevation, before and after" />' +
        inlineErr("beforeAfter.label") + "</div>" +
        '<div class="prj-field' + badCls("beforeAfter.after") + '"><label for="prjba-after">The “after” picture <span class="prj-req">needed</span></label>' +
        '<select id="prjba-after" data-baf="after">' + imageOptions(ba.after, true) + "</select>" +
        inlineErr("beforeAfter.after") + "</div>" +
        '<div class="prj-field' + badCls("beforeAfter.before") + '"><label for="prjba-before">The “before” picture (optional)</label>' +
        '<select id="prjba-before" data-baf="before">' + imageOptions(ba.before, true) + "</select>" +
        inlineErr("beforeAfter.before") + "</div>" +
        '<div class="prj-field' + badCls("beforeAfter.drawing") + '"><label for="prjba-drawing">A drawing to show alongside (optional)</label>' +
        '<select id="prjba-drawing" data-baf="drawing">' + imageOptions(ba.drawing, true) + "</select>" +
        inlineErr("beforeAfter.drawing") + "</div>" +
        "</div>" +
        '<label class="prj-check"><input type="checkbox" data-baf="aligned"' + (ba.aligned ? " checked" : "") +
        " /> The two photographs are from the same spot, so they can be slid across each other</label>"
      : "";
    return (
      '<div class="card prj-section">' +
      "<h3>Before / after comparison</h3>" +
      '<div class="csub">Optional. Only use pictures that belong to this project.</div>' +
      '<label class="prj-check"><input type="checkbox" data-projbatoggle' + (on ? " checked" : "") +
      " /> Show a before / after comparison on this page</label>" +
      inner +
      "</div>"
    );
  }

  function editorHead() {
    var w = S.editing;
    var published = S.meta && S.meta.status === "published";
    var live = published ? href(liveUrl(w.slug)) : null;
    var bits = [statusPill(published ? "published" : "draft")];
    if (S.dirty) bits.push('<span class="pill red">Not saved</span>');
    if (S.meta && S.meta.publishedAt) bits.push('<span class="prj-headmeta">Published ' + E(fmtDateTime(S.meta.publishedAt)) + "</span>");
    else if (S.meta && S.meta.updatedAt) bits.push('<span class="prj-headmeta">Saved ' + E(fmtDateTime(S.meta.updatedAt)) + "</span>");
    return (
      '<div class="prj-head">' +
      '<button class="btn btn-ghost prj-sm" data-projback>← All projects</button>' +
      '<div class="prj-headtitle">' + E(w.title || (S.isNew ? "New project" : w.slug)) + "</div>" +
      '<div class="prj-headbits">' + bits.join("") + "</div>" +
      // A page that was just published does not exist yet — the commit has to
      // go through a Cloudflare build first. Offering the link straight away
      // means the first thing Sean clicks is a 404, which reads as "publishing
      // is broken". Hold it back until the rebuild has plausibly finished.
      (live
        ? S.justPublishedAt && Date.now() - S.justPublishedAt < REBUILD_MS
          ? '<span class="prj-headmeta">The page will be here once the site has rebuilt</span>'
          : '<a class="btn btn-ghost prj-sm" href="' +
            E(live) +
            '" target="_blank" rel="noopener noreferrer">View the live page</a>'
        : "") +
      "</div>"
    );
  }

  function editorActions() {
    var published = S.meta && S.meta.status === "published";
    return (
      '<div class="card prj-actions">' +
      '<div class="prj-actrow">' +
      '<button class="btn" data-projsave' + (S.busy ? " disabled" : "") + ">" +
      (S.busy === "save" ? "Saving…" : published ? "Save changes" : "Save draft") + "</button>" +
      '<button class="btn" data-projpublish' + (S.busy ? " disabled" : "") + ">" +
      (S.busy === "publish" ? "Publishing…" : published ? "Publish the changes" : "Publish to the website") + "</button>" +
      (published ? '<button class="btn btn-ghost" data-projunpublish="' + E(S.editing.slug) + '">Take off the website</button>' : "") +
      (S.savedSlug ? '<button class="btn btn-danger" data-projdelete="' + E(S.editing.slug) + '">Delete completely</button>' : "") +
      "</div>" +
      '<div class="csub" style="margin-top:10px">Saving keeps your work here and changes nothing on the website. ' +
      "Publishing writes the page into the website, which then <strong>rebuilds itself — a minute or two</strong> before " +
      "the page appears.</div>" +
      /* "imgrm" renders inside the picture it belongs to, not down here. */
      (S.confirm && S.confirm.where === "editor" && S.confirm.mode !== "imgrm"
        ? confirmPanel(S.editing.slug, published ? "published" : "draft", S.editing.title)
        : "") +
      "</div>"
    );
  }

  function viewEditor() {
    var w = S.editing;
    var rv = parseReviewed(w.reviewed);
    var slugLocked = !!S.savedSlug;
    return (
      editorHead() +
      // The ✕ here was identical to the dismiss ✕ on an ordinary notice, but it
      // threw the recovered work away rather than closing the message. Two
      // labelled buttons instead, and discarding goes through the normal
      // confirm panel — unsaved writing lost to a misread icon is gone for good.
      (S.restored
        ? '<div class="prj-notice prj-notice-warn"><div>These are changes you had not saved. Press <strong>Save draft</strong> ' +
          "to keep them.</div>" +
          '<div class="prj-pendacts">' +
          '<button class="btn btn-ghost prj-sm" data-projkeeprestored>Keep these changes</button>' +
          '<button class="btn btn-ghost prj-sm" data-projdiscard>Throw them away</button>' +
          "</div></div>"
        : "") +
      noticeBlock() +
      problemsBlock() +
      '<div class="callout">Write this the way you would describe the job to a customer. Two rules the website enforces for you: ' +
      "<strong>no street names or planning references</strong> (town or general area only), and <strong>never the word " +
      "“architect”</strong> on its own — “architectural designer” or “architectural design” instead. " +
      "If anything breaks a rule you will be told exactly what to change before it can go live.</div>" +
      /* --- the basics --- */
      '<div class="card prj-section"><h3>The basics</h3>' +
      '<div class="grid cols-2">' +
      tf("title", "Project title", {
        req: true,
        max: 120,
        ph: "e.g. Rear extension and open-plan kitchen, Heswall",
        help: "This is the page heading and what shows on the portfolio card. 8 characters or more.",
      }) +
      (slugLocked
        ? '<div class="prj-field"><label>Web address</label><input type="text" value="' + E(w.slug) +
          '" readonly /><div class="prj-help">Fixed once the draft is saved, so links and pictures do not break. ' +
          "The page will be at <code>/projects/" + E(w.slug) + "/</code>.</div></div>"
        : tf("slug", "Web address", {
            req: true,
            max: 80,
            help: "Filled in from the title. Lower-case words joined by hyphens — this becomes <code>/projects/…/</code> and cannot be changed after the first save.",
          })) +
      tf("town", "Town or general area", { req: true, max: 60, ph: "e.g. Heswall", help: "Town or area only — never a street." }) +
      tf("propertyType", "Type of property", { req: true, max: 80, ph: "e.g. 1930s semi-detached house" }) +
      tf("projectType", "Type of work", { req: true, max: 80, ph: "e.g. Single-storey rear extension" }) +
      '<div class="prj-field' + badCls("stage") + '"><label for="prjf-stage">Stage</label>' +
      '<select id="prjf-stage" data-f="stage">' + opts(STAGES, w.stage) + "</select>" +
      '<div class="prj-help">A “Completed” project must lead with a photograph, not a design visualisation.</div>' +
      inlineErr("stage") + "</div>" +
      '<div class="prj-field' + badCls("reviewed") + '"><label>Copy last checked</label>' +
      '<div class="prj-inline">' +
      '<select data-rvf="month" aria-label="Month">' + opts(MONTHS.map(function (m) { return [m, m]; }), rv.month) + "</select>" +
      '<select data-rvf="year" aria-label="Year">' + opts(yearOpts(rv.year), rv.year) + "</select>" +
      "</div>" +
      '<div class="prj-help">Shown on the page so visitors know how current it is.</div>' +
      inlineErr("reviewed") + "</div>" +
      "</div></div>" +
      /* --- the story --- */
      '<div class="card prj-section"><h3>The story</h3>' +
      '<div class="csub">The summary and the brief are needed. The rest are optional — leave a box empty and that section ' +
      "simply does not appear on the page.</div>" +
      ta("summary", "Short summary", {
        req: true, max: 400, rows: 3,
        ph: "One or two sentences — this is what shows on the portfolio card and in Google.",
        help: "20 characters or more.",
      }) +
      ta("brief", "What the client asked for", { req: true, max: 2000, rows: 5 }) +
      ta("challenge", "The challenge", { max: 2000, rows: 4, ph: "Anything awkward about the site, the building or the planning position." }) +
      ta("designResponse", "How you solved it", { max: 4000, rows: 6 }) +
      ta("planningRoute", "Planning route", { max: 2000, rows: 3, ph: "e.g. Permitted development, or a householder application." }) +
      ta("buildingRegsRoute", "Building regulations", { max: 2000, rows: 3 }) +
      ta("outcome", "How it turned out", { max: 2000, rows: 4 }) +
      ta("drawings", "Drawings produced", {
        max: 2000, rows: 4,
        ph: "One per line, e.g.\nExisting and proposed floor plans\nProposed elevations\nSection through the extension",
        help: "One per line. These are listed on the page as a simple list.",
      }) +
      "</div>" +
      /* --- pictures --- */
      imagesSection() +
      beforeAfterSection() +
      /* --- links --- */
      '<div class="card prj-section"><h3>Where this project shows up</h3>' +
      '<div class="csub">Choosing these links the case study to the right service and area pages. Up to six of each.</div>' +
      '<div class="grid cols-2">' +
      chipPicker("relatedServices", SERVICES, "Services this project relates to", "It will appear as an example on those service pages.") +
      chipPicker("relatedAreas", AREAS, "Areas this project relates to", "Choose the town and its near neighbours, not everywhere.") +
      "</div></div>" +
      /* --- google --- */
      '<div class="card prj-section"><h3>How it looks in Google</h3>' +
      '<div class="csub">Optional. Leave both empty and the title and summary above are used.</div>' +
      '<div class="grid cols-2">' +
      tf("seoTitle", "Google title", { max: 70, help: "Up to 70 characters." }) +
      ta("metaDescription", "Google description", { max: 160, rows: 3, help: "Up to 160 characters." }) +
      "</div></div>" +
      /* --- permission --- */
      '<div class="card prj-section' + (probsFor("homeownerPermissionConfirmed").length ? " prj-section-bad" : "") + '">' +
      "<h3>The homeowner’s permission</h3>" +
      '<div class="csub">This is a real person’s home. It cannot be published without this.</div>' +
      '<label class="prj-check prj-check-big"><input type="checkbox" data-f="homeownerPermissionConfirmed"' +
      (w.homeownerPermissionConfirmed ? " checked" : "") +
      " /> <span>The homeowner has agreed to this project appearing on the website, including these photographs.</span></label>" +
      inlineErr("homeownerPermissionConfirmed") +
      "</div>" +
      editorActions()
    );
  }

  /* ------------------------------------------------------------------ *
   * Paint                                                               *
   * ------------------------------------------------------------------ */
  function view() {
    return S.editing ? viewEditor() : viewProjects();
  }

  /**
   * Repaint, keeping focus and caret where they were.
   *
   * Everything here rebuilds from module state, which is what lets a stray
   * Refresh (or the topbar Range control) survive without losing typing — but
   * it also means an innocent re-render would otherwise throw away the caret.
   */
  function paint() {
    if (state.view !== "projects") return;
    var el = document.getElementById("view");
    if (!el) return;
    var a = document.activeElement;
    var key = null, selStart = null, selEnd = null;
    if (a && el.contains(a) && a.id) {
      key = a.id;
      try { selStart = a.selectionStart; selEnd = a.selectionEnd; } catch (e) {}
    }
    el.innerHTML = view();
    if (key) {
      var back = document.getElementById(key);
      if (back) {
        try {
          back.focus();
          if (selStart !== null && back.setSelectionRange) back.setSelectionRange(selStart, selEnd);
        } catch (e) {}
      }
    }
    afterRender();
  }

  /**
   * Wire the two things that cannot be delegated through admin.js's click and
   * change listeners: the drag-and-drop zone and the drag-a-box redaction
   * surface. Called after every paint, because innerHTML discards listeners.
   */
  function afterRender() {
    wireDrop();
    wireRedact();
  }

  function wireDrop() {
    var z = document.getElementById("prjDrop");
    if (!z) return;
    var stop = function (e) { e.preventDefault(); e.stopPropagation(); };
    ["dragenter", "dragover"].forEach(function (n) {
      z.addEventListener(n, function (e) { stop(e); z.classList.add("is-over"); });
    });
    ["dragleave", "dragend"].forEach(function (n) {
      z.addEventListener(n, function (e) { stop(e); z.classList.remove("is-over"); });
    });
    z.addEventListener("drop", function (e) {
      stop(e);
      z.classList.remove("is-over");
      var files = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : null;
      if (files && files.length) stageFiles(files);
    });
  }

  function place(el, x, y, w, h) {
    el.style.left = (x * 100).toFixed(2) + "%";
    el.style.top = (y * 100).toFixed(2) + "%";
    el.style.width = (w * 100).toFixed(2) + "%";
    el.style.height = (h * 100).toFixed(2) + "%";
  }

  function wireRedact() {
    var surf = document.getElementById("prjRedact");
    if (!surf) return;
    var live = surf.querySelector(".prj-redlive");
    if (!live) return;
    var drag = null;
    function norm(ev) {
      var r = surf.getBoundingClientRect();
      if (!r.width || !r.height) return { x: 0, y: 0 };
      return { x: clamp01((ev.clientX - r.left) / r.width), y: clamp01((ev.clientY - r.top) / r.height) };
    }
    surf.addEventListener("pointerdown", function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault();
      drag = norm(ev);
      try { surf.setPointerCapture(ev.pointerId); } catch (e) {}
      place(live, drag.x, drag.y, 0, 0);
      live.hidden = false;
    });
    surf.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      var p = norm(ev);
      place(live, Math.min(drag.x, p.x), Math.min(drag.y, p.y), Math.abs(p.x - drag.x), Math.abs(p.y - drag.y));
    });
    surf.addEventListener("pointerup", function (ev) {
      if (!drag) return;
      var p = norm(ev), d = drag;
      drag = null;
      live.hidden = true;
      var box = {
        x: Math.min(d.x, p.x), y: Math.min(d.y, p.y),
        w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y),
        mode: S.redactMode,
      };
      // Ignore a stray click rather than adding a box nobody can see.
      if (box.w < 0.015 || box.h < 0.015) return;
      var it = S.pending[S.redactIdx];
      if (!it) return;
      it.boxes.push(box);
      paint();
    });
    surf.addEventListener("pointercancel", function () { drag = null; live.hidden = true; });
  }

  /* ------------------------------------------------------------------ *
   * Loading                                                             *
   * ------------------------------------------------------------------ */
  function loadProjects() {
    S.loadError = null;
    return get(PROJECTS + "?view=list")
      .then(function (r) {
        if (r.halt) return;
        if (!r.ok || !r.json.ok) throw new Error(errText(r.json));
        state.projects = r.json;
        markFresh();
        paint();
        setMeta();
      })
      .catch(function (e) {
        S.loadError = (e && e.message) || "Could not load the projects. Try again.";
        paint();
      });
  }

  function loadOne(slug) {
    S.busy = "open";
    paint();
    return get(PROJECTS + "?view=one&slug=" + encodeURIComponent(slug))
      .then(function (r) {
        S.busy = "";
        if (r.halt) return;
        if (!r.ok || !r.json.ok) {
          S.notice = { kind: "warn", text: errText(r.json) };
          paint();
          return;
        }
        S.editing = intoWorking(r.json.project);
        S.meta = r.json.meta || null;
        if (S.meta && S.meta.status) S.editing.status = S.meta.status;
        S.savedSlug = S.editing.slug;
        S.isNew = false;
        S.dirty = false;
        S.problems = null;
        S.pending = [];
        S.pendErrors = [];
        S.redactIdx = null;
        S.confirm = null;
        S.restored = false;
        S.mediaUrls = {};
        (r.json.media || []).forEach(function (m) { if (m && m.file) S.mediaUrls[m.file] = m.url; });
        clearLocal();
        window.scrollTo(0, 0);
        paint();
        setMeta();
      })
      .catch(function () {
        S.busy = "";
        S.notice = { kind: "warn", text: "Could not open that project. Try again." };
        paint();
      });
  }

  function reloadMedia() {
    if (!S.savedSlug) return;
    get(PROJECTS + "?view=one&slug=" + encodeURIComponent(S.savedSlug)).then(function (r) {
      if (r.halt || !r.ok || !r.json.ok) return;
      S.mediaUrls = {};
      (r.json.media || []).forEach(function (m) { if (m && m.file) S.mediaUrls[m.file] = m.url; });
      if (r.json.meta) S.meta = r.json.meta;
      paint();
    });
  }

  function setMeta() {
    var el = document.getElementById("pageMeta");
    if (!el || state.view !== "projects") return;
    if (S.editing) {
      el.textContent = S.editing.slug ? "/projects/" + S.editing.slug + "/" : "New project";
    } else if (state.projects) {
      var rows = state.projects.rows || [];
      var pub = rows.filter(function (r) { return r.status === "published"; }).length;
      el.textContent = fmt(rows.length) + " projects · " + fmt(pub) + " on the website";
    } else {
      el.textContent = "Case studies";
    }
  }

  /* ------------------------------------------------------------------ *
   * Saving, publishing, removing                                        *
   * ------------------------------------------------------------------ */
  function applyProblems(j) {
    S.problems = Array.isArray(j.problems) && j.problems.length ? j.problems : [{ field: "(root)", rule: "unknown", message: errText(j) }];
    paint();
    var el = document.getElementById("prjProblems");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
  }

  function save(opt) {
    opt = opt || {};
    if (!S.editing || S.busy) return Promise.resolve(false);
    var local = preSaveProblems();
    if (local.length) { applyProblems({ problems: local }); return Promise.resolve(false); }
    S.busy = "save";
    S.problems = null;
    paint();
    var payload = toPayload();
    return post(PROJECTS, { action: "save", project: payload })
      .then(function (r) {
        S.busy = "";
        if (r.halt) return false;
        if (r.status === 422 || (!r.json.ok && r.json.problems)) { applyProblems(r.json); return false; }
        if (!r.ok || !r.json.ok) { S.notice = { kind: "warn", text: errText(r.json) }; paint(); return false; }
        S.savedSlug = r.json.slug || payload.slug;
        S.editing.slug = S.savedSlug;
        S.isNew = false;
        S.dirty = false;
        S.problems = null;
        S.meta = S.meta || {};
        S.meta.status = r.json.status || S.meta.status || "draft";
        S.meta.updatedAt = new Date().toISOString();
        clearLocal();
        S.restored = false;
        state.projects = null; // the list now shows a stale title/town/stage
        if (!opt.quiet) {
          showToast("Draft saved");
          S.notice = { kind: "ok", text: "Draft saved. Nothing on the website has changed." };
        }
        paint();
        setMeta();
        return true;
      })
      .catch(function () {
        S.busy = "";
        S.notice = { kind: "warn", text: "Saving failed — check your connection and try again." };
        paint();
        return false;
      });
  }

  function publish() {
    if (!S.editing || S.busy) return;
    var local = prePublishProblems();
    if (local.length) { applyProblems({ problems: local }); return; }
    var wasStatus = S.editing.status;
    S.editing.status = "published";
    // Save first, with status "published", so the same validator that guards the
    // build runs before anything is committed.
    save({ quiet: true }).then(function (ok) {
      if (!ok) { S.editing.status = wasStatus; return; }
      S.busy = "publish";
      paint();
      post(PUBLISH, { action: "publish", slug: S.editing.slug })
        .then(function (r) {
          S.busy = "";
          if (r.halt) return;
          if (r.status === 422 || (!r.json.ok && r.json.problems)) { S.editing.status = wasStatus; applyProblems(r.json); return; }
          if (!r.ok || !r.json.ok) { S.editing.status = wasStatus; S.notice = { kind: "warn", text: errText(r.json) }; paint(); return; }
          S.meta = S.meta || {};
          S.meta.status = "published";
          S.meta.publishedAt = new Date().toISOString();
          S.meta.lastPublishSha = r.json.commitSha || null;
          S.problems = null;
          // Suppress the live-page link until the rebuild has plausibly landed,
          // and repaint once it has so the link appears without Sean reloading.
          S.justPublishedAt = Date.now();
          setTimeout(function () {
            if (S.editing) paint();
          }, REBUILD_MS + 1000);
          showToast("Published");
          S.notice = {
            kind: "ok",
            text:
              "Saved into the website" + (r.json.commitSha ? " (change " + String(r.json.commitSha).slice(0, 7) + ")" : "") +
              ". The website is rebuilding now — this takes a minute or two before the page appears.",
            href: r.json.commitUrl || null,
            label: "See the change",
          };
          state.projects = null;
          paint();
          setMeta();
        })
        .catch(function () {
          S.busy = "";
          S.editing.status = wasStatus;
          S.notice = { kind: "warn", text: "Publishing failed — nothing on the website was changed. Try again." };
          paint();
        });
    });
  }

  function unpublish(slug) {
    if (S.busy) return;
    S.busy = "unpublish";
    paint();
    post(PUBLISH, { action: "unpublish", slug: slug })
      .then(function (r) {
        S.busy = "";
        S.confirm = null;
        if (r.halt) return;
        if (!r.ok || !r.json.ok) { S.notice = { kind: "warn", text: errText(r.json) }; paint(); return; }
        if (S.editing && S.editing.slug === slug) {
          S.editing.status = "draft";
          S.meta = S.meta || {};
          S.meta.status = "draft";
          S.meta.publishedAt = null;
        }
        showToast("Taken off the website");
        S.notice = {
          kind: "ok",
          text:
            "Taken off the website" + (r.json.commitSha ? " (change " + String(r.json.commitSha).slice(0, 7) + ")" : "") +
            ". The draft and the pictures are kept. The website is rebuilding — a minute or two — and the old address will " +
            "then send visitors to the projects page.",
        };
        state.projects = null;
        if (S.editing) { paint(); } else { loadProjects(); }
      })
      .catch(function () {
        S.busy = "";
        S.notice = { kind: "warn", text: "That failed — try again." };
        paint();
      });
  }

  function destroy(slug) {
    if (S.busy) return;
    if (S.confirmText !== slug) return;
    S.busy = "delete";
    paint();
    post(PUBLISH, { action: "delete", slug: slug, confirm: S.confirmText })
      .then(function (r) {
        S.busy = "";
        if (r.halt) return;
        if (!r.ok || !r.json.ok) {
          S.confirm = null;
          S.notice = { kind: "warn", text: errText(r.json) };
          paint();
          return;
        }
        var wasPublished = !!r.json.commitSha;
        S.confirm = null;
        S.confirmText = "";
        if (S.editing && S.editing.slug === slug) {
          S.editing = null;
          S.meta = null;
          S.savedSlug = null;
          S.isNew = false;
          S.dirty = false;
          S.pending = [];
          S.problems = null;
          clearLocal();
        }
        showToast("Deleted");
        // The API tells us when the page came down but some stored pictures did
        // not. Reporting that as a clean "deleted, along with its pictures"
        // would leave Sean believing photographs of a customer's home were gone
        // when they are still sitting in storage, so say what actually happened.
        var leftovers = r.json.warning || (r.json.notRemoved && r.json.notRemoved.length);
        S.notice = {
          kind: leftovers ? "warn" : "ok",
          text:
            "“" + slug + "” has been deleted" +
            (leftovers ? "" : ", along with its pictures") +
            "." +
            (wasPublished
              ? " The website is rebuilding — a minute or two — after which the old address will send visitors to the projects page."
              : " It was only ever a draft, so nothing on the website changes.") +
            (leftovers
              ? " Some of the uploaded pictures could not be removed from storage" +
                (r.json.notRemoved && r.json.notRemoved.length
                  ? " (" + r.json.notRemoved.length + " of them)"
                  : "") +
                " — tell Matthew so they can be cleared."
              : ""),
        };
        state.projects = null;
        loadProjects();
      })
      .catch(function () {
        S.busy = "";
        S.notice = { kind: "warn", text: "Deleting failed — try again." };
        paint();
      });
  }

  function reorder(slug, dir) {
    var d = state.projects;
    if (!d || !d.rows) return;
    var rows = d.rows.slice();
    var i = rows.findIndex(function (r) { return r.slug === slug; });
    var j = i + dir;
    if (i === -1 || j < 0 || j >= rows.length) return;
    var tmp = rows[i];
    rows[i] = rows[j];
    rows[j] = tmp;
    d.rows = rows;
    paint();
    post(PROJECTS, { action: "reorder", order: rows.map(function (r) { return r.slug; }) }).then(function (r) {
      if (r.halt) return;
      if (!r.ok || !r.json.ok) {
        S.notice = { kind: "warn", text: errText(r.json) };
        loadProjects();
        return;
      }
      showToast("Order saved");
    });
  }

  /* ------------------------------------------------------------------ *
   * Images                                                              *
   * ------------------------------------------------------------------ */
  function takenNames() {
    return S.editing.images
      .map(function (im) { return im.file; })
      .concat(S.pending.map(function (p) { return p.name; }));
  }

  function stageFiles(fileList) {
    if (!S.savedSlug) {
      S.pendErrors = ["Save the draft first — pictures are filed under the project’s web address."];
      paint();
      return;
    }
    var prep = window.SCImagePrep;
    if (!prep) {
      S.pendErrors = ["The picture tools did not load. Reload the page and try again."];
      paint();
      return;
    }
    var kind = S.addKind || "photo";
    var files = Array.prototype.slice.call(fileList);
    S.pendErrors = [];
    S.busy = "prep";
    paint();
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        return prep
          .prepare(f, { png: kind === "drawing" })
          .then(function (out) {
            return prep.thumbnail(out.dataUrl, 320).then(function (thumb) {
              S.pending.push({
                file: f,
                kind: kind,
                ext: out.ext,
                name: prep.safeName(f.name, out.ext, takenNames()),
                preview: out.dataUrl,
                thumb: thumb,
                bytes: out.bytes,
                w: out.width,
                h: out.height,
                boxes: [],
              });
            });
          })
          .catch(function (err) {
            S.pendErrors.push((f.name ? f.name + ": " : "") + ((err && err.message) || "That file could not be read."));
          });
      });
    });
    chain.then(function () {
      S.busy = "";
      paint();
    });
  }

  /** Re-make a staged picture from the ORIGINAL file with the boxes applied, so
   *  Sean sees the actual result before anything is uploaded. */
  function applyRedactions(i) {
    var p = S.pending[i];
    var prep = window.SCImagePrep;
    if (!p || !prep) return;
    S.busy = "redact";
    paint();
    prep
      .prepare(p.file, { png: p.kind === "drawing", redactions: p.boxes })
      .then(function (out) {
        return prep.thumbnail(out.dataUrl, 320).then(function (thumb) {
          p.preview = out.dataUrl;
          p.thumb = thumb;
          p.bytes = out.bytes;
          p.w = out.width;
          p.h = out.height;
          S.busy = "";
          // Record WHICH boxes this preview was made from. addPending compares
          // against this before uploading, so a box drawn but never applied
          // cannot go up as the original photo.
          p.applied = JSON.stringify(p.boxes || []);
          // Applying closes the panel; "start again" leaves it open to redraw.
          if (p.boxes.length) S.redactIdx = null;
          showToast(p.boxes.length ? "Areas hidden" : "Picture restored");
          paint();
        });
      })
      .catch(function (err) {
        S.busy = "";
        S.pendErrors = [(err && err.message) || "That picture could not be re-made."];
        paint();
      });
  }

  function addPending() {
    if (!S.pending.length || S.busy) return;
    var prep = window.SCImagePrep;
    if (!prep) return;
    S.busy = "upload";
    S.pendErrors = [];
    paint();
    var slug = S.savedSlug;
    var chain = Promise.resolve();
    var added = 0;
    S.pending.slice().forEach(function (p) {
      chain = chain
        .then(function () {
          /**
           * Last line of defence for the redaction.
           *
           * p.preview is only re-made when Sean presses Apply, but the card
           * says "N areas hidden" as soon as a box is DRAWN. Drawing a box over
           * a house number and then pressing Add without Apply would upload the
           * original photo while the screen said the area was hidden — the one
           * failure this feature must never have. So re-make it here from the
           * boxes that actually exist, rather than trusting that he pressed a
           * button. No-op when the preview is already in step.
           */
          var want = JSON.stringify(p.boxes || []);
          if (want === (p.applied || "[]")) return null;
          return prep
            .prepare(p.file, { png: p.kind === "drawing", redactions: p.boxes })
            .then(function (out) {
              p.preview = out.dataUrl;
              p.bytes = out.bytes;
              p.w = out.width;
              p.h = out.height;
              p.applied = want;
            });
        })
        .then(function () {
          return post(PROJECTS, {
            action: "upload",
            slug: slug,
            file: p.name,
            dataBase64: prep.base64Of(p.preview),
          });
        })
        .then(function (r) {
          if (r.halt) throw new Error("halt");
          if (!r.ok || !r.json.ok) {
            S.pendErrors.push(p.name + ": " + errText(r.json));
            return;
          }
          S.mediaUrls[p.name] = r.json.url;
          S.editing.images.push({
            file: p.name,
            kind: p.kind,
            alt: "",
            caption: "",
            cover: S.editing.images.length === 0,
          });
          S.pending = S.pending.filter(function (x) { return x !== p; });
          added++;
          S.dirty = true;
          saveLocal();
        });
    });
    chain
      .then(function () {
        S.busy = "";
        S.redactIdx = null;
        if (added) showToast(added === 1 ? "Picture added" : added + " pictures added");
        if (added && !S.pendErrors.length)
          S.notice = { kind: "ok", text: "Added. Describe each picture, then press Save draft." };
        paint();
      })
      .catch(function (e) {
        S.busy = "";
        if (!e || e.message !== "halt") S.pendErrors.push("The upload stopped. Try again.");
        paint();
      });
  }

  function removeImage(file) {
    if (S.busy) return;
    S.busy = "imgrm";
    paint();
    post(PROJECTS, { action: "delete-media", slug: S.savedSlug, file: file })
      .then(function (r) {
        S.busy = "";
        S.confirm = null;
        if (r.halt) return;
        // A storage object that has already gone is not a reason to keep a
        // broken reference in the project, so drop it either way and say so.
        if (!r.ok || !r.json.ok) S.notice = { kind: "warn", text: errText(r.json) };
        var imgs = S.editing.images.filter(function (im) { return im.file !== file; });
        var lostCover = S.editing.images.some(function (im) { return im.file === file && im.cover; });
        if (lostCover && imgs.length) imgs[0].cover = true;
        S.editing.images = imgs;
        var ba = S.editing.beforeAfter;
        if (ba) {
          ["before", "drawing", "after"].forEach(function (k) { if (ba[k] === file) ba[k] = ""; });
        }
        delete S.mediaUrls[file];
        S.dirty = true;
        saveLocal();
        showToast("Picture removed");
        paint();
      })
      .catch(function () {
        S.busy = "";
        S.notice = { kind: "warn", text: "Removing that picture failed. Try again." };
        paint();
      });
  }

  function moveImage(i, dir) {
    var j = i + dir;
    var a = S.editing.images;
    if (j < 0 || j >= a.length) return;
    var t = a[i];
    a[i] = a[j];
    a[j] = t;
    S.dirty = true;
    saveLocal();
    paint();
  }

  /* ------------------------------------------------------------------ *
   * Editing the working copy                                            *
   * ------------------------------------------------------------------ */
  function setField(f, v) {
    if (!S.editing) return;
    if (f === "drawings") S.editing.drawings = String(v).split(/\r?\n/);
    else S.editing[f] = v;
    S.dirty = true;
    saveLocal();
  }

  function newProject() {
    S.editing = blankProject();
    S.meta = { status: "draft" };
    S.savedSlug = null;
    S.isNew = true;
    S.slugTouched = false;
    S.dirty = false;
    S.problems = null;
    S.pending = [];
    S.pendErrors = [];
    S.redactIdx = null;
    S.confirm = null;
    S.notice = null;
    S.restored = false;
    S.mediaUrls = {};
    clearLocal();
    window.scrollTo(0, 0);
    paint();
    setMeta();
  }

  function closeEditor() {
    S.editing = null;
    S.meta = null;
    S.savedSlug = null;
    S.isNew = false;
    S.dirty = false;
    S.problems = null;
    S.pending = [];
    S.pendErrors = [];
    S.redactIdx = null;
    S.confirm = null;
    S.restored = false;
    S.mediaUrls = {};
    clearLocal();
    window.scrollTo(0, 0);
    if (state.projects) { paint(); setMeta(); } else loadProjects();
  }

  function restoreDraft() {
    if (S.editing) return;
    var j = readLocal();
    if (!j) return;
    S.editing = intoWorking(j.project);
    S.meta = j.meta || { status: "draft" };
    S.savedSlug = j.savedSlug || null;
    S.isNew = !!j.isNew;
    S.dirty = true;
    S.restored = true;
    S.mediaUrls = {};
    if (S.savedSlug) reloadMedia();
  }

  /* ------------------------------------------------------------------ *
   * Event handling                                                      *
   * ------------------------------------------------------------------ */
  function hit(e, attr) {
    var el = e.target.closest("[" + attr + "]");
    return el ? el : null;
  }

  function onClick(e) {
    if (state.view !== "projects") return false;
    var el;

    if ((el = hit(e, "data-projnoticex"))) { S.notice = null; paint(); return true; }
    // Keeping the recovered work is just dismissing the banner — the changes are
    // already loaded in the editor and Save draft keeps them as normal.
    if ((el = hit(e, "data-projkeeprestored"))) { S.restored = false; paint(); return true; }
    // Throwing it away destroys writing that exists nowhere else, so route it
    // through the same confirm panel as leaving with unsaved changes rather than
    // acting on one click.
    if ((el = hit(e, "data-projdiscard"))) {
      S.confirm = { mode: "leave", where: "editor", slug: S.editing ? S.editing.slug : "" };
      paint();
      return true;
    }
    if ((el = hit(e, "data-projreload"))) { loadProjects(); return true; }

    /* ---- list ---- */
    if ((el = hit(e, "data-projnew"))) { newProject(); return true; }
    if ((el = hit(e, "data-projfilter"))) {
      S.filter = el.getAttribute("data-projfilter");
      S.confirm = null;
      paint();
      return true;
    }
    if ((el = hit(e, "data-projedit"))) { loadOne(el.getAttribute("data-projedit")); return true; }
    if ((el = hit(e, "data-projtoggle"))) {
      var slug = el.getAttribute("data-projtoggle");
      S.confirm = S.confirm && S.confirm.where === "list" && S.confirm.slug === slug ? null : { mode: "choose", slug: slug, where: "list" };
      S.confirmText = "";
      paint();
      return true;
    }
    if ((el = hit(e, "data-projup"))) { reorder(el.getAttribute("data-projup"), -1); return true; }
    if ((el = hit(e, "data-projdown"))) { reorder(el.getAttribute("data-projdown"), 1); return true; }

    /* ---- editor: destructive ---- */
    if ((el = hit(e, "data-projunpublish"))) {
      S.confirm = { mode: "unpublish", slug: el.getAttribute("data-projunpublish"), where: S.editing ? "editor" : "list" };
      paint();
      return true;
    }
    if ((el = hit(e, "data-projdelete"))) {
      S.confirm = { mode: "delete", slug: el.getAttribute("data-projdelete"), where: S.editing ? "editor" : "list" };
      S.confirmText = "";
      paint();
      return true;
    }
    if ((el = hit(e, "data-projconfirmcancel"))) { S.confirm = null; S.confirmText = ""; paint(); return true; }
    if ((el = hit(e, "data-projconfirmgo"))) {
      var what = el.getAttribute("data-projconfirmgo");
      var c = S.confirm || {};
      if (what === "unpublish") unpublish(c.slug);
      else if (what === "delete") destroy(c.slug);
      else if (what === "imgrm") removeImage(c.slug);
      else if (what === "discard") { S.confirm = null; closeEditor(); }
      else if (what === "savego") {
        S.confirm = null;
        save().then(function (ok) { if (ok) closeEditor(); });
      }
      return true;
    }

    /* ---- editor: main actions ---- */
    if ((el = hit(e, "data-projback"))) {
      if (S.dirty) { S.confirm = { mode: "leave", where: "editor", slug: S.editing ? S.editing.slug : "" }; paint(); }
      else closeEditor();
      return true;
    }
    if ((el = hit(e, "data-projsave"))) { save(); return true; }
    if ((el = hit(e, "data-projpublish"))) { publish(); return true; }
    if ((el = hit(e, "data-projreloadmedia"))) { reloadMedia(); return true; }

    /* ---- editor: related services / areas ---- */
    if ((el = hit(e, "data-projrm"))) {
      var parts = el.getAttribute("data-projrm").split(":");
      var f = parts[0], v = parts.slice(1).join(":");
      S.editing[f] = (S.editing[f] || []).filter(function (x) { return x !== v; });
      S.dirty = true;
      saveLocal();
      paint();
      return true;
    }

    /* ---- editor: before / after ---- */
    if ((el = hit(e, "data-projbatoggle"))) {
      // The label wraps a checkbox, so the change handler owns the state and
      // this only stops the click falling through to anything else.
      return true;
    }

    /* ---- editor: pictures ---- */
    if ((el = hit(e, "data-projimgrm"))) {
      S.confirm = { mode: "imgrm", slug: el.getAttribute("data-projimgrm"), where: "editor" };
      paint();
      return true;
    }
    if ((el = hit(e, "data-projimgup"))) { moveImage(parseInt(el.getAttribute("data-projimgup"), 10), -1); return true; }
    if ((el = hit(e, "data-projimgdown"))) { moveImage(parseInt(el.getAttribute("data-projimgdown"), 10), 1); return true; }
    if ((el = hit(e, "data-projpendrm"))) {
      S.pending.splice(parseInt(el.getAttribute("data-projpendrm"), 10), 1);
      S.redactIdx = null;
      paint();
      return true;
    }
    if ((el = hit(e, "data-projpendclear"))) { S.pending = []; S.pendErrors = []; S.redactIdx = null; paint(); return true; }
    if ((el = hit(e, "data-projpendadd"))) { addPending(); return true; }
    if ((el = hit(e, "data-projredactmode"))) { S.redactMode = el.getAttribute("data-projredactmode"); paint(); return true; }
    if ((el = hit(e, "data-projredactclear"))) {
      var ri = parseInt(el.getAttribute("data-projredactclear"), 10);
      if (S.pending[ri]) { S.pending[ri].boxes = []; applyRedactions(ri); }
      return true;
    }
    if ((el = hit(e, "data-projredactapply"))) { if (S.redactIdx !== null) applyRedactions(S.redactIdx); return true; }
    if ((el = hit(e, "data-projredact"))) {
      var idx = parseInt(el.getAttribute("data-projredact"), 10);
      S.redactIdx = S.redactIdx === idx ? null : idx;
      paint();
      return true;
    }
    // The file input lives inside its own <label>, so let that click through.
    if (e.target && e.target.id === "prjFiles") return true;
    return false;
  }

  function onChange(e) {
    if (state.view !== "projects") return false;
    var t = e.target;
    if (!t || !t.hasAttribute) return false;
    var a = function (n) { return t.getAttribute(n); };
    // Presence, not value: a bare attribute like `data-projfiles` reads back as
    // "", which is falsy — testing the value would silently never match.
    var has = function (n) { return t.hasAttribute(n); };

    if (has("data-projfiles")) {
      if (t.files && t.files.length) stageFiles(t.files);
      t.value = "";
      return true;
    }
    if (has("data-projkind")) { S.addKind = t.value; return true; }
    if (has("data-projconfirmtext")) {
      // Deliberately no repaint: `change` fires on blur, which is the same
      // gesture as reaching for the confirm button. Replacing the panel
      // mid-click would swallow the click, so only the button state moves.
      S.confirmText = t.value.trim();
      syncConfirmButton();
      return true;
    }
    if (a("data-projadd")) {
      var f = a("data-projadd");
      var v = t.value;
      if (v && S.editing) {
        var cur = S.editing[f] || [];
        if (cur.indexOf(v) === -1 && cur.length < 6) cur.push(v);
        S.editing[f] = cur;
        S.dirty = true;
        saveLocal();
      }
      paint();
      return true;
    }
    if (has("data-projbatoggle")) {
      if (!S.editing) return true;
      S.editing.beforeAfter = t.checked ? { label: "", before: "", drawing: "", after: "", aligned: false } : null;
      S.dirty = true;
      saveLocal();
      paint();
      return true;
    }
    if (a("data-baf")) {
      if (!S.editing || !S.editing.beforeAfter) return true;
      var bk = a("data-baf");
      S.editing.beforeAfter[bk] = bk === "aligned" ? !!t.checked : t.value;
      S.dirty = true;
      saveLocal();
      if (bk !== "label") paint();
      return true;
    }
    if (a("data-rvf")) {
      if (!S.editing) return true;
      var rv = parseReviewed(S.editing.reviewed);
      rv[a("data-rvf")] = t.value;
      S.editing.reviewed = rv.month + " " + rv.year;
      S.dirty = true;
      saveLocal();
      return true;
    }
    if (a("data-imgf")) {
      if (!S.editing) return true;
      var i = parseInt(a("data-i"), 10);
      var im = S.editing.images[i];
      if (!im) return true;
      var k = a("data-imgf");
      if (k === "cover") {
        S.editing.images.forEach(function (x) { x.cover = false; });
        im.cover = true;
        S.dirty = true;
        saveLocal();
        paint();
        return true;
      }
      im[k] = t.value;
      S.dirty = true;
      saveLocal();
      if (k === "kind") paint();
      return true;
    }
    if (a("data-f")) {
      var ff = a("data-f");
      if (t.type === "checkbox") {
        setField(ff, !!t.checked);
        paint();
        return true;
      }
      setField(ff, t.value);
      if (ff === "slug") {
        // Normalise on blur rather than while typing, so the caret does not jump.
        var norm = slugifyLocal(t.value);
        S.editing.slug = norm;
        t.value = norm;
        saveLocal();
      }
      if (ff === "stage") paint();
      return true;
    }
    return false;
  }

  /**
   * Keystroke-level capture. admin.js only delegates `click` and `change` on
   * #view, and `change` on a text box does not fire until it loses focus — so
   * without this a Refresh (or a 401) mid-sentence would lose the sentence.
   * It never re-renders; it only writes to module state and to localStorage.
   */
  function syncConfirmButton() {
    var go = document.querySelector('[data-projconfirmgo="delete"]');
    if (go) go.disabled = !S.confirm || S.confirmText !== S.confirm.slug;
  }

  function onInput(e) {
    if (state.view !== "projects") return;
    var t = e.target;
    if (!t || !t.hasAttribute) return;
    // The delete confirmation also appears on a list row, where no editor is open.
    if (t.hasAttribute("data-projconfirmtext")) {
      S.confirmText = t.value.trim();
      syncConfirmButton();
      return;
    }
    if (!S.editing) return;
    var f = t.getAttribute("data-f");
    if (f) {
      setField(f, t.value);
      var c = document.getElementById("prjcount-" + f);
      if (c) c.textContent = t.value.length + " / " + (c.getAttribute("data-max") || "");
      if (f === "title" && S.isNew && !S.savedSlug && !S.slugTouched) {
        var sl = document.querySelector('[data-f="slug"]');
        var auto = slugifyLocal(t.value);
        if (sl) sl.value = auto;
        S.editing.slug = auto;
      }
      if (f === "slug") S.slugTouched = true;
      return;
    }
    var imf = t.getAttribute("data-imgf");
    if (imf) {
      var i = parseInt(t.getAttribute("data-i"), 10);
      if (S.editing.images[i]) {
        S.editing.images[i][imf] = t.value;
        S.dirty = true;
        saveLocal();
      }
      return;
    }
    var bf = t.getAttribute("data-baf");
    if (bf && S.editing.beforeAfter) {
      S.editing.beforeAfter[bf] = t.value;
      S.dirty = true;
      saveLocal();
    }
  }

  // #view is static markup in index.html and this script is deferred, so the
  // element already exists. One extra delegated listener, owned by this file.
  var viewEl = document.getElementById("view");
  if (viewEl) viewEl.addEventListener("input", onInput);

  /* ------------------------------------------------------------------ *
   * Public interface                                                    *
   * ------------------------------------------------------------------ */
  window.SCProjects = {
    title: "Projects & portfolio",

    view: view,

    load: function () {
      restoreDraft();
      if (S.editing) {
        // Never refetch over an open editor — that is Sean's unsaved work.
        paint();
        setMeta();
        markFresh();
        return;
      }
      loadProjects();
    },

    onClick: onClick,
    onChange: onChange,

    /**
     * Called from renderView()'s clean-slate block. It clears only the fetched
     * list, deliberately NOT the editor: Refresh and the topbar Range control
     * both come through here, and losing a half-written case study to a stray
     * click would be indefensible.
     */
    reset: function () {
      state.projects = null;
      S.loadError = null;
    },
  };
})();
