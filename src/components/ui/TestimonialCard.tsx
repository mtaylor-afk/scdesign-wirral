import { Card } from "./index";

/**
 * Testimonial card. NOTE: no testimonials are shown anywhere by default — real,
 * permissioned client reviews must be supplied before any are displayed. This
 * component exists so approved reviews can be dropped in without rework.
 */
export function TestimonialCard({
  quote,
  name,
  context,
}: {
  quote: string;
  name: string;
  context?: string;
}) {
  return (
    <Card className="flex h-full flex-col">
      <p className="flex-1 text-pretty text-lg text-ink">“{quote}”</p>
      <footer className="mt-5 text-sm">
        <span className="font-medium text-ink">{name}</span>
        {context && <span className="text-muted"> · {context}</span>}
      </footer>
    </Card>
  );
}
