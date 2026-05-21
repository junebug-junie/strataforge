import { useState } from "react";
import {
  acceptProposal,
  deferProposal,
  outOfScopeProposal,
  rejectProposal,
  type ProposalRecord,
} from "../api";

const STATE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  proposed: { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" },
  accepted: { bg: "#dcfce7", color: "#166534", border: "#86efac" },
  rejected: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  deferred: { bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  out_of_scope: { bg: "#f3e8ff", color: "#6b21a8", border: "#d8b4fe" },
  revised: { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
  promoted_to_scaffold: { bg: "#e0e7ff", color: "#3730a3", border: "#a5b4fc" },
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
  const isFinal = ["accepted", "rejected", "deferred", "out_of_scope", "promoted_to_scaffold"].includes(
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
      style={{
        border: `1px solid ${stateStyle.border}`,
        borderRadius: "8px",
        padding: "12px",
        marginBottom: "10px",
        background: "#fff",
      }}
    >
      <header style={{ marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>{proposal.title}</h4>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: stateStyle.bg,
              color: stateStyle.color,
              border: `1px solid ${stateStyle.border}`,
            }}
          >
            {proposal.state.replace(/_/g, " ")}
          </span>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>{proposal.kind}</span>
        </div>
        {proposal.summary && (
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151" }}>{proposal.summary}</p>
        )}
        {proposal.rationale && (
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280" }}>
            Rationale: {proposal.rationale}
          </p>
        )}
      </header>

      {!isFinal && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction(() => acceptProposal(projectId, proposal.id))}
            style={{ padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction(() => rejectProposal(projectId, proposal.id))}
            style={{ padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction(() => deferProposal(projectId, proposal.id))}
            style={{ padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}
          >
            Defer
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction(() => outOfScopeProposal(projectId, proposal.id))}
            style={{ padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}
          >
            Out of scope
          </button>
        </div>
      )}

      {error && (
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#b91c1c" }}>{error}</p>
      )}
    </article>
  );
}
