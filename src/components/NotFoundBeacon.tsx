"use client";

import { useEffect } from "react";
import { track } from "./Analytics";

/**
 * Records that a real visitor asked for a page that does not exist.
 *
 * Worth having because the alternative doesn't work: comparing visited paths against
 * sitemap.xml finds redirects and deliberately-unlisted pages, not broken links, and
 * a run of that over 90 days of live data turned up zero genuine 404s. This is the
 * direct measurement instead — the 404 page itself says so, and carries where the
 * visitor came from, which is what identifies the bad link or the stale search result.
 *
 * It can only ever see 404s that a BROWSER hit: the tracker is JavaScript, so a
 * crawler's 404s are not recorded here and never will be.
 *
 * The prop is `from`, not `ref`: the collector overwrites `ref` with its own
 * server-derived referrer, which is the mechanism that silently nulled every
 * time-on-page reading for three months.
 */
export function NotFoundBeacon() {
  useEffect(() => {
    track("page_not_found", { from: document.referrer || "(none)" });
  }, []);

  return null;
}
