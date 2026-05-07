"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";

export function ImpersonationBanner({ clientName }: { clientName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStop() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/impersonate", { method: "DELETE" });
      if (!res.ok) {
        setError("Impossible de quitter la prévisualisation");
        return;
      }
      // On retourne à l'admin
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-7 py-2.5 text-sm"
      style={{
        background: "#fff7ed",
        borderColor: "#fdba74",
        color: "#9a3412",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Mode prévisualisation — vous voyez l&apos;espace client de{" "}
          <strong>{clientName}</strong>
        </span>
        {error && (
          <span className="ml-2 text-red-700 text-xs">{error}</span>
        )}
      </div>
      <button
        onClick={handleStop}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-orange-100 disabled:opacity-60"
        style={{ borderColor: "#fdba74", background: "#ffedd5" }}
      >
        <X className="h-3.5 w-3.5" />
        {isPending ? "Sortie..." : "Quitter la prévisualisation"}
      </button>
    </div>
  );
}
