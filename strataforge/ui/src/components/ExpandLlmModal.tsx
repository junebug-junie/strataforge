import { useState } from "react";

interface ExpandLlmModalProps {
  text: string;
  onClose: () => void;
  onApply: (text: string) => Promise<void>;
}

export default function ExpandLlmModal({ text, onClose, onApply }: ExpandLlmModalProps) {
  const [draft, setDraft] = useState(text);
  const [busy, setBusy] = useState(false);

  return (
    <div className="llm-modal-backdrop" role="dialog" aria-modal="true" data-testid="expand-llm-modal">
      <div className="llm-modal">
        <header className="llm-modal__header">
          <h3>Expansion result</h3>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="sf-hint">Edit if needed, then save to the topic body.</p>
        <textarea
          className="sf-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          style={{ minHeight: "240px" }}
        />
        <div className="btn-group" style={{ marginTop: "12px" }}>
          <button
            type="button"
            className="btn btn--primary"
            data-testid="apply-expand-body"
            disabled={busy || !draft.trim()}
            onClick={() => {
              setBusy(true);
              void onApply(draft).finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Save to topic body"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
