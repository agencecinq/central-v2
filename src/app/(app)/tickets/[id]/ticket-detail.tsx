"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor,
  Globe,
  Paperclip,
  Trash2,
  Upload,
  FileText,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  updateTicketStatus,
  updateTicketAssigne,
  deleteTicket,
  deleteAttachment,
} from "../actions";

// ─── Types ────────────────────────────────────────────────

interface Attachment {
  id: number;
  filename: string;
  filepath: string;
  mimetype: string | null;
  size: number | null;
  createdAt: string | null;
}

interface TicketData {
  id: number;
  titre: string;
  description: string | null;
  statut: string;
  projectId: number;
  projectTitre: string;
  createurId: number | null;
  createurName: string;
  assigneId: number | null;
  assigneName: string | null;
  navigateur: string | null;
  tailleEcran: string | null;
  metaInfo: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  attachments: Attachment[];
}

interface UserOption {
  id: number;
  name: string;
}

// ─── Constants ────────────────────────────────────────────

const statutLabels: Record<string, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
  ferme: "Fermé",
};

const statutVariants: Record<string, "default" | "secondary" | "outline"> = {
  ouvert: "default",
  en_cours: "secondary",
  resolu: "outline",
  ferme: "outline",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(mimetype: string | null) {
  if (mimetype?.startsWith("image/")) return ImageIcon;
  return FileText;
}

// ─── Component ────────────────────────────────────────────

export function TicketDetail({
  ticket,
  users,
}: {
  ticket: TicketData;
  users: UserOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleStatusChange(statut: string | null) {
    if (!statut) return;
    startTransition(async () => {
      await updateTicketStatus(ticket.id, statut);
    });
  }

  function handleAssigneChange(val: string | null) {
    const assigneId = val === "none" || !val ? null : parseInt(val);
    startTransition(async () => {
      await updateTicketAssigne(ticket.id, assigneId);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTicket(ticket.id);
      router.push("/tickets");
    });
  }

  function handleDeleteAttachment(attachmentId: number) {
    startTransition(async () => {
      await deleteAttachment(attachmentId);
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        await fetch(`/api/tickets/${ticket.id}/upload`, {
          method: "POST",
          body: formData,
        });
      }
      router.refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const assigneValue = ticket.assigneId ? String(ticket.assigneId) : "none";
  const assigneLabel = ticket.assigneId
    ? users.find((u) => u.id === ticket.assigneId)?.name ?? "Non assigné"
    : "Non assigné";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            {ticket.description ? (
              <div
                className="prose prose-sm prose-neutral dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
                dangerouslySetInnerHTML={{ __html: ticket.description }}
              />
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Aucune description.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Meta info */}
        {(ticket.navigateur || ticket.tailleEcran || ticket.metaInfo) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations techniques</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {ticket.navigateur && (
                  <div className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    {ticket.navigateur}
                  </div>
                )}
                {ticket.tailleEcran && (
                  <div className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm">
                    <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                    {ticket.tailleEcran}
                  </div>
                )}
              </div>
              {ticket.metaInfo && (() => {
                try {
                  const meta = JSON.parse(ticket.metaInfo);
                  return (
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {meta.origin && (
                        <p>
                          <span className="font-medium text-foreground/70">Page : </span>
                          {meta.origin}
                        </p>
                      )}
                      {meta.email && (
                        <p>
                          <span className="font-medium text-foreground/70">Email : </span>
                          {meta.email}
                        </p>
                      )}
                      {meta.source && (
                        <p>
                          <span className="font-medium text-foreground/70">Source : </span>
                          {meta.source}
                        </p>
                      )}
                    </div>
                  );
                } catch {
                  return (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {ticket.metaInfo}
                    </p>
                  );
                }
              })()}
            </CardContent>
          </Card>
        )}

        {/* Attachments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">
              Pièces jointes
              {ticket.attachments.length > 0 && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  ({ticket.attachments.length})
                </span>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-1 h-3.5 w-3.5" />
              {uploading ? "Upload..." : "Ajouter"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </CardHeader>
          <CardContent>
            {ticket.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Aucune pièce jointe.
              </p>
            ) : (
              <div className="space-y-2">
                {ticket.attachments.map((att) => {
                  const Icon = getFileIcon(att.mimetype);
                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {att.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(att.size)}
                          {att.createdAt && ` · ${formatDate(att.createdAt)}`}
                        </p>
                      </div>
                      <a
                        href={att.filepath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        disabled={isPending}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Statut</p>
              <Select
                value={ticket.statut}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-full">
                  <Badge variant={statutVariants[ticket.statut] ?? "secondary"}>
                    {statutLabels[ticket.statut] ?? ticket.statut}
                  </Badge>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ouvert">Ouvert</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="resolu">Résolu</SelectItem>
                  <SelectItem value="ferme">Fermé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Assigné à</p>
              <Select
                value={assigneValue}
                onValueChange={handleAssigneChange}
              >
                <SelectTrigger className="w-full">
                  {assigneLabel}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Projet</p>
              <p className="text-sm">{ticket.projectTitre}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Créé par</p>
              <div className="flex items-center gap-2">
                <p className="text-sm">{ticket.createurName}</p>
                {!ticket.createurId && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Widget
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Créé le</p>
              <p className="text-sm">{formatDate(ticket.createdAt)}</p>
            </div>

            {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Modifié le</p>
                <p className="text-sm">{formatDate(ticket.updatedAt)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full text-destructive hover:bg-destructive/10"
          onClick={() => setDeleteOpen(true)}
          disabled={isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer le ticket
        </Button>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Supprimer le ticket ?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Cette action est irréversible. Le ticket et toutes ses pièces
              jointes seront supprimés.
            </p>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? "Suppression..." : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
