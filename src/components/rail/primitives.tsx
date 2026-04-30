"use client";

import { ReactNode } from "react";

// ─── Panel ───────────────────────────────────────────────
export function Panel({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden"
      style={{
        background: "var(--rail-panel)",
        border: "1px solid var(--rail-hair)",
        borderRadius: 8,
      }}
    >
      <header
        className="flex items-center justify-between px-[18px] py-3"
        style={{ borderBottom: "1px solid var(--rail-hair)" }}
      >
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{title}</div>
          {sub && (
            <div
              className="text-[11.5px] whitespace-nowrap overflow-hidden text-ellipsis mt-0.5"
              style={{ color: "var(--rail-muted)" }}
            >
              {sub}
            </div>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

// ─── KPI Card ────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  sub,
  spark,
  onClick,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "good" | "warn" | "default";
  sub?: string;
  spark: number[];
  onClick?: () => void;
}) {
  const tone =
    deltaTone === "good"
      ? "var(--rail-success)"
      : deltaTone === "warn"
        ? "var(--rail-warn)"
        : "var(--rail-muted)";
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const range = max - min || 1;
  const pts = spark
    .map((v, i) => `${(i / (spark.length - 1)) * 100},${100 - ((v - min) / range) * 100}`)
    .join(" ");
  return (
    <button
      onClick={onClick}
      className="text-left flex flex-col gap-1 relative overflow-hidden transition-colors"
      style={{
        background: "var(--rail-panel)",
        border: "1px solid var(--rail-hair)",
        borderRadius: 8,
        padding: "16px 18px 14px",
      }}
    >
      <div className="text-[11.5px]" style={{ color: "var(--rail-muted)" }}>
        {label}
      </div>
      <div className="flex items-baseline justify-between gap-2.5">
        <div
          className="text-[26px] font-semibold tabular leading-[1.1]"
          style={{ letterSpacing: "-0.5px" }}
        >
          {value}
        </div>
        <svg
          width="60"
          height="22"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="opacity-80"
        >
          <polyline
            points={pts}
            fill="none"
            stroke="var(--b-accent)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {delta && (
        <div
          className="text-[11.5px] font-medium mt-1"
          style={{ color: tone }}
        >
          {delta}
        </div>
      )}
      {sub && (
        <div
          className="text-[11px] mt-px"
          style={{ color: "var(--rail-muted2)" }}
        >
          {sub}
        </div>
      )}
    </button>
  );
}

// ─── Charge Chip ─────────────────────────────────────────
export function ChargeChip({ v }: { v: "Sur charge" | "Sous charge" | "OK" | string }) {
  const tone =
    v === "Sur charge"
      ? { c: "var(--rail-danger)", bg: "var(--rail-danger-bg)", dot: "var(--rail-danger)" }
      : v === "Sous charge"
        ? { c: "var(--rail-warn)", bg: "var(--rail-warn-bg)", dot: "var(--rail-warn)" }
        : { c: "var(--rail-success)", bg: "var(--rail-success-bg)", dot: "var(--rail-success)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10.5px] whitespace-nowrap"
      style={{
        padding: "2px 7px 2px 5px",
        background: tone.bg,
        color: tone.c,
        borderRadius: 3,
        width: "fit-content",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: tone.dot }}
      />
      {v}
    </span>
  );
}

// ─── Prio Chip ───────────────────────────────────────────
export function PrioChip({ v }: { v: "haute" | "moyenne" | "basse" | string }) {
  const m: Record<string, { c: string; bg: string; l: string }> = {
    haute: { c: "var(--rail-danger)", bg: "var(--rail-danger-bg)", l: "Haute" },
    moyenne: { c: "var(--rail-warn)", bg: "var(--rail-warn-bg)", l: "Moyenne" },
    basse: { c: "var(--rail-success)", bg: "var(--rail-success-bg)", l: "Basse" },
  };
  const t = m[v] ?? m.moyenne;
  return <Tag c={t.c} bg={t.bg}>{t.l}</Tag>;
}

// ─── Tag ─────────────────────────────────────────────────
export function Tag({
  c,
  bg,
  children,
}: {
  c: string;
  bg: string;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-block text-[10.5px] font-medium uppercase whitespace-nowrap"
      style={{
        padding: "2px 7px",
        background: bg,
        color: c,
        borderRadius: 3,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

// ─── Hint (mono pill) ────────────────────────────────────
export function Hint({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-block text-[10.5px]"
      style={{
        padding: "2px 6px",
        background: "var(--rail-hair2)",
        color: "var(--rail-ink2)",
        borderRadius: 3,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

// ─── Sparkline ───────────────────────────────────────────
export function Sparkline({
  data,
  h = 24,
  w = 80,
  color = "var(--b-accent)",
}: {
  data: number[];
  h?: number;
  w?: number;
  color?: string;
}) {
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h * 0.85 - h * 0.08}`)
    .join(" ");
  const lastY = h - (data[data.length - 1] / max) * h * 0.85 - h * 0.08;
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.3} />
      <circle cx={w} cy={lastY} r={2} fill={color} />
    </svg>
  );
}

// ─── Avatar Stack ────────────────────────────────────────
export function AvatarStack({
  initials,
  size = 20,
}: {
  initials: string[];
  size?: number;
}) {
  return (
    <div className="flex">
      {initials.slice(0, 3).map((a, i) => (
        <div
          key={i}
          className="rounded-full grid place-items-center font-semibold text-white"
          style={{
            width: size,
            height: size,
            background: "var(--rail-dark)",
            fontSize: size < 22 ? 9 : 10.5,
            marginLeft: i === 0 ? 0 : -6,
            border: "1.5px solid var(--rail-panel)",
          }}
        >
          {a}
        </div>
      ))}
    </div>
  );
}

// ─── Sub-Header ──────────────────────────────────────────
export function SubHeader({
  crumbs,
  title,
  tabs,
  activeTab,
  onTabChange,
  actions,
}: {
  crumbs: string[];
  title: string;
  tabs?: { id: string; label: string; count?: number }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  actions?: ReactNode;
}) {
  return (
    <div
      className="sticky top-0 z-10"
      style={{
        borderBottom: "1px solid var(--rail-hair)",
        background: "var(--rail-panel)",
      }}
    >
      <div className="flex items-center gap-2 text-[12px] pt-3 px-7" style={{ color: "var(--rail-muted)" }}>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span style={{ color: "var(--rail-muted2)" }}>/</span>}
            <span style={{ color: i === crumbs.length - 1 ? "var(--rail-ink)" : "var(--rail-muted)" }}>
              {c}
            </span>
          </span>
        ))}
      </div>
      <div className="flex items-end justify-between gap-5 px-7 pt-1.5">
        <h1 className="m-0 text-[22px] font-semibold" style={{ letterSpacing: "-0.4px" }}>
          {title}
        </h1>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {tabs ? (
        <div className="flex gap-0.5 px-7 pt-3">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange?.(t.id)}
                className="text-[12.5px] font-medium px-3 py-2"
                style={{
                  color: active ? "var(--rail-ink)" : "var(--rail-muted)",
                  borderBottom: active ? "2px solid var(--b-accent)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {t.label}
                {t.count != null && (
                  <span
                    className="ml-1.5 text-[10.5px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--rail-muted)",
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="h-3" />
      )}
    </div>
  );
}
