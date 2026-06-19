/**
 * Interactive-house feature content for the Homeowners Guide.
 *
 * Each feature is a clickable hotspot on a simple house illustration. The copy is
 * a SHORT "do I need permission?" summary with the key permitted-development (PD)
 * limits, deliberately HEDGED — England only, "often/usually/may", "confirm with
 * your local planning authority". Never a guarantee. Every entry links to the
 * relevant Planning Portal page for the authoritative detail.
 *
 * ⚠️ Scope: England. PD rules differ in Wales (Sean covers North Wales) — the
 * page carries a clear "Wales differs — get in touch" note.
 */

export type HouseView = "front" | "rear";

export type FeatureId =
  | "front-porch"
  | "front-dormer"
  | "garage-conversion"
  | "new-garage"
  | "side-extension"
  | "rear-dormer"
  | "rear-extension-single"
  | "rear-extension-two-storey"
  | "garden-room";

export type HouseFeature = {
  id: FeatureId;
  label: string;
  view: HouseView;
  /** Hotspot position as a percentage of the illustration box (left/top). */
  pos: { x: number; y: number };
  /** One-line plain-English headline. */
  headline: string;
  /** 2–3 sentence "do I need permission?" summary with key PD limits (hedged). */
  summary: string;
  /** Building-control note. */
  buildingRegs: string;
  /** Authoritative Planning Portal page. */
  planningPortalUrl: string;
  /** Related SC service slug for the CTA. */
  service: string;
};

