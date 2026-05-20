import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { logger } from './logger';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  show: (kind: ToastKind, message: string) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLES: Record<ToastKind, { bg: string; icon: string; text: string }> = {
  success: { bg: 'bg-emerald-50 border-emerald-200', icon: 'ri-check-line text-emerald-600', text: 'text-emerald-800' },
  error:   { bg: 'bg-rose-50 border-rose-200',     icon: 'ri-error-warning-line text-rose-600', text: 'text-rose-800' },
  info:    { bg: 'bg-sky-50 border-sky-200',       icon: 'ri-information-line text-sky-600', text: 'text-sky-800' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => remove(id), 4000);
  }, [remove]);

  const api: ToastApi = {
    show,
    success: (m) => show('success', m),
    error:   (m) => show('error', m),
    info:    (m) => show('info', m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        {toasts.map((t) => {
          const s = KIND_STYLES[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-md ${s.bg}`}
            >
              <i className={`${s.icon} text-base mt-0.5`}></i>
              <p className={`text-sm leading-snug flex-1 ${s.text}`}>{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="text-slate-400 hover:text-slate-600 -mr-1"
                aria-label="Fermer"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Soft fallback so a missing provider does not crash the page -
    // returns a no-op API and logs once for diagnostics.
    if (typeof window !== 'undefined' && !(window as { __toastWarned?: boolean }).__toastWarned) {
      (window as { __toastWarned?: boolean }).__toastWarned = true;
      logger.warn('useToast called outside ToastProvider - falling back to no-op.');
    }
    const noop: ToastApi = {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
    return noop;
  }
  return ctx;
}

// Hook to bridge old code paths that throw uncaught errors - show them as toast.
export function useGlobalErrorToast() {
  const toast = useToast();
  useEffect(() => {
    const onError = (e: ErrorEvent) => toast.error(e.message || 'Une erreur est survenue.');
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = (e.reason as { message?: string })?.message || 'Une erreur est survenue.';
      toast.error(msg);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [toast]);
}
