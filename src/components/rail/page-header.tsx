import { ReactNode } from "react";

export function RailPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
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
      <div className="flex items-end justify-between gap-5 px-7 pt-[18px] pb-4">
        <div className="min-w-0">
          {eyebrow && (
            <div
              className="text-[11px] tracking-[0.1em] uppercase mb-1.5"
              style={{ color: "var(--rail-muted)" }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className="m-0 text-[22px] font-semibold"
            style={{ letterSpacing: "-0.4px" }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="text-[13px] mt-1"
              style={{ color: "var(--rail-muted)" }}
            >
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function RailPageBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-7 pt-5 pb-12 ${className}`}>{children}</div>;
}
