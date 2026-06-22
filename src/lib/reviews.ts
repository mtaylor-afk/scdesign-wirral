/**
 * Genuine Google reviews for SC Design & Construction Ltd, captured verbatim from
 * the live Google Business Profile on 2026-06-22 (5.0 average, 30 reviews — all
 * five-star). Displayed with attribution and a link to Google for validation.
 *
 * We deliberately do NOT emit Review / AggregateRating JSON-LD: Google disallows
 * self-hosted structured data for a business's own reviews about itself, even when
 * genuine (https://developers.google.com/search/docs/appearance/structured-data/
 * review-snippet#guidelines). These are shown as visible testimonials only, with a
 * live link to the Google profile so anyone can verify them.
 *
 * To refresh: re-read the Google profile and update the array + `count`. For
 * always-live cards instead, set NEXT_PUBLIC_FEATURABLE_WIDGET_ID (ReviewsWidget).
 *
 * One genuine reviewer sharing Sean's surname is intentionally omitted here to
 * avoid any appearance of a self-review.
 */
import { site } from "./site";

export const reviewSummary = {
  rating: 5.0,
  count: 30,
  source: "Google",
  url: site.googleReviewUrl,
  capturedOn: "2026-06-22",
} as const;

export type Review = {
  author: string;
  text: string;
  /** Small, accurate context — only used where the reviewer states it. */
  tag?: string;
};

/** Curated genuine reviews (verbatim). First three are featured on the homepage. */
export const reviews: Review[] = [
  {
    author: "Liam Wild",
    text: "Used Sean for the first time after a recommendation from a close friend and I couldn't be happier. Honest, hard working lad who has made our build and design smooth and effortless. Will be recommending him to everyone. Thank you so much Sean.",
  },
  {
    author: "Ray Dyer",
    tag: "Builder",
    text: "I used Sean a couple of years ago for a small scale rear extension. His drawings are extremely readable so for me as a builder it made the job run smoothly and more important the ordering of materials was clear. Since then I always use Sean for small scale and large scale projects.",
  },
  {
    author: "David Morley",
    text: "Would highly recommend. From initial briefing to completion of the drawing pack Sean was outstanding with his knowledge. Would use again in a heartbeat.",
  },
  {
    author: "Ryan Hirst",
    tag: "Extension",
    text: "Sean designed my extension. Not only did Sean design my extension but he gave me great advice and how to get the best from the extension and internal layout. I would highly recommend Sean for an architectural design works.",
  },
  {
    author: "Lee Davey",
    tag: "Builder",
    text: "As a builder I came across Sean's drawings from a customer. Since then I've used Sean for all my extension and conversion works as the quality of his drawings are clear and precise which results in less problems on the job.",
  },
  {
    author: "Graham Edge",
    tag: "Extension & loft",
    text: "I got Sean to do a double rear extension on my property and eventually a loft conversion. As always the communication between him and the builders can't be faulted, had no issues with the process as the project ran smoothly.",
  },
  {
    author: "Paul Crosthwaite",
    text: "Top guy. Was very responsive throughout. Design was perfect and recommended which builders we should use. Project went extremely smoothly. Will definitely be using him again and would recommend him to everyone.",
  },
  {
    author: "Kieran McGonigle",
    tag: "Loft & extension",
    text: "Got Sean's number through a friend, he done a brilliant job on his house with a loft conversion and done a brilliant job on my extension.",
  },
  {
    author: "Fred Hobbs",
    tag: "Wallasey",
    text: "Would happily recommend to anyone looking at a home extension or renovation in Wallasey or the wider area.",
  },
  {
    author: "Ian Turner",
    text: "Sean designed an extension to my house recently. Full of good ideas and provided an excellent service.",
  },
  {
    author: "Paul Turner",
    text: "Sean always has great delivery and attention to detail. Worked with him for years and will do in the future.",
  },
  {
    author: "Paul Agnew",
    text: "Worked with Sean for years, always delivers on time and to a high standard.",
  },
  {
    author: "Richard Pugh",
    text: "Highly recommend, great service, reliable guy, would definitely use again.",
  },
  {
    author: "Chris Jones",
    text: "Sean is professional and provides a great service. Thank you Sean!",
  },
];
