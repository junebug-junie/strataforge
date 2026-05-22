import type { ReactNode } from "react";
import {
  PHASE_LABELS,
  type WorkflowOption,
  type WorkflowPhase,
  type WorkflowStep,
} from "../workflowGuides";

export function PhaseBadge({ phase }: { phase: WorkflowPhase }) {
  return <span className={`workflow-phase workflow-phase--${phase}`}>{PHASE_LABELS[phase]}</span>;
}

interface WorkflowCalloutProps {
  title: string;
  summary?: string;
  steps?: WorkflowStep[];
  options?: WorkflowOption[];
  footer?: ReactNode;
  /** data-testid for e2e */
  testId?: string;
  compact?: boolean;
}

export default function WorkflowCallout({
  title,
  summary,
  steps,
  options,
  footer,
  testId,
  compact = false,
}: WorkflowCalloutProps) {
  return (
    <aside
      className={`workflow-callout${compact ? " workflow-callout--compact" : ""}`}
      data-testid={testId}
      aria-label={title}
    >
      <div className="workflow-callout__header">
        <span className="workflow-callout__icon" aria-hidden>
          ↻
        </span>
        <div>
          <h3 className="workflow-callout__title">{title}</h3>
          {summary && <p className="workflow-callout__summary">{summary}</p>}
        </div>
      </div>

      {steps && steps.length > 0 && (
        <ol className="workflow-steps">
          {steps.map((step, i) => (
            <li key={`${step.phase}-${step.title}`} className="workflow-step">
              <div className="workflow-step__meta">
                <span className="workflow-step__num">{i + 1}</span>
                <PhaseBadge phase={step.phase} />
              </div>
              <div className="workflow-step__body">
                <strong className="workflow-step__title">{step.title}</strong>
                <p className="workflow-step__detail">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {options && options.length > 0 && (
        <div className="workflow-options">
          <p className="workflow-options__heading">Your options on this topic</p>
          <ul className="workflow-options__list">
            {options.map((opt) => (
              <li key={opt.action} className="workflow-option">
                <div className="workflow-option__head">
                  <strong>{opt.action}</strong>
                  {opt.needsExternalLlm && (
                    <span className="workflow-option__tag">uses external LLM</span>
                  )}
                </div>
                <p className="workflow-option__when">
                  <span className="workflow-option__label">When:</span> {opt.useWhen}
                </p>
                <p className="workflow-option__path">
                  <span className="workflow-option__label">Flow:</span> {opt.path}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {footer && <div className="workflow-callout__footer">{footer}</div>}
    </aside>
  );
}

/** Inline hint next to a form section */
export function SectionPhaseHint({ phase, text }: { phase: WorkflowPhase; text?: string }) {
  return (
    <span className="section-phase-hint">
      <PhaseBadge phase={phase} />
      {text && <span className="section-phase-hint__text">{text}</span>}
    </span>
  );
}
