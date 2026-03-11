import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.events.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        const email = credentials.email as string;
        const password = credentials.password as string;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      // Credentials — already validated by authorize()
      if (account?.provider === "credentials") return true;

      if (account?.provider !== "google" || !profile?.email) return false;

      const googleId = profile.sub!;
      const email = profile.email;
      const emailVerified = profile.email_verified as boolean;

      // 1. Find by google_id
      let user = await prisma.user.findUnique({
        where: { googleId },
      });

      // 2. If not found, find by email (only if verified)
      if (!user && emailVerified) {
        user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        // Auto-attach google_id to existing user
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { googleId },
          });
        }
      }

      // 3. If still not found, create new user
      if (!user) {
        if (!emailVerified) return false;

        user = await prisma.user.create({
          data: {
            name: profile.name || email,
            email: email.toLowerCase(),
            googleId,
            role: "equipe",
            password: await bcrypt.hash(
              crypto.randomUUID(),
              10
            ),
            emailVerifiedAt: new Date(),
          },
        });
      }

      // 4. Update Google tokens for calendar sync
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleCalendarToken: account.access_token,
          googleRefreshToken: account.refresh_token ?? user.googleRefreshToken,
          googleTokenExpiresAt: account.expires_at
            ? new Date(account.expires_at * 1000)
            : null,
        },
      });

      return true;
    },

    async jwt({ token, account, profile, user }) {
      // On initial sign-in, attach user data to the JWT
      if (account?.provider === "credentials" && user) {
        token.userId = Number(user.id);
        token.role = (user as Record<string, unknown>).role as string;
        token.name = user.name;
        token.email = user.email;
      } else if (account?.provider === "google" && profile?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: profile.email.toLowerCase() },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.email = dbUser.email;
        }
      }

      // On subsequent requests, refresh role from DB
      // (ensures role changes from admin page take effect without re-login)
      if (token.userId && !account) {
        const user = await prisma.user.findUnique({
          where: { id: Number(token.userId) },
          select: { role: true },
        });
        if (user) {
          token.role = user.role;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = String(token.userId ?? "");
        session.user.role = (token.role as string) ?? "";
        session.user.name = (token.name as string) ?? "";
        session.user.email = (token.email as string) ?? "";
      }
      return session;
    },
  },
});
