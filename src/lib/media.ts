/**
 * Site imagery, labelled by kind so a render is NEVER presented as a completed
 * build: "photo" (real photograph), "drawing" (Sean's drawings), "render"
 * (design visualisation). Brief images come from the generated work-images.ts;
 * the June 2026 portfolio renders are declared here with their real sizes.
 */
import { wi, type WorkImage } from "./work-images";

export type { WorkImage } from "./work-images";
export { wi, kindLabel } from "./work-images";

/** Existing /portfolio assets (June 2026) — Sean's renders + the hero pair. */
export const portfolioImages = {
  heroBefore: {
    src: "/portfolio/hero-before.jpg",
    width: 708,
    height: 531,
    kind: "photo",
    alt: "Rear of a Wirral semi-detached home before its redesign",
  },
  heroAfter: {
    src: "/portfolio/hero-after.jpg",
    width: 717,
    height: 537,
    kind: "render",
    alt: "Design visualisation of the same home with a single-storey rear extension",
  },
  gardenRoom: {
    src: "/portfolio/viz-garden-extension.jpg",
    width: 896,
    height: 598,
    kind: "render",
    alt: "Design visualisation of a brick garden room extension with a gabled glazed end",
  },
  lanternExtension: {
    src: "/portfolio/viz-lantern-extension.jpg",
    width: 1000,
    height: 633,
    kind: "render",
    alt: "Design visualisation of a rear extension with a roof lantern",
  },
  chapelGallery: {
    src: "/portfolio/viz-concept-a.jpg",
    width: 696,
    height: 674,
    kind: "render",
    alt: "Design visualisation of a former chapel converted into an art gallery",
  },
} satisfies Record<string, WorkImage>;

type ServiceMedia = { card?: WorkImage; gallery?: WorkImage[] };

/**
 * Per-service card image + "Examples of this work" gallery (keyed by service
 * slug). Kept here rather than in services.ts so content copy and imagery can be
 * edited independently. Only genuine SC work is used.
 */
export const serviceMedia: Record<string, ServiceMedia> = {
  "house-extensions": {
    card: wi("extRearPebbledash"),
    gallery: [
      wi("extRearPebbledash", "Completed single-storey rear extension"),
      wi("extLanternAfter", "Completed extension with roof lantern"),
      wi("extLanternDrawing", "Proposed rear elevation for the same extension"),
      wi("extCorner", "Newly built rear extension"),
      wi("heroDuring", "Rear extension during the build"),
      wi("vizBifold", "Design visualisation — rear extension with bi-folds"),
    ],
  },
  "loft-conversions": {
    card: wi("loftDormerAfter"),
    gallery: [
      wi("loftDormerAfter", "Completed dormer loft conversion"),
      wi("loftDormerDrawing", "Proposed elevation for a dormer loft conversion"),
      wi("loftTileHung", "Completed tile-hung dormer"),
      wi("loftTimberClad", "Completed timber-clad dormer"),
      wi("loftRear", "Completed rear loft conversion"),
      wi("loftRearDormerDrawing", "Proposed rear dormer with Juliet balconies"),
    ],
  },
  "garage-conversion-drawings-wirral": {
    card: wi("garage1After"),
    gallery: [
      wi("garage1BeforeInterior", "Before — the garage as it was"),
      wi("garage1During", "During — the new room taking shape"),
      wi("garage1AfterInterior", "After — the finished room"),
      wi("garage1After", "After — new window in place of the garage door"),
      wi("garage2After", "Garage conversion with extended porch canopy"),
      wi("garage2Interior", "Converted garage fitted out as a boot room"),
    ],
  },
  "front-porch-extension-design": {
    card: wi("garage2After"),
    gallery: [wi("garage2After", "New porch canopy running across the frontage")],
  },
  "bespoke-garden-room-design": {
    card: portfolioImages.gardenRoom,
    gallery: [
      { ...portfolioImages.gardenRoom, caption: "Design visualisation — brick garden room" },
      wi("vizTimberClad", "Design visualisation — timber-clad garden building"),
    ],
  },
  "planning-drawings-wirral": {
    card: wi("planningElevations"),
    gallery: [
      wi("planningElevations", "Coloured proposed elevations for a planning application"),
      wi("extLanternDrawing", "Proposed rear elevation — single-storey extension"),
      wi("loftDormerDrawing", "Proposed elevation — dormer loft conversion"),
      wi("houseFrontSide", "Front and side elevations — new detached house"),
    ],
  },
  "building-regulations-drawings-wirral": {
    card: wi("houseSectionsAB"),
    gallery: [
      wi("houseSectionsAB", "Sections showing construction and levels"),
      wi("houseSectionsCF", "Further construction sections"),
      wi("houseFloorPlan", "Ground-floor plan with wall key and specification"),
      wi("loftRearDormerDrawing", "Loft elevation with numbered specification notes"),
    ],
  },
  "residential-design": {
    card: wi("houseRearSide"),
    gallery: [
      wi("houseSketchViews", "3D line views — new detached house"),
      wi("houseFrontSide", "Front and side elevations"),
      wi("houseRearSide", "Rear and side elevations"),
      wi("houseFloorPlan", "Ground-floor plan"),
      wi("houseRoofPlan", "Roof plan"),
      wi("houseSectionsAB", "Sections"),
    ],
  },
  "change-of-use-applications": {
    card: portfolioImages.chapelGallery,
    gallery: [
      { ...portfolioImages.chapelGallery, caption: "Design visualisation — chapel to art gallery" },
      wi("chapelRender", "Design render of the same conversion"),
    ],
  },
  "measured-building-surveys": {
    card: wi("houseRoofPlan"),
  },
  "concept-design-feasibility": {
    card: wi("houseSketchViews"),
    gallery: [
      wi("houseSketchViews", "Early 3D line views to test the massing"),
      wi("vizFlatRoofLantern", "Design visualisation — flat-roof extension option"),
      wi("vizBifold", "Design visualisation — open-plan rear extension option"),
    ],
  },
};

export function getServiceMedia(slug: string): ServiceMedia {
  return serviceMedia[slug] ?? {};
}
