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

module.exports = { SERVICE_SLUGS, AREA_SLUGS, STAGES, IMAGE_KINDS };
