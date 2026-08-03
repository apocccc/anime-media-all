import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import Twitter from "next-auth/providers/twitter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, AdminLocale } from "@prisma/client";

/**
 * 認証(§3): スタッフ=メール+パスワード / 会員=OAuth(Google・X・Discord)。
 * 単一 User テーブルをロールで分岐する。セッションは JWT。
 * OAuth プロバイダーは環境変数が揃っているもののみ有効化される。
 */

declare module "next-auth" {
  interface User {
    role: Role;
    adminLocale: AdminLocale;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      adminLocale: AdminLocale;
    };
  }
}

const oauthProviders = [
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
    : []),
  ...(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET
    ? [Discord({ clientId: process.env.AUTH_DISCORD_ID, clientSecret: process.env.AUTH_DISCORD_SECRET })]
    : []),
  ...(process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET
    ? [Twitter({ clientId: process.env.AUTH_TWITTER_ID, clientSecret: process.env.AUTH_TWITTER_SECRET })]
    : []),
];

async function uniqueSlug(base: string): Promise<string> {
  const normalized =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "member";
  let slug = normalized;
  let n = 1;
  while (await prisma.user.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${normalized}-${++n}`;
  }
  return slug;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          adminLocale: user.adminLocale,
        };
      },
    }),
    ...oauthProviders,
  ],
  callbacks: {
    /** OAuth 初回ログイン時に会員(reader)として User を作成する */
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      const providerAccountId = account.providerAccountId;
      const existing = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId,
          },
        },
        include: { user: true },
      });
      if (existing) {
        user.id = existing.user.id;
        user.role = existing.user.role;
        user.adminLocale = existing.user.adminLocale;
        return true;
      }
      const email =
        user.email ?? `${account.provider}-${providerAccountId}@members.invalid`;
      const dbUser =
        (await prisma.user.findUnique({ where: { email: email.toLowerCase() } })) ??
        (await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            name: user.name ?? "Member",
            slug: await uniqueSlug(user.name ?? "member"),
            role: "reader",
            avatarUrl: user.image ?? null,
          },
        }));
      await prisma.oAuthAccount.create({
        data: {
          userId: dbUser.id,
          provider: account.provider,
          providerAccountId,
          type: account.type ?? "oauth",
        },
      });
      user.id = dbUser.id;
      user.role = dbUser.role;
      user.adminLocale = dbUser.adminLocale;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.adminLocale = user.adminLocale;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.adminLocale = token.adminLocale as AdminLocale;
      return session;
    },
  },
});

const STAFF_ROLES: Role[] = ["admin", "editor", "author", "contributor"];

export function isStaff(user: { role: Role }): boolean {
  return STAFF_ROLES.includes(user.role);
}

/** 記事の編集権限: admin/editor は全記事、author/contributor は自分の記事のみ */
export function canEditArticle(
  user: { id: string; role: Role },
  article: { authorId: string }
): boolean {
  if (user.role === "admin" || user.role === "editor") return true;
  return article.authorId === user.id;
}

/** 公開権限: admin/editor/author */
export function canPublish(user: { role: Role }): boolean {
  return user.role === "admin" || user.role === "editor" || user.role === "author";
}
