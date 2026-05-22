import { useEffect, useState } from "react";
import { getLlmStatus, type LlmStatus } from "../api";

export default function LlmStatusBanner() {
  const [status, setStatus] = useState<LlmStatus | null>(null);

  useEffect(() => {
    getLlmStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  if (status.configured) {
    return (
      <div className="llm-status-banner llm-status-banner--on" data-testid="llm-status-on">
        LLM connected · <strong>{status.model}</strong>
      </div>
    );
  }

  return (
    <div className="llm-status-banner llm-status-banner--off" data-testid="llm-status-off">
      Manual paste mode — set <code className="sf-code">OPENAI_API_KEY</code> and{" "}
      <code className="sf-code">STRATA_LLM_PROVIDER=openai</code> in <code className="sf-code">.env</code>, then
      restart the API.
    </div>
  );
}
