"use client";

import { useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { updateUserRole, updateUserTjm, toggleUserMetier } from "./actions";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MetierOption {
  id: number;
  nom: string;
}

interface UserItem {
  id: number;
  name: string;
  email: string;
  role: string;
  tjm: number | null;
  metierIds: number[];
  createdAt: string | null;
}

interface Props {
  users: UserItem[];
  metiers: MetierOption[];
  currentUserId: number;
}

// ─── Main table ─────────────────────────────────────────────────────────────

export function AdminUsersTable({ users, metiers, currentUserId }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Utilisateurs ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Nom</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Rôle</th>
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
                  isSelf={user.id === currentUserId}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [Role, string][];

function UserRow({ user, metiers, isSelf }: { user: UserItem; metiers: MetierOption[]; isSelf: boolean }) {
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
