import { useState } from "react";
import {
  acceptProposal,
  deferProposal,
  outOfScopeProposal,
  rejectProposal,
  reviseProposal,
  type ProposalRecord,
} from "../api";

const STATE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  proposed: { bg: "var(--sf-surface-3)", color: "var(--sf-text-muted)", border: "var(--sf-border-strong)" },
  accepted: { bg: "var(--sf-success-soft)", color: "var(--sf-success)", border: "#86efac" },
  rejected: { bg: "var(--sf-error-soft)", color: "var(--sf-error)", border: "#fca5a5" },
  deferred: { bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  out_of_scope: { bg: "#f3e8ff", color: "#6b21a8", border: "#d8b4fe" },
  revised: { bg: "var(--sf-accent-soft)", color: "var(--sf-accent)", border: "var(--sf-accent-ring)" },
  promoted_to_scaffold: { bg: "var(--sf-accent-soft)", color: "var(--sf-accent)", border: "var(--sf-accent-ring)" },
};

interface ProposalCardProps {
  projectId: string;
  proposal: ProposalRecord;
  onUpdated: () => void;
}

export default function ProposalCard({ projectId, proposal, onUpdated }: ProposalCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateStyle = STATE_COLORS[proposal.state] ?? STATE_COLORS.proposed;
  const isFinal = ["accepted", "rejected", "deferred", "out_of_scope", "revised", "promoted_to_scaffold"].includes(
    proposal.state,
  );

  const runAction = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className="proposal-card"
      style={{ borderColor: stateStyle.border, background: stateStyle.bg }}
    >
      <header style={{ marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <h4 className="proposal-card__title">{proposal.title}</h4>
          <span
            className="proposal-card__badge"
            style={{
              background: stateStyle.bg,
              color: stateStyle.color,
              border: `1px solid ${stateStyle.border}`,
            }}
          >
            {proposal.state.replace(/_/g, " ")}
          </span>
          <span className="sf-muted" style={{ fontSize: "11px" }}>{proposal.kind}</span>
        </div>
        {proposal.summary && (
          <p style={{ margin: "6px 0 0", fontSize: "13px" }}>{proposal.summary}</p>
        )}
        {proposal.rationale && (
          <p className="sf-hint" style={{ marginTop: "4px" }}>
            Rationale: {proposal.rationale}
          </p>
        )}
      </header>

      {!isFinal && (
        <div className="proposal-card__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => runAction(() => acceptProposal(projectId, proposal.id))}
          >
            Accept
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => runAction(() => rejectProposal(projectId, proposal.id))}>
            Reject
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => runAction(() => deferProposal(projectId, proposal.id))}>
            Defer
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => runAction(() => outOfScopeProposal(projectId, proposal.id))}>
            Out of scope
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => runAction(() => reviseProposal(projectId, proposal.id))}>
            Revise
          </button>
        </div>
      )}

      {error && <p className="sf-error-text" style={{ marginTop: "8px" }}>{error}</p>}
    </article>
  );
}
