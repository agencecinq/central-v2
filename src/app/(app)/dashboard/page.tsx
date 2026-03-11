import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Redirect clients to their dedicated portal
  if (session.user.role === "client") {
    redirect("/espace-client");
  }

  const firstName = session.user.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Bonjour, {firstName}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Bienvenue sur votre tableau de bord.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projets actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">&mdash;</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tâches en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">&mdash;</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Prochaine échéance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">&mdash;</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            Les fonctionnalités arrivent bientôt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
