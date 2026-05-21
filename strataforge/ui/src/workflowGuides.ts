/** Copy for explicit HITL workflow callouts (manual paste ↔ external LLM). */

export type WorkflowPhase = "strataforge" | "external" | "return";

export interface WorkflowStep {
  phase: WorkflowPhase;
  title: string;
  detail: string;
}

export interface WorkflowOption {
  action: string;
  useWhen: string;
  /** Short path: where copy happens and what you paste back */
  path: string;
  needsExternalLlm: boolean;
}

export const PHASE_LABELS: Record<WorkflowPhase, string> = {
  strataforge: "In StrataForge",
  external: "External LLM",
  return: "Back in StrataForge",
};

export const INTAKE_WORKFLOW: WorkflowStep[] = [
  {
    phase: "strataforge",
    title: "Describe your architecture",
    detail: "Type your idea in step 1 below. StrataForge saves it on the session.",
  },
  {
    phase: "strataforge",
    title: "Copy the augmented prompt",
    detail: "Step 2 builds a full prompt (your idea + project context + JSON rules). Click Copy augmented prompt.",
  },
  {
    phase: "external",
    title: "Paste into ChatGPT, Claude, or similar",
    detail: "Open your LLM in another tab or app. Paste the prompt, send it, and wait for the full reply.",
  },
  {
    phase: "return",
    title: "Paste the LLM reply here",
    detail: "Copy the model's entire answer into step 3 (```json fences are OK). Click Import proposals.",
  },
  {
    phase: "strataforge",
    title: "Review gates, then Apply",
    detail: "Accept or reject each proposal card, then Apply session to write topics to disk and populate the Atlas.",
  },
];

export const ATLAS_AFTER_INTAKE: WorkflowStep[] = [
  {
    phase: "strataforge",
    title: "Pick a topic in the Atlas",
    detail: "Each pill is a durable area. Click one to open its workspace (not the old intake cards).",
  },
  {
    phase: "strataforge",
    title: "Design in the topic workspace",
    detail: "Use Expand / Decompose / Add link — most actions copy a prompt for your external LLM.",
  },
];

export const TOPIC_ACTION_OPTIONS: WorkflowOption[] = [
  {
    action: "Expand",
    useWhen: "Topic is scaffolded; you want purpose, boundary, and open questions filled in.",
    path: "Copy prompt → external LLM → edit topic body manually (or paste sections into the markdown file).",
    needsExternalLlm: true,
  },
  {
    action: "Decompose",
    useWhen: "This area should split into child topics (tree / containment).",
    path: "Opens session below → copy decompose prompt → external LLM → paste JSON → Accept all → Apply.",
    needsExternalLlm: true,
  },
  {
    action: "Add link",
    useWhen: "This topic depends on, feeds into, or blocks another (graph edges, not parent/child).",
    path: "Opens session below → copy link prompt → external LLM → paste JSON → Accept all → Apply.",
    needsExternalLlm: true,
  },
  {
    action: "Boundary check",
    useWhen: "You want the LLM to challenge scope creep before expanding further.",
    path: "Copy prompt → external LLM → use the critique in your head or notes (no import step).",
    needsExternalLlm: true,
  },
];

export const DECOMPOSE_WORKFLOW: WorkflowStep[] = [
  {
    phase: "strataforge",
    title: "Prompt copied when panel opens",
    detail: "If copy failed, use Copy decompose prompt below.",
  },
  {
    phase: "external",
    title: "Paste into your LLM",
    detail: "Ask for child topic proposals as JSON only (session_mode: decompose).",
  },
  {
    phase: "return",
    title: "Paste JSON → Import → Accept all → Apply",
    detail: "Apply writes child topics under this parent. They appear in Atlas and Local graph.",
  },
];

export const LINK_WORKFLOW: WorkflowStep[] = [
  {
    phase: "strataforge",
    title: "Prompt copied when panel opens",
    detail: "If copy failed, use Copy link prompt below.",
  },
  {
    phase: "external",
    title: "Paste into your LLM",
    detail: "Propose depends_on / feeds_into / blocks between existing topic IDs.",
  },
  {
    phase: "return",
    title: "Paste JSON → Import → Accept all → Apply",
    detail: "Apply updates topic YAML links. Check Structure panel for Depends on / Feeds into.",
  },
];
