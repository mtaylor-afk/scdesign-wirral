import { stageLabel, type ProjectStage } from "@/lib/projects";

/**
 * Honest status pill for a case study — "Completed", "Under construction",
 * "In planning" or "Concept design". Colour is never the only signal: the label
 * always reads in words, so it works without colour vision or CSS.
 */
const tones: Record<ProjectStage, string> = {
  completed: "bg-success/12 text-success",
  "under-construction": "bg-gold/15 text-ink",
  "in-planning": "bg-accent-soft text-accent-strong",
  concept: "bg-mist text-ink-soft",
};

export function StageBadge({
  stage = "completed",
  className = "",
}: {
  stage?: ProjectStage;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${tones[stage]} ${className}`}
    >
      {stageLabel[stage]}
    </span>
  );
}
