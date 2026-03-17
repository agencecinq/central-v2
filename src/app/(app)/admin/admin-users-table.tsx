"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Check } from "lucide-react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { updateUserRole, updateUserTjm, toggleUserMetier, toggleUserProject, createUser } from "./actions";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MetierOption {
  id: number;
  nom: string;
}

interface ProjectOption {
  id: number;
  titre: string;
  clientNom: string | null;
}

interface UserItem {
  id: number;
  name: string;
  email: string;
  role: string;
  tjm: number | null;
  metierIds: number[];
  projectIds: number[];
  createdAt: string | null;
}

interface Props {
  users: UserItem[];
  metiers: MetierOption[];
  projects: ProjectOption[];
  currentUserId: number;
}

// ─── Main table ─────────────────────────────────────────────────────────────

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [Role, string][];

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<string>(ROLES.EQUIPE);
  const [error, setError] = useState<string | null>(null);

  const roleLabel = ROLE_LABELS[role as Role] ?? role;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    const email = (form.get("email") as string).trim();

    startTransition(async () => {
      try {
        await createUser({ name, email, role });
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un utilisateur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Nom *</Label>
            <Input id="user-name" name="name" required placeholder="Prénom Nom" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">Email *</Label>
            <Input id="user-email" name="email" type="email" required placeholder="email@exemple.com" />
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v ?? ROLES.EQUIPE)}>
              <SelectTrigger className="w-full">{roleLabel}</SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUsersTable({ users, metiers, projects, currentUserId }: Props) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Utilisateurs ({users.length})
        </CardTitle>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Ajouter
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Nom</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Rôle</th>
                <th className="pb-2 pr-4 font-medium">Projets</th>
                <th className="pb-2 pr-4 font-medium">Métiers</th>
                <th className="pb-2 pr-4 font-medium">TJM (€)</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  metiers={metiers}
                  projects={projects}
                  isSelf={user.id === currentUserId}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Card>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

function UserRow({ user, metiers, projects, isSelf }: { user: UserItem; metiers: MetierOption[]; projects: ProjectOption[]; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(newRole: string | null) {
    const role = newRole ?? user.role;
    if (role === user.role) return;
    startTransition(async () => {
      await updateUserRole(user.id, role);
    });
  }

  function handleToggleMetier(metierId: number) {
    startTransition(async () => {
      await toggleUserMetier(user.id, metierId);
    });
  }

  function handleToggleProject(projectId: number) {
    startTransition(async () => {
      await toggleUserProject(user.id, projectId);
    });
  }

  function handleTjmBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value.trim();
    const tjm = raw === "" ? null : parseFloat(raw);
    if (tjm === user.tjm) return;
    startTransition(async () => {
      await updateUserTjm(user.id, tjm);
    });
  }

  const roleLabel =
    ROLE_LABELS[user.role as Role] ?? user.role;

  const userMetierNames = metiers
    .filter((m) => user.metierIds.includes(m.id))
    .map((m) => m.nom);

  const userProjectNames = projects
    .filter((p) => user.projectIds.includes(p.id))
    .map((p) => p.titre);

  return (
    <tr className={`border-b last:border-0 ${isPending ? "opacity-50" : ""}`}>
      <td className="py-2.5 pr-4 font-medium">
        {user.name}
        {isSelf && (
          <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
        )}
      </td>
      <td className="py-2.5 pr-4 text-muted-foreground">{user.email}</td>
      <td className="py-2.5 pr-4">
        {isSelf ? (
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {roleLabel}
          </span>
        ) : (
          <Select
            value={user.role}
            onValueChange={(v) => handleRoleChange(v ?? user.role)}
          >
            <SelectTrigger size="sm">{roleLabel}</SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="py-2.5 pr-4">
        {user.role === ROLES.CLIENT ? (
          <div className="flex flex-wrap items-center gap-1">
            {userProjectNames.map((nom) => (
              <Badge key={nom} variant="secondary" className="text-xs">
                {nom}
              </Badge>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                disabled={isPending}
              >
                <Plus className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                {projects.map((p) => {
                  const active = user.projectIds.includes(p.id);
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handleToggleProject(p.id)}
                    >
                      <Check className={`h-3.5 w-3.5 mr-1.5 ${active ? "opacity-100" : "opacity-0"}`} />
                      {p.titre}
                      {p.clientNom && (
                        <span className="ml-1 text-muted-foreground">({p.clientNom})</span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex flex-wrap items-center gap-1">
          {userMetierNames.map((nom) => (
            <Badge key={nom} variant="secondary" className="text-xs">
              {nom}
            </Badge>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              disabled={isPending}
            >
              <Plus className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {metiers.map((m) => {
                const active = user.metierIds.includes(m.id);
                return (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => handleToggleMetier(m.id)}
                  >
                    <Check className={`h-3.5 w-3.5 mr-1.5 ${active ? "opacity-100" : "opacity-0"}`} />
                    {m.nom}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
      <td className="py-2.5 pr-4">
        <Input
          type="number"
          min={0}
          step={50}
          defaultValue={user.tjm ?? ""}
          onBlur={handleTjmBlur}
          className="h-7 w-24"
          placeholder="—"
          disabled={isPending}
        />
      </td>
    </tr>
  );
}
