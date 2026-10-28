import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { label as labelClass } from '../lib/styles';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'verify';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-saffron-600 text-white hover:bg-saffron-700 shadow-sm',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
  ghost: 'text-ink-soft hover:bg-sunken',
  danger: 'bg-surface text-danger-600 border border-danger-600/30 hover:bg-danger-50',
  ai: 'bg-lotus-50 text-lotus-600 border border-lotus-100 hover:bg-lotus-100',
  verify: 'bg-leaf-600 text-white hover:bg-leaf-700 shadow-sm',
};
const sizes: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-[15px] px-4 py-2.5 gap-2',
  lg: 'text-base px-6 py-3 gap-2',
};

function buttonClass(variant: Variant, size: Size, extra = '') {
  return `inline-flex items-center justify-center rounded-lg font-medium transition-colors no-underline
    disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, children, className, ...rest }:
  LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export function Card({ children, className = '', as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={`rounded-card border border-line bg-surface shadow-card ${className}`}>{children}</Tag>;
}

export function Field({ label, hint, error, htmlFor, children }: {
  label: string; hint?: ReactNode; error?: string; htmlFor?: string; children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-sm text-danger-600">{error}</p>
        : hint && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export function Alert({ children, kind = 'error' }: { children: ReactNode; kind?: 'error' | 'info' }) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-sm ${
      kind === 'error' ? 'bg-danger-50 text-danger-600' : 'bg-river-50 text-river-600'
    }`}>
      {children}
    </div>
  );
}

const statusStyle: Record<string, { label: string; className: string; dot: string }> = {
  uploaded: { label: 'Not transcribed', className: 'bg-sunken text-muted', dot: 'bg-faint' },
  transcribing: { label: 'Transcribing', className: 'bg-river-50 text-river-600', dot: 'bg-river-500 animate-pulse' },
  transcribed: { label: 'Needs review', className: 'bg-saffron-50 text-saffron-700', dot: 'bg-saffron-500' },
  verified: { label: 'Verified', className: 'bg-leaf-50 text-leaf-700', dot: 'bg-leaf-600' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = statusStyle[status] ?? { label: status, className: 'bg-sunken text-muted', dot: 'bg-faint' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${s.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Chip({ children, className = 'bg-sunken text-ink-soft' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.08em] text-saffron-600 mb-2">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-[2.1rem] font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-muted text-[15px] leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: {
  icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50 text-saffron-600">{icon}</div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {children && <div className="mx-auto mt-1.5 max-w-md text-[15px] text-muted">{children}</div>}
      {action && <div className="mt-6 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-24 text-saffron-500" role="status" aria-label="Loading">
      <Spinner className="w-8 h-8 border-[3px]" />
    </div>
  );
}

export function LotusMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 3.5c3.2 4 4.8 8.2 4.8 11.8S18.7 22.8 16 25c-2.7-2.2-4.8-6.1-4.8-9.7S12.8 7.5 16 3.5z" fill="#c2477f" />
      <path d="M3.5 11.5c4.7.5 8.4 2.6 10.4 5.7 1.4 2.1 1.9 4.8 2.1 7.8-3.3-.2-6.6-1.3-9-3.5-2.3-2.2-3.3-5.8-3.5-10z" fill="#d97706" />
      <path d="M28.5 11.5c-4.7.5-8.4 2.6-10.4 5.7-1.4 2.1-1.9 4.8-2.1 7.8 3.3-.2 6.6-1.3 9-3.5 2.3-2.2 3.3-5.8 3.5-10z" fill="#d97706" />
      <path d="M6 27.2c3 1.4 6.4 2 10 2s7-.6 10-2" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-surface px-1.5 py-px font-mono text-[11px] text-muted">{children}</kbd>;
}
