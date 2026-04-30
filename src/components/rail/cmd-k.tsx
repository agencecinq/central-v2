"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ArrowRight, LayoutGrid } from "lucide-react";

interface NavRef {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
}

export function CmdKPalette({
  open,
  onClose,
  onNavigate,
  navItems,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
  navItems: NavRef[];
}) {
  const [q, setQ] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!open) {
      setQ("");
      setSelectedIdx(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    if (!needle) return navItems;
    return navItems.filter((n) => n.label.toLowerCase().includes(needle));
  }, [q, navItems]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[selectedIdx];
        if (item) onNavigate(item.href);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, filtered, selectedIdx, onNavigate]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ background: "rgba(20,20,18,0.35)" }}
      />
      <div
        className="fixed left-1/2 top-24 -translate-x-1/2 z-50 rounded-lg overflow-hidden"
        style={{
          width: 520,
          background: "#fff",
          border: "1px solid var(--rail-hair)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div
          className="flex items-center gap-2.5 px-4"
          style={{
            borderBottom: "1px solid var(--rail-hair)",
            height: 44,
          }}
        >
          <Search size={15} className="text-[var(--rail-muted)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Chercher une page, un projet, un deal…"
            className="flex-1 text-[14px] outline-none bg-transparent"
          />
          <span
            className="text-[10px] px-1.5 py-0.5 rounded border"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--rail-muted)",
              borderColor: "var(--rail-hair)",
            }}
          >
            esc
          </span>
        </div>
        <div className="max-h-[360px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--rail-muted)]">
              Aucun résultat
            </div>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              const active = i === selectedIdx;
              return (
                <button
                  key={item.href}
                  onClick={() => onNavigate(item.href)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-left"
                  style={{
                    background: active ? "var(--rail-hair3)" : "transparent",
                    color: "var(--rail-ink)",
                  }}
                >
                  <Icon size={15} strokeWidth={1.5} className="text-[var(--rail-muted)]" />
                  <span className="flex-1">{item.label}</span>
                  {active && <ArrowRight size={12} className="text-[var(--rail-muted)]" />}
                </button>
              );
            })
          )}
        </div>
        <div
          className="px-4 py-2 flex items-center gap-3 text-[10.5px] text-[var(--rail-muted)]"
          style={{
            borderTop: "1px solid var(--rail-hair)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>↑↓ naviguer</span>
          <span>⏎ ouvrir</span>
          <span>esc fermer</span>
        </div>
      </div>
    </>
  );
}
