import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineX } from 'react-icons/hi';

type Kind = 'success' | 'error';
interface Toast { id: number; kind: Kind; message: string }
interface ToastApi { success: (m: string) => void; error: (m: string) => void }

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: Kind, message: string) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500);
  }, [dismiss]);
  const [api] = useState<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  }));

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:w-96" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`animate-toast-in flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lift text-sm ${
              t.kind === 'error' ? 'border-danger-600/20 bg-danger-50 text-danger-600' : 'border-leaf-100 bg-surface text-ink'
            }`}
          >
            {t.kind === 'error'
              ? <HiOutlineExclamationCircle className="w-5 h-5 shrink-0 mt-px" />
              : <HiOutlineCheckCircle className="w-5 h-5 shrink-0 mt-px text-leaf-600" />}
            <p className="flex-1 min-w-0 break-words">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-current/60 hover:text-current">
              <HiOutlineX className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
