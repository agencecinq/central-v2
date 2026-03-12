"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import Link from "next/link";
import { updateDealEtape, deleteDeal } from "./actions";
import { DealDialog } from "./deal-dialog";
import { DeleteDialog } from "./delete-dialog";
import { WonDealDialog } from "./won-deal-dialog";

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

const ETAPE_COLORS: Record<string, string> = {
  Prospect: "bg-blue-500",
  Qualification: "bg-amber-500",
  Proposition: "bg-violet-500",
};

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
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
  const [showWon, setShowWon] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [wonDeal, setWonDeal] = useState<DealData | null>(null);
  const [wonOpen, setWonOpen] = useState(false);

  const draggedDealId = useRef<number | null>(null);

  // Only show active pipeline deals (not Gagné/Perdu)
  const pipelineDeals = deals.filter((d) =>
    PIPELINE_ETAPES.includes(d.etape),
  );

  // Count won/lost
  const wonDeals = deals.filter((d) => d.etape === "Gagné");
  const lostDeals = deals.filter((d) => d.etape === "Perdu");

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
    await updateDealEtape(dealId, etape);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">CRM</h2>
          <p className="mt-1 text-muted-foreground">
            Tunnel de vente — {pipelineDeals.length} deal{pipelineDeals.length !== 1 ? "s" : ""} en cours
            {wonDeals.length > 0 && (
              <span className="ml-2 text-emerald-600">
                · {wonDeals.length} gagné{wonDeals.length !== 1 ? "s" : ""}
              </span>
            )}
            {lostDeals.length > 0 && (
              <span className="ml-2 text-red-500">
                · {lostDeals.length} perdu{lostDeals.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau deal
        </Button>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-4">
        {PIPELINE_ETAPES.map((etape) => {
          const columnDeals = pipelineDeals.filter((d) => d.etape === etape);
          const totalMontant = columnDeals.reduce(
            (sum, d) => sum + d.montantEstime,
            0,
          );

          return (
            <div
              key={etape}
              className="flex flex-col rounded-xl border bg-muted/30"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(etape)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${ETAPE_COLORS[etape]}`}
                />
                <span className="text-sm font-medium">{etape}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {columnDeals.length}
                </span>
                {totalMontant > 0 && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatMontant(totalMontant)}
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 p-2">
                {columnDeals.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                    Aucun deal
                  </div>
                )}
                {columnDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onDragStart={() => handleDragStart(deal.id)}
                    onEdit={() => openEdit(deal)}
                    onDelete={() => openDelete(deal)}
                    onMarkWon={() => markWon(deal)}
                    onMarkLost={() => markLost(deal)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed deals */}
      {(wonDeals.length > 0 || lostDeals.length > 0) && (
        <div className="space-y-3">
          {wonDeals.length > 0 && (
            <ClosedDealsSection
              label="Gagné"
              deals={wonDeals}
              open={showWon}
              onToggle={() => setShowWon(!showWon)}
              colorClass="text-emerald-600"
              dotClass="bg-emerald-500"
              onEdit={openEdit}
              onDelete={openDelete}
              onReopen={async (deal) => {
                await updateDealEtape(deal.id, "Proposition");
              }}
            />
          )}
          {lostDeals.length > 0 && (
            <ClosedDealsSection
              label="Perdu"
              deals={lostDeals}
              open={showLost}
              onToggle={() => setShowLost(!showLost)}
              colorClass="text-red-500"
              dotClass="bg-red-500"
              onEdit={openEdit}
              onDelete={openDelete}
              onReopen={async (deal) => {
                await updateDealEtape(deal.id, "Prospect");
              }}
            />
          )}
        </div>
      )}

      {/* Dialogs */}
      <DealDialog
        clients={clients}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

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

      <WonDealDialog
        deal={wonDeal}
        open={wonOpen}
        onOpenChange={setWonOpen}
      />
    </div>
  );
}

function ClosedDealsSection({
  label,
  deals,
  open,
  onToggle,
  colorClass,
  dotClass,
  onEdit,
  onDelete,
  onReopen,
}: {
  label: string;
  deals: DealData[];
  open: boolean;
  onToggle: () => void;
  colorClass: string;
  dotClass: string;
  onEdit: (deal: DealData) => void;
  onDelete: (deal: DealData) => void;
  onReopen: (deal: DealData) => void;
}) {
  const totalMontant = deals.reduce((sum, d) => sum + d.montantEstime, 0);

  return (
    <div className="rounded-xl border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className={`text-sm font-medium ${colorClass}`}>{label}</span>
        <span className="text-xs text-muted-foreground">
          {deals.length} deal{deals.length !== 1 ? "s" : ""}
        </span>
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          {formatMontant(totalMontant)}
        </span>
      </button>

      {open && (
        <div className="border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Deal</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 text-right font-medium">Montant estimé</th>
                <th className="px-4 py-2 text-right font-medium">Montant final</th>
                <th className="px-4 py-2 text-right font-medium">Date signature</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} className="group border-b last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/crm/${deal.id}`} className="hover:underline">
                      {deal.titre}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{deal.clientName}</td>
                  <td className="px-4 py-2.5 text-right">{formatMontant(deal.montantEstime)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {deal.montantFinal != null ? formatMontant(deal.montantFinal) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {deal.dateSignature
                      ? new Date(deal.dateSignature).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-2 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        }
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(deal)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onReopen(deal)}>
                          <Undo2 className="mr-2 h-4 w-4" />
                          Réouvrir
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(deal)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DealCard({
  deal,
  onDragStart,
  onEdit,
  onDelete,
  onMarkWon,
  onMarkLost,
}: {
  deal: DealData;
  onDragStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group cursor-grab rounded-lg border bg-background p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="min-w-0">
            <Link
              href={`/crm/${deal.id}`}
              className="truncate text-sm font-medium leading-tight hover:underline block"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            >
              {deal.titre}
            </Link>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {deal.clientName}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              />
            }
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onMarkWon}>
              <Trophy className="mr-2 h-4 w-4 text-emerald-600" />
              Marquer gagné
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMarkLost}>
              <XCircle className="mr-2 h-4 w-4 text-red-500" />
              Marquer perdu
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold">
          {formatMontant(deal.montantEstime)}
        </span>
        {deal.createdAt && (
          <span className="text-[11px] text-muted-foreground">
            {new Date(deal.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
