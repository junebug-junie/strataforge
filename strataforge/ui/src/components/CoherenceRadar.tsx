import { useCallback, useEffect, useState } from "react";
import { listRadar, scanRadar, type RadarItem } from "../api";

const SEVERITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  high: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  medium: { bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  low: { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" },
};

interface CoherenceRadarProps {
  projectId: string;
  onSelectTopic: (topicId: string) => void;
}

export default function CoherenceRadar({ projectId, onSelectTopic }: CoherenceRadarProps) {
  const [items, setItems] = useState<RadarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setError(null);
    return listRadar(projectId)
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listRadar(projectId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleScan = async () => {
    setError(null);
    setScanning(true);
    try {
      const data = await scanRadar(projectId);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Coherence Radar</h2>
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning || loading}
          style={{
            padding: "4px 8px",
            fontSize: "12px",
            cursor: scanning || loading ? "not-allowed" : "pointer",
          }}
        >
          {scanning ? "Scanning…" : "Scan"}
        </button>
      </div>

      <p style={{ margin: "8px 0 12px", fontSize: "12px", color: "#6b7280" }}>Needs attention</p>

      {loading && <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Loading radar…</p>}

      {error && (
        <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#b91c1c" }}>{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
          No findings. Run Scan to refresh the queue.
        </p>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => {
          const severityStyle = SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.low;
          return (
            <li key={item.id} style={{ marginBottom: "10px" }}>
              <button
                type="button"
                onClick={() => onSelectTopic(item.topic_id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: `1px solid ${severityStyle.border}`,
                  borderRadius: "8px",
                  padding: "10px",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "13px" }}>{item.title}</strong>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: severityStyle.bg,
                      color: severityStyle.color,
                      border: `1px solid ${severityStyle.border}`,
                    }}
                  >
                    {item.severity}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#4b5563", lineHeight: 1.4 }}>
                  {item.summary}
                </p>
                {item.recommended_commands.length > 0 && (
                  <ul
                    style={{
                      margin: "6px 0 0",
                      paddingLeft: "16px",
                      fontSize: "11px",
                      color: "#6b7280",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {item.recommended_commands.map((cmd) => (
                      <li key={cmd}>{cmd}</li>
                    ))}
                  </ul>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {!loading && items.length > 0 && (
        <button
          type="button"
          onClick={() => void refresh()}
          style={{ marginTop: "4px", fontSize: "12px", padding: "4px 8px" }}
        >
          Refresh
        </button>
      )}
    </div>
  );
}
