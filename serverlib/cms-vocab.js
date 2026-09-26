/**
 * SC Design Wirral — controlled vocabularies for the projects CMS.
 *
 * The admin form offers these as dropdowns and the validator rejects anything
 * else, which is what keeps a CMS-authored case study wired into the right
 * service and area pages instead of pointing at a slug that does not exist.
 *
 * Plain CJS with no imports so BOTH consumers can read it: the Vercel functions
 * (`require`) and the build-time generator (ESM `import`). The lists duplicate
 * `src/lib/services.ts` and `src/lib/locations.ts`, which are TypeScript and so
 * unreadable from here — so `scripts/sync-cms-projects.mjs` re-derives them from
 * those files on every build and FAILS if the two have drifted apart. Add a
 * service or an area there and the build will tell you to update this file.
 */

/**
 * Service slugs — must match `services` in src/lib/services.ts (all eleven).
 *
 * Note that file mixes bare and quoted keys (`slug:` for the first six,
 * `"slug":` from line 593 on), so anything deriving this list by pattern must
 * accept both — an earlier version of the drift guard read only the bare form
 * and silently reported six.
 */
const SERVICE_SLUGS = [
  "house-extensions",
  "loft-conversions",
  "residential-design",
  "planning-drawings-wirral",
  "building-regulations-drawings-wirral",
  "garage-conversion-drawings-wirral",
  "front-porch-extension-design",
  "bespoke-garden-room-design",
  "change-of-use-applications",
  "measured-building-surveys",
  "concept-design-feasibility",
];

/** Area slugs — must match `locations` in src/lib/locations.ts. */
const AREA_SLUGS = [
  "wallasey",
  "birkenhead",
  "bebington",
  "heswall",
  "west-kirby",
  "hoylake",
  "bromborough",
  "new-brighton",
  "moreton",
  "upton",
  "greasby",
  "oxton",
  "port-sunlight",
  "eastham",
  "prenton",
  "neston",
  "ellesmere-port",
  "liverpool",
  "chester",
  "crosby",
];

/** Must match ProjectStage in src/lib/projects.ts. */
const STAGES = ["completed", "under-construction", "in-planning", "concept"];

/** Must match WorkImageKind in src/lib/work-images.ts. */
const IMAGE_KINDS = ["photo", "drawing", "render"];

/**
 * Slugs already used by the hand-authored case studies in src/lib/projects.ts
 * and src/lib/projects-brief2.ts.
 *
 * A CMS project may not reuse one. This is not a tidiness rule — the build
 * treats a slug appearing in both places as a hard error, so publishing a
 * colliding slug would make `npm run build` exit non-zero, and because
 * Cloudflare rebuilds the whole site on every push that would freeze EVERY
 * later change to the website until someone worked out why. Catching it at save
 * time turns a site-wide outage into a sentence in the form.
 *
 * `scripts/sync-cms-projects.mjs` re-derives this list on every build and fails
 * if it has drifted, so adding a hand-authored case study without updating this
 * file is caught immediately rather than silently reopening the hole.
 */
const RESERVED_SLUGS = [
  "bebington-rear-extension-loft",
  "brick-garden-room",
  "bromborough-rear-extension-loft",
  "chapel-to-gallery-conversion",
  "dormer-loft-conversion",
  "formby-rear-extension",
  "garage-conversion-boot-room",
  "garage-conversion-living-room",
  "greasby-rear-side-extension",
  "heswall-rear-extension-lantern",
  "heswall-rear-extension-pitched",
  "heswall-rear-extension-timber",
  "hoylake-rear-extension",
  "liscard-garage-conversion-kitchen",
  "liscard-rear-extension",
  "liscard-side-extension",
  "meols-loft-conversion",
  "meols-rear-extension",
  "neston-rear-extension",
  "new-brighton-first-floor-extension",
  "new-brighton-loft-conversion",
  "new-detached-house-design",
  "pharmacy-fit-out",
  "port-sunlight-measured-survey",
  "poulton-social-club",
  "prenton-rear-extension",
  "prenton-rear-extension-loft",
  "rear-dormer-loft-conversion",
  "rear-extension-garden-remodel",
  "rear-extension-roof-lantern",
  "single-storey-commercial-building",
  "single-storey-extension-roof-lantern",
  "wallasey-hmo-apartments",
  "wallasey-rear-extension",
  "wallasey-village-garage-conversion",
  "wallasey-village-loft-conversion",
  "wallasey-village-rear-extension-lootility",
  "wallasey-village-rear-extension-monopitch",
  "wallasey-village-rear-extension-open-plan",
  "wallasey-village-side-extension",
  "wallasey-village-side-rear-extension",
  "west-kirby-loft-conversion",
];

module.exports = { SERVICE_SLUGS, AREA_SLUGS, STAGES, IMAGE_KINDS, RESERVED_SLUGS };
