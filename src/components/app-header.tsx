import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { UserMenu } from "./user-menu";
import { MainNav } from "./main-nav";

export async function AppHeader() {
  const session = await auth();

  if (!session) return null;

  return (
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard">
            <Image src="/logo.svg" alt="Cinq" width={36} height={36} className="rounded-lg" />
          </Link>
          <MainNav role={session.user.role} />
        </div>
        <UserMenu user={session.user} />
      </div>
    </header>
  );
}
