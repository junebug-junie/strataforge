import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "info" | "success" | "error";

interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seqRef = useRef(0);

  const notify = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++seqRef.current;
    setToast({ id, message, kind });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div
          role="status"
          data-testid="app-toast"
          className={`app-toast app-toast--${toast.kind}`}
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