export const houseFeatures: Record<FeatureId, HouseFeature> = {
  "front-porch": {
    id: "front-porch",
    label: "Front porch",
    view: "front",
    pos: { x: 38, y: 72 },
    headline: "Often permitted development — within limits",
    summary:
      "A small front porch is often permitted development, so a full planning application may not be needed. As a guide the external ground-floor area usually can't exceed 3m², no part can be higher than 3m, and no part can sit within 2m of a boundary fronting a highway. Flats, conservation areas and homes with an Article 4 direction can differ — always confirm with your council.",
    buildingRegs:
      "Porches are often exempt from building regulations if under 30m², at ground level, the existing front door stays, and any glazing meets safety rules.",
    planningPortalUrl: "https://www.planningportal.co.uk/permission/common-projects/porches",
    service: "front-porch-extension-design",
  },
  "front-dormer": {
    id: "front-dormer",
    label: "Front dormer / loft window",
    view: "front",
    pos: { x: 50, y: 26 },
    headline: "A front-facing dormer usually needs planning permission",
    summary:
      "Dormers that face a highway (typically the front roof slope) are usually NOT permitted development and need a full planning application. Rooflights that don't project beyond the roof plane may be permitted within limits. Conservation areas and Article 4 directions restrict this further — confirm with your council.",
    buildingRegs:
      "A habitable loft conversion always needs building-regulations approval (structure, fire safety/escape, stairs, insulation).",
    planningPortalUrl:
      "https://www.planningportal.co.uk/permission/common-projects/loft-conversion-or-dormer",
    service: "loft-conversions",
  },
  "garage-conversion": {
    id: "garage-conversion",
    label: "Garage conversion",
    view: "front",
    pos: { x: 22, y: 70 },
    headline: "Often permitted development if it stays within the structure",
    summary:
      "Converting a garage into a habitable room within the existing walls is often permitted development. Replacing the garage door with a window or wall changes the frontage, which can need permission, and some areas have Article 4 directions removing these rights. Confirm with your council.",
    buildingRegs:
      "Garage conversions need building-regulations approval — insulation, damp-proofing, floor levels, ventilation and fire separation.",
    planningPortalUrl: "https://www.planningportal.co.uk/permission/common-projects/garage-conversion",
    service: "garage-conversion-drawings-wirral",
  },
  "new-garage": {
    id: "new-garage",
    label: "New garage / outbuilding",
    view: "front",
    pos: { x: 14, y: 58 },
    headline: "Often permitted development as an outbuilding",
    summary:
      "A new garage is treated as an outbuilding and is often permitted development if it's single storey (max eaves 2.5m; max height 4m dual-pitched / 3m otherwise / 2.5m within 2m of a boundary), not forward of the principal elevation, and outbuildings don't cover more than 50% of the garden. Designated land and Article 4 areas differ — confirm with your council.",
    buildingRegs:
      "A detached garage under 30m² with no sleeping accommodation is often exempt, subject to its distance from boundaries and the materials used.",
    planningPortalUrl: "https://www.planningportal.co.uk/permission/common-projects/outbuildings",
    service: "residential-design",
  },
  "side-extension": {
    id: "side-extension",
    label: "Side extension",
    view: "front",
    pos: { x: 78, y: 64 },
    headline: "Single-storey can be PD; two-storey usually needs permission",
    summary:
      "A single-storey side extension can be permitted development if it's no more than half the width of the original house, single storey with a max height of 4m, and within other limits. Two-storey side extensions, and homes on designated land, usually need a full planning application. Confirm with your council.",
    buildingRegs: "Side extensions need building-regulations approval.",
    planningPortalUrl: "https://www.planningportal.co.uk/permission/common-projects/extensions",
    service: "house-extensions",
  },
  "rear-dormer": {
    id: "rear-dormer",
    label: "Rear dormer",
    view: "rear",
    pos: { x: 52, y: 24 },
    headline: "Often permitted development within volume limits",
    summary:
      "A rear dormer is often permitted development if the added roof volume stays within 40m³ (terrace) or 50m³ (semi-detached/detached), it isn't higher than the existing ridge, and it's set back from the eaves. Conservation areas and Article 4 directions can remove these rights — confirm with your council.",
    buildingRegs:
      "A habitable loft conversion always needs building-regulations approval (structure, fire safety, stairs, insulation).",
    planningPortalUrl:
      "https://www.planningportal.co.uk/permission/common-projects/loft-conversion-or-dormer",
    service: "loft-conversions",
  },
  "rear-extension-single": {
    id: "rear-extension-single",
    label: "Single-storey rear extension",
    view: "rear",
    pos: { x: 32, y: 68 },
    headline: "Often PD — larger ones need prior approval",
    summary:
      "A single-storey rear extension is often permitted development up to 3m deep (semi/terrace) or 4m (detached). Larger ones — up to 6m or 8m — can be allowed under the Larger Home Extension 'prior approval' route, where the council notifies neighbours first. Limits on height and coverage apply, and designated land is treated differently. Confirm with your council.",
    buildingRegs: "All rear extensions need building-regulations approval.",
    planningPortalUrl: "https://www.planningportal.co.uk/permission/common-projects/extensions",
    service: "house-extensions",
  },
  "rear-extension-two-storey": {
    id: "rear-extension-two-storey",
    label: "Two-storey rear extension",
    view: "rear",
    pos: { x: 64, y: 56 },
    headline: "Can be PD up to 3m — beyond that needs permission",
    summary:
      "A two-storey rear extension can be permitted development if it extends no more than 3m, is at least 7m from the rear boundary, and meets height and design limits. Anything larger, and homes on designated land, need a full planning application. Confirm with your council.",
    buildingRegs: "Two-storey extensions need building-regulations approval, usually with a structural engineer's calculations.",
    planningPortalUrl: "https://www.planningportal.co.uk/permission/common-projects/extensions",
    service: "house-extensions",
  },
  "garden-room": {
    id: "garden-room",
    label: "Garden room / studio",
    view: "rear",
    pos: { x: 86, y: 74 },
    headline: "Often PD as an outbuilding — not for sleeping",
    summary:
      "A garden room used incidentally (office, gym, studio) is often permitted development within the outbuilding limits — single storey, max eaves 2.5m, max height 4m/3m (or 2.5m within 2m of a boundary), and not covering more than 50% of the garden. A garden room used for sleeping or as self-contained living is NOT incidental and needs planning permission. Confirm with your council.",
    buildingRegs:
      "Small garden rooms are often exempt, but larger ones (over ~15–30m² depending on use and boundaries) or any with habitable/sleeping use need building-regulations approval.",
    planningPortalUrl: "https://www.planningportal.co.uk/permission/common-projects/outbuildings",
    service: "bespoke-garden-room-design",
  },
};

export const featureOrder: FeatureId[] = [
  "front-porch",
  "front-dormer",
  "garage-conversion",
  "new-garage",
  "side-extension",
  "rear-dormer",
  "rear-extension-single",
  "rear-extension-two-storey",
  "garden-room",
];
