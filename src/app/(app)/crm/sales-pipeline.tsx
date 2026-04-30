"use client";

import { useState, useRef, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Plus,
  Pencil,
  Trophy,
  XCircle,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Undo2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { updateDealEtape, deleteDeal } from "./actions";
import { DealDialog } from "./deal-dialog";
import { DeleteDialog } from "./delete-dialog";
import { WonDealDialog } from "./won-deal-dialog";
import { KpiCard, Hint, Tag } from "@/components/rail/primitives";

interface DealData {
  id: number;
  titre: string;
  clientId: number;
  clientName: string;
  montantEstime: number;
  etape: string;
  montantFinal: number | null;
  dateSignature: string | null;
  createdAt: string | null;
}

interface ClientOption {
  id: number;
  name: string;
}

const PIPELINE_ETAPES = ["Prospect", "Qualification", "Proposition"];
const ALL_KANBAN_ETAPES = ["Prospect", "Qualification", "Proposition", "Gagné"];

const ETAPE_PROBA: Record<string, number> = {
  Prospect: 20,
  Qualification: 50,
  Proposition: 70,
  Gagné: 100,
};

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k€`;
  return `${n.toFixed(0)}€`;
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function fmtDateLong(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SalesPipeline({
  deals,
  clients,
}: {
  deals: DealData[];
  clients: ClientOption[];
}) {
  const [editingDeal, setEditingDeal] = useState<DealData | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingDeal, setDeletingDeal] = useState<DealData | null>(null);
  const [showLost, setShowLost] = useState(false);
  const [wonDeal, setWonDeal] = useState<DealData | null>(null);
  const [wonOpen, setWonOpen] = useState(false);

  const draggedDealId = useRef<number | null>(null);

  const pipelineDeals = deals.filter((d) => PIPELINE_ETAPES.includes(d.etape));
  const wonDeals = deals.filter((d) => d.etape === "Gagné");
  const lostDeals = deals.filter((d) => d.etape === "Perdu");
  const allOpenDeals = pipelineDeals;

  // ─── KPIs ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = allOpenDeals.reduce((s, d) => s + d.montantEstime, 0);
    const weighted = allOpenDeals.reduce(
      (s, d) => s + d.montantEstime * (ETAPE_PROBA[d.etape] ?? 50) / 100,
      0,
    );

    // Cycle moyen for won deals (days between createdAt and dateSignature)
    const cycleDays =
      wonDeals.length > 0
        ? wonDeals
            .filter((d) => d.dateSignature && d.createdAt)
            .map((d) => {
              const start = new Date(d.createdAt!).getTime();
              const end = new Date(d.dateSignature!).getTime();
              return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
            })
            .reduce((s, n, _, arr) => s + n / arr.length, 0)
        : 0;

    // Closing rate (sur les deals fermés)
    const totalClosed = wonDeals.length + lostDeals.length;
    const closingRate = totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : 0;

    return {
      total,
      weighted,
      cycle: Math.round(cycleDays),
      closing: closingRate,
    };
  }, [allOpenDeals, wonDeals, lostDeals]);

  function handleDragStart(dealId: number) {
    draggedDealId.current = dealId;
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  async function handleDrop(etape: string) {
    const dealId = draggedDealId.current;
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.etape === etape) {
      draggedDealId.current = null;
      return;
    }
    draggedDealId.current = null;
    if (etape === "Gagné") {
      markWon(deal);
    } else {
      await updateDealEtape(dealId, etape);
    }
  }
  function openEdit(deal: DealData) {
    setEditingDeal(deal);
    setEditOpen(true);
  }
  function openDelete(deal: DealData) {
    setDeletingDeal(deal);
    setDeleteOpen(true);
  }
  function markWon(deal: DealData) {
    setWonDeal(deal);
    setWonOpen(true);
  }
  async function markLost(deal: DealData) {
    await updateDealEtape(deal.id, "Perdu");
  }

  // ─── Activity feed (recent deals events) ─────────────────────────────────
  const recentActivity = useMemo(() => {
    const events: { dealId: number; date: string; type: string; client: string; deal: string; bg: string; color: string }[] = [];
    for (const d of deals) {
      if (d.dateSignature) {
        events.push({
          dealId: d.id,
          date: d.dateSignature,
          type: "signé",
          client: d.clientName,
          deal: `${d.titre} — ${formatMontant(d.montantFinal ?? d.montantEstime)}`,
          bg: "var(--rail-success-bg)",
          color: "var(--rail-success)",
        });
      } else if (d.createdAt) {
        events.push({
          dealId: d.id,
          date: d.createdAt,
          type: d.etape.toLowerCase(),
          client: d.clientName,
          deal: `${d.titre} — ${formatMontant(d.montantEstime)}`,
          bg:
            d.etape === "Proposition"
              ? "var(--rail-info-bg)"
              : d.etape === "Qualification"
                ? "var(--rail-warn-bg)"
                : "var(--rail-hair2)",
          color:
            d.etape === "Proposition"
              ? "var(--rail-info)"
              : d.etape === "Qualification"
                ? "var(--rail-warn)"
                : "var(--rail-ink2)",
        });
      }
    }
    return events
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [deals]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <section className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Pipeline total"
          value={fmtK(stats.total)}
          delta={`${allOpenDeals.length} deals actifs`}
          spark={[12, 18, 22, 19, 24, 28, Math.max(33, stats.total / 1000)]}
        />
        <KpiCard
          label="Pipeline pondéré"
          value={fmtK(stats.weighted)}
          delta="× probabilité"
          spark={[8, 11, 14, 13, 17, 20, Math.max(22, stats.weighted / 1000)]}
        />
        <KpiCard
          label="Cycle moyen"
          value={`${stats.cycle} j`}
          delta={wonDeals.length > 0 ? `sur ${wonDeals.length} deals signés` : "—"}
          deltaTone={stats.cycle < 60 ? "good" : "default"}
          spark={[48, 44, 42, 40, 39, 38, Math.max(38, stats.cycle)]}
        />
        <KpiCard
          label="Taux de closing"
          value={`${stats.closing}%`}
          delta={`${wonDeals.length} gagné · ${lostDeals.length} perdu`}
          deltaTone={stats.closing >= 50 ? "good" : "default"}
          spark={[32, 34, 36, 38, 40, 41, Math.max(42, stats.closing)]}
        />
      </section>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-[12.5px]" style={{ color: "var(--rail-muted)" }}>
          {allOpenDeals.length} deal{allOpenDeals.length > 1 ? "s" : ""} en cours · {wonDeals.length} signé{wonDeals.length > 1 ? "s" : ""} · {lostDeals.length} perdu{lostDeals.length > 1 ? "s" : ""}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 text-white rounded-md text-[12.5px] font-medium"
          style={{
            padding: "7px 12px",
            background: "var(--b-accent)",
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau deal
        </button>
      </div>

      {/* Kanban — 4 columns including a "drop zone" Gagné */}
      <div className="grid grid-cols-4 gap-3">
        {ALL_KANBAN_ETAPES.map((etape) => {
          const isWonCol = etape === "Gagné";
          const colDeals = isWonCol
            ? wonDeals.slice(0, 5)
            : pipelineDeals.filter((d) => d.etape === etape);
          const totalMontant = colDeals.reduce(
            (sum, d) => sum + (isWonCol ? (d.montantFinal ?? d.montantEstime) : d.montantEstime),
            0,
          );
          const proba = ETAPE_PROBA[etape] ?? 50;

          return (
            <div
              key={etape}
              className="flex flex-col"
              style={{
                background: "var(--rail-panel)",
                border: "1px solid var(--rail-hair)",
                borderRadius: 8,
                minHeight: 320,
              }}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(etape)}
            >
              <div
                className="flex items-center justify-between gap-2"
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--rail-hair)",
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold">{etape}</span>
                  {!isWonCol && (
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--rail-muted)", fontFamily: "var(--font-mono)" }}
                    >
                      {proba}%
                    </span>
                  )}
                </div>
                <Hint>{colDeals.length} · {fmtK(totalMontant)}</Hint>
              </div>
              <div className="flex flex-col gap-2 p-2 flex-1">
                {colDeals.length === 0 ? (
                  <div
                    className="flex items-center justify-center py-10 text-[11.5px]"
                    style={{ color: "var(--rail-muted2)" }}
                  >
                    {isWonCol ? "—" : "Glissez un deal ici"}
                  </div>
                ) : (
                  colDeals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onDragStart={() => handleDragStart(deal.id)}
                      onEdit={() => openEdit(deal)}
                      onDelete={() => openDelete(deal)}
                      onMarkWon={() => markWon(deal)}
                      onMarkLost={() => markLost(deal)}
                      proba={ETAPE_PROBA[deal.etape] ?? 50}
                      isWon={isWonCol}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity feed */}
      {recentActivity.length > 0 && (
        <section
          className="overflow-hidden"
          style={{
            background: "var(--rail-panel)",
            border: "1px solid var(--rail-hair)",
            borderRadius: 8,
          }}
        >
          <header
            className="flex items-center justify-between"
            style={{
              padding: "12px 18px",
              borderBottom: "1px solid var(--rail-hair)",
            }}
          >
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">Activité récente</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: "var(--rail-muted)" }}>
                Tous les deals · derniers événements
              </div>
            </div>
          </header>
          <div>
            {recentActivity.map((a, i) => (
              <Link
                key={`${a.dealId}-${i}`}
                href={`/crm/${a.dealId}`}
                className="grid items-center text-[12.5px]"
                style={{
                  gridTemplateColumns: "140px 110px 130px 1fr 16px",
                  gap: 16,
                  padding: "11px 18px",
                  borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
                }}
              >
                <span
                  className="text-[11px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--rail-muted)" }}
                >
                  {fmtDateLong(a.date)}
                </span>
                <Tag c={a.color} bg={a.bg}>{a.type}</Tag>
                <span style={{ color: "var(--rail-ink2)" }}>{a.client}</span>
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {a.deal}
                </span>
                <ArrowRight size={12} style={{ color: "var(--rail-muted2)" }} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Lost deals collapsible */}
      {lostDeals.length > 0 && (
        <section
          style={{
            background: "var(--rail-panel)",
            border: "1px solid var(--rail-hair)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setShowLost((v) => !v)}
            className="flex w-full items-center gap-2 text-left transition-colors"
            style={{
              padding: "12px 18px",
              background: "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rail-hair3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {showLost ? (
              <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--rail-muted)" }} />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--rail-muted)" }} />
            )}
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--rail-danger)" }}
            />
            <span className="text-[13px] font-medium" style={{ color: "var(--rail-danger)" }}>
              Deals perdus
            </span>
            <span className="text-[11.5px]" style={{ color: "var(--rail-muted)" }}>
              {lostDeals.length} deal{lostDeals.length > 1 ? "s" : ""}
            </span>
            <span
              className="ml-auto text-[12px]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--rail-muted)" }}
            >
              {fmtK(lostDeals.reduce((s, d) => s + d.montantEstime, 0))}
            </span>
          </button>
          {showLost && (
            <div style={{ borderTop: "1px solid var(--rail-hair)" }}>
              {lostDeals.map((deal, i) => (
                <div
                  key={deal.id}
                  className="grid items-center group text-[12.5px]"
                  style={{
                    gridTemplateColumns: "1.5fr 1fr 110px 100px 32px",
                    gap: 12,
                    padding: "10px 18px",
                    borderTop: i === 0 ? "none" : "1px solid var(--rail-hair2)",
                  }}
                >
                  <Link
                    href={`/crm/${deal.id}`}
                    className="font-medium hover:underline whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {deal.titre}
                  </Link>
                  <span style={{ color: "var(--rail-ink2)" }}>{deal.clientName}</span>
                  <span
                    className="text-right"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {formatMontant(deal.montantEstime)}
                  </span>
                  <span
                    className="text-right text-[11.5px]"
                    style={{ color: "var(--rail-muted)" }}
                  >
                    {fmtShortDate(deal.dateSignature ?? deal.createdAt)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          className="h-7 w-7 grid place-items-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--rail-hair2)]"
                        />
                      }
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" style={{ color: "var(--rail-muted)" }} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(deal)}>
                        <Pencil className="mr-2 h-4 w-4" /> Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateDealEtape(deal.id, "Prospect")}>
                        <Undo2 className="mr-2 h-4 w-4" /> Réouvrir
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openDelete(deal)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Dialogs */}
      <DealDialog clients={clients} open={createOpen} onOpenChange={setCreateOpen} />
      <DealDialog
        deal={editingDeal}
        clients={clients}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer le deal"
        description={`Êtes-vous sûr de vouloir supprimer « ${deletingDeal?.titre} » ? Cette action est irréversible.`}
        onConfirm={async () => {
          if (deletingDeal) await deleteDeal(deletingDeal.id);
        }}
      />
      <WonDealDialog deal={wonDeal} open={wonOpen} onOpenChange={setWonOpen} />
    </div>
  );
}

// ─── Deal Card (Rail v2) ─────────────────────────────────

function DealCard({
  deal,
  onDragStart,
  onEdit,
  onDelete,
  onMarkWon,
  onMarkLost,
  proba,
  isWon,
}: {
  deal: DealData;
  onDragStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  proba: number;
  isWon: boolean;
}) {
  return (
    <div
      draggable={!isWon}
      onDragStart={onDragStart}
      className="group transition-shadow"
      style={{
        padding: 12,
        background: "var(--rail-bg)",
        border: "1px solid var(--rail-hair)",
        borderRadius: 6,
        cursor: isWon ? "default" : "grab",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-start gap-1.5 min-w-0 flex-1">
          {!isWon && (
            <GripVertical
              className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--rail-muted2)" }}
            />
          )}
          <div className="min-w-0">
            <Link
              href={`/crm/${deal.id}`}
              className="text-[13px] font-medium leading-tight hover:underline block"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            >
              {deal.titre}
            </Link>
            <div
              className="mt-0.5 text-[11.5px] whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ color: "var(--rail-muted)" }}
            >
              {deal.clientName}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="h-6 w-6 grid place-items-center rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--rail-hair2)]"
              />
            }
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!isWon && (
              <>
                <DropdownMenuItem onClick={onMarkWon}>
                  <Trophy className="mr-2 h-4 w-4" style={{ color: "var(--rail-success)" }} />{" "}
                  Marquer gagné
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMarkLost}>
                  <XCircle className="mr-2 h-4 w-4" style={{ color: "var(--rail-danger)" }} />{" "}
                  Marquer perdu
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
          {formatMontant(isWon ? (deal.montantFinal ?? deal.montantEstime) : deal.montantEstime)}
        </span>
        {!isWon && (
          <div className="flex items-center gap-1.5">
            <div
              className="rounded h-[3px]"
              style={{
                width: 28,
                background: "var(--rail-hair)",
              }}
            >
              <div
                className="h-full rounded"
                style={{
                  width: `${proba}%`,
                  background: proba >= 70 ? "var(--rail-success)" : "var(--b-accent)",
                }}
              />
            </div>
            <span
              className="text-[10px] tabular w-6 text-right"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--rail-muted)",
              }}
            >
              {proba}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
