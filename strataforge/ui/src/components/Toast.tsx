import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastKind = "info" | "success" | "error";

interface ToastState {
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((message: string, kind: ToastKind = "info") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div
          role="status"
          className={`app-toast app-toast--${toast.kind}`}
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            maxWidth: "min(90vw, 480px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            background:
              toast.kind === "error" ? "#fef2f2" : toast.kind === "success" ? "#ecfdf5" : "#eff6ff",
            color:
              toast.kind === "error" ? "#b91c1c" : toast.kind === "success" ? "#047857" : "#1e40af",
            border: `1px solid ${
              toast.kind === "error" ? "#fecaca" : toast.kind === "success" ? "#a7f3d0" : "#bfdbfe"
            }`,
          }}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
