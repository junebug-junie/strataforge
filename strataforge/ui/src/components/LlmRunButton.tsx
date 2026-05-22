import { useCallback, useEffect, useState } from "react";
import { getLlmStatus, type LlmStatus } from "../api";

interface LlmRunButtonProps {
  onRun: () => Promise<void>;
  disabled?: boolean;
  label?: string;
  runningLabel?: string;
  testId?: string;
  variant?: "primary" | "default";
}

export function useLlmAvailable() {
  const [status, setStatus] = useState<LlmStatus | null>(null);

  useEffect(() => {
    getLlmStatus()
      .then(setStatus)
      .catch(() => setStatus({ configured: false, provider: "manual", model: "", base_url: "" }));
  }, []);

  return status;
}

export default function LlmRunButton({
  onRun,
  disabled = false,
  label = "Run with LLM",
  runningLabel = "Running…",
  testId = "run-llm",
  variant = "default",
}: LlmRunButtonProps) {
  const status = useLlmAvailable();
  const [running, setRunning] = useState(false);

  const handleClick = useCallback(async () => {
    setRunning(true);
    try {
      await onRun();
    } finally {
      setRunning(false);
    }
  }, [onRun]);

  if (!status?.configured) {
    return null;
  }

  return (
    <button
      type="button"
      data-testid={testId}
      className={variant === "primary" ? "btn btn--primary" : "btn"}
      disabled={disabled || running}
      onClick={() => void handleClick()}
      title={`Uses ${status.model} via API`}
    >
      {running ? runningLabel : label}
    </button>
  );
}
