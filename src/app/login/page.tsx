import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/logo.svg" alt="Cinq" width={56} height={56} className="mb-4 rounded-xl" />
          <p className="text-sm text-muted-foreground">
            Gestion d&apos;agence
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg font-semibold">Connexion</CardTitle>
            <CardDescription>
              Connectez-vous pour accéder à votre espace
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
