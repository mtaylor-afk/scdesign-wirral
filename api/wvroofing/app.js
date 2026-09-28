// WV Roofing (concept site) — the ONE Vercel function behind /api/wvroofing/*.
//
// vercel.json rewrites /api/wvroofing/:path* here, and
// serverlib/wvroofing/router.js does the routing. The project's Hobby plan
// allows 12 functions per deployment and api/ holds 11 with this file:
// never add another file under api/wvroofing/ - add a route instead.
"use strict";

module.exports = require("../../serverlib/wvroofing/router.js").handle;
