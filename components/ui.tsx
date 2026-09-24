import type { ReactNode } from "react";

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-[#e8ebf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
        padded ? "p-5" : ""
      } ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#2f6bff]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1.5 text-[30px] font-bold leading-tight tracking-tight">{title}</h1>
        {lead ? <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#667085]">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "text-[#1b1f27]",
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      {accent ? (
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }} />
      ) : null}
      <p className="text-[13px] font-medium text-[#667085]">{label}</p>
      <p className={`mt-2 text-[30px] font-bold leading-none tabular-nums ${tone}`}>{value}</p>
      {hint ? <p className="mt-2 line-clamp-2 text-[12px] leading-4 text-[#98a2b3]">{hint}</p> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = "bg-[#f2f4f7] text-[#475467]",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "quiet";
}) {
  const styles =
    variant === "primary"
      ? "bg-[#2f6bff] text-white hover:bg-[#2559e0]"
      : variant === "ghost"
        ? "border border-[#e8ebf0] bg-white text-[#344054] hover:bg-[#f9fafb]"
        : "bg-[#e7f0ff] text-[#2f6bff] hover:bg-[#dbe8ff]";
  return (
    <button
      className={`rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${styles}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[17px] font-bold tracking-tight">{children}</h2>
      {aside}
    </div>
  );
}

/**
 * Sticks a visible marker on any screen fed by the simulated operational layer,
 * so nobody reads generated pressure or fleet positions as live telemetry.
 */
export function SimulatedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf1d8] px-2.5 py-1 text-[11px] font-semibold text-[#9a6400]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#e09a12]" />
      {compact ? "Демо" : "Демо-данные"}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-[#e2e6ee] px-4 py-6 text-center text-[13px] text-[#98a2b3]">
      {children}
    </p>
  );
}
