/** Sample LLM paste bundles for topic-scoped sessions (e2e / manual testing). */

export function sampleDecomposeBundle(parentId: string, parentSlug: string) {
  const suffix = Date.now().toString(36);
  const childId = `topic:signals-collector-${suffix}`;
  const childSlug = `${parentSlug}-signals-collector-${suffix}`;
  return {
    session_mode: "decompose",
    summary: "Two child topics under parent",
    proposals: [
      {
        kind: "create_component",
        title: "Signals Collector",
        summary: "Collects raw behavior signals",
        rationale: "Separates ingestion from analysis",
        topic_id: childId,
        proposed_changes: {
          area_slug: childSlug,
          topic_id: childId,
          title: "Signals Collector",
          level: "topic",
          parent_id: parentId,
        },
      },
    ],
  };
}

export function sampleLinkBundle(subjectId: string, dependsOnId: string) {
  return {
    session_mode: "link",
    summary: "Subject depends on prerequisite",
    proposals: [
      {
        kind: "add_dependency",
        title: "Subject depends on prerequisite",
        summary: "Needs upstream data first",
        rationale: "E2E test link",
        topic_id: subjectId,
        proposed_changes: {
          topic_id: subjectId,
          depends_on_id: dependsOnId,
        },
      },
    ],
  };
}
