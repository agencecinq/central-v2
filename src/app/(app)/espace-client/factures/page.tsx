import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/require-client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface DealSummary {
  dealId: number;
  dealTitre: string;
  montantSigne: number | null;
  totalFacture: number;
  resteAFacturer: number | null;
  factures: {
    id: number;
    numero: string;
    montantHT: number;
    dateFacture: Date | null;
  }[];
}

export default async function ClientFacturesPage() {
  const { clientId } = await requireClient();

  const deals = await prisma.deal.findMany({
    where: { clientId },
    include: {
      dealFactures: { orderBy: { dateFacture: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Build deal summaries (only include deals that have at least one facture)
  const dealSummaries: DealSummary[] = deals
    .filter((d) => d.dealFactures.length > 0)
    .map((d) => {
      const montantSigne = d.montantFinal ? Number(d.montantFinal) : null;
      const totalFacture = d.dealFactures.reduce(
        (sum, f) => sum + Number(f.montantHT),
        0,
      );
      const resteAFacturer =
        montantSigne !== null ? Math.max(0, montantSigne - totalFacture) : null;

      return {
        dealId: d.id,
        dealTitre: d.titre,
        montantSigne,
        totalFacture,
        resteAFacturer,
        factures: d.dealFactures.map((f) => ({
          id: f.id,
          numero: f.numero,
          montantHT: Number(f.montantHT),
          dateFacture: f.dateFacture,
        })),
      };
    });

  // Global KPIs
  const totalFacture = dealSummaries.reduce(
    (sum, d) => sum + d.totalFacture,
    0,
  );
  const totalSigne = dealSummaries.reduce(
    (sum, d) => sum + (d.montantSigne ?? 0),
    0,
  );
  const totalResteAFacturer = dealSummaries.reduce(
    (sum, d) => sum + (d.resteAFacturer ?? 0),
    0,
  );
  const nbFactures = dealSummaries.reduce(
    (sum, d) => sum + d.factures.length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/espace-client"
          className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Mes factures
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {nbFactures} facture{nbFactures > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total facturé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {totalFacture > 0 ? formatCurrency(totalFacture) : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Montant signé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {totalSigne > 0 ? formatCurrency(totalSigne) : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reste à facturer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {totalResteAFacturer > 0
                ? formatCurrency(totalResteAFacturer)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Factures par deal */}
      {dealSummaries.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          Aucune facture pour le moment.
        </div>
      ) : (
        <div className="space-y-4">
          {dealSummaries.map((ds) => (
            <Card key={ds.dealId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{ds.dealTitre}</CardTitle>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {ds.montantSigne !== null && (
                      <span>
                        Signé : {formatCurrency(ds.montantSigne)}
                      </span>
                    )}
                    <Badge
                      variant={
                        ds.resteAFacturer !== null && ds.resteAFacturer > 0
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {ds.resteAFacturer !== null && ds.resteAFacturer > 0
                        ? `Reste ${formatCurrency(ds.resteAFacturer)}`
                        : "Facturé à 100%"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead className="text-right">Montant HT</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ds.factures.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">
                          {f.numero}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(f.montantHT)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(f.dateFacture)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
