export const SAMPLE_INTAKE_BUNDLE = {
  session_mode: "intake",
  summary: "Sample architecture decomposition",
  proposals: [
    {
      kind: "create_component",
      title: "Session Runtime",
      summary: "Gated design sessions",
      rationale: "Core HITL loop",
      proposed_changes: {
        area_slug: "01-session-runtime",
        topic_id: "topic:session-runtime",
        title: "Session Runtime",
        level: "area",
      },
    },
    {
      kind: "create_component",
      title: "Topic Scaffold Store",
      summary: "File-backed topic store",
      rationale: "Source of truth for atlas",
      proposed_changes: {
        area_slug: "02-topic-store",
        topic_id: "topic:topic-store",
        title: "Topic Scaffold Store",
        level: "area",
      },
    },
  ],
} as const;
