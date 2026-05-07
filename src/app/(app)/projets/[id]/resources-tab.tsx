"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  File as FileIcon,
  FileCode,
  Link2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createExternalLinkResource,
  deleteResource,
} from "./actions";
import { DeleteDialog } from "./delete-dialog";

export interface ResourceItem {
  id: number;
  type: "document" | "html_page" | "external_link";
  name: string;
  filepath: string | null;
  url: string | null;
  mimetype: string | null;
  size: number | null;
  createdAt: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function typeMeta(type: ResourceItem["type"]) {
  switch (type) {
    case "document":
      return { icon: FileIcon, label: "Document" };
    case "html_page":
      return { icon: FileCode, label: "Page HTML" };
    case "external_link":
      return { icon: Link2, label: "Lien externe" };
  }
}

function getResourceHref(r: ResourceItem): string | null {
  if (r.type === "external_link") return r.url;
  return r.filepath;
}

export function ResourcesTab({
  projectId,
  resources,
}: {
  projectId: number;
  resources: ResourceItem[];
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"document" | "html_page">(
    "document",
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ResourceItem | null>(null);

  function openUpload(type: "document" | "html_page") {
    setUploadType(type);
    setUploadOpen(true);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-muted-foreground">
          Documents et pages HTML partagés avec le client dans son espace.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openUpload("document")}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            Document
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openUpload("html_page")}
          >
            <FileCode className="mr-1.5 h-4 w-4" />
            Page HTML
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLinkOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Lien externe
          </Button>
        </div>
      </div>

      {resources.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          Aucune ressource pour ce projet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {resources.map((r) => {
            const meta = typeMeta(r.type);
            const Icon = meta.icon;
            const href = getResourceHref(r);
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13.5px] font-medium hover:underline truncate"
                      >
                        {r.name}
                      </a>
                    ) : (
                      <span className="text-[13.5px] font-medium truncate">
                        {r.name}
                      </span>
                    )}
                    <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {r.type === "external_link"
                      ? r.url
                      : `${formatSize(r.size)} · ajouté le ${formatDate(r.createdAt)}`}
                  </div>
                </div>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    title="Ouvrir"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={() => setDeleteTarget(r)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <UploadDialog
        projectId={projectId}
        type={uploadType}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />

      <ExternalLinkDialog
        projectId={projectId}
        open={linkOpen}
        onOpenChange={setLinkOpen}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer la ressource"
        description={`Êtes-vous sûr de vouloir supprimer « ${deleteTarget?.name ?? ""} » ? Cette action est irréversible.`}
        onConfirm={async () => {
          if (deleteTarget) await deleteResource(deleteTarget.id);
        }}
      />
    </>
  );
}

function UploadDialog({
  projectId,
  type,
  open,
  onOpenChange,
}: {
  projectId: number;
  type: "document" | "html_page";
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Sélectionnez un fichier");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    if (name.trim()) fd.append("name", name.trim());

    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/resources/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de l'upload");
        return;
      }
      toast.success("Ressource ajoutée");
      reset();
      onOpenChange(false);
      // Refresh server data
      window.location.reload();
    });
  }

  const isHtml = type === "html_page";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isHtml ? "Ajouter une page HTML" : "Ajouter un document"}
            </DialogTitle>
            <DialogDescription>
              {isHtml
                ? "Uploadez un fichier .html (wireframe, arborescence, etc.). Il sera affiché en preview pour le client."
                : "Uploadez un document partagé avec le client."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="resource-file">Fichier</Label>
              <Input
                id="resource-file"
                type="file"
                ref={fileRef}
                accept={isHtml ? ".html,.htm" : undefined}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resource-name">Nom affiché (optionnel)</Label>
              <Input
                id="resource-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  isHtml ? "Wireframes accueil" : "Cahier des charges v2"
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Si vide, le nom du fichier sera utilisé.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Upload..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExternalLinkDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setUrl("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("name", name);
    fd.append("url", url);
    startTransition(async () => {
      try {
        await createExternalLinkResource(projectId, fd);
        toast.success("Lien ajouté");
        reset();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter un lien externe</DialogTitle>
            <DialogDescription>
              Lien vers Figma, Whimsical, Google Doc, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="link-name">Nom</Label>
              <Input
                id="link-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Maquettes Figma"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
