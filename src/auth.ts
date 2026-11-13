import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify, hash } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session { user: { id: string; role: Role } & DefaultSession["user"] }
  interface User { role: Role }
}
const input = z.object({login:z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{1,64}$/),password:z.string().min(1).max(128)});
let dummyHash: Promise<string> | undefined;
const secure = process.env.NODE_ENV === "production" && process.env.AUTH_LOCAL_HTTP !== "1";
export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login", error: "/login" },
  useSecureCookies: secure,
  session: { strategy:"jwt", maxAge: 8 * 60 * 60 },
  providers: [Credentials({
    credentials: {login:{},password:{type:"password"}},
    async authorize(credentials, request) {
      const data = input.safeParse(credentials);
      if (!data.success) return null;
      const { login, password } = data.data;
      const source = process.env.TRUST_PROXY_IP === "1" ? request.headers.get("x-real-ip") || "unknown" : "local";
      const keys = ["login:"+login, "source:"+source].map((value) => createHash("sha256").update(value).digest("hex"));
      const now = new Date();
      const expires = new Date(+now+15*60_000);
      const attempts = await db.$transaction(async (tx) => {
        const limits = [8, 40];
        const attempts = [];
        for (const key of keys) {
          const [attempt] = await tx.$queryRaw<{count:number,expiresAt:Date}[]>`
            INSERT INTO "LoginAttempt" ("key", "count", "expiresAt")
            VALUES (${key}, 1, ${expires}::timestamptz AT TIME ZONE 'UTC')
            ON CONFLICT ("key") DO UPDATE SET
              "count" = CASE WHEN "LoginAttempt"."expiresAt" <= (${now}::timestamptz AT TIME ZONE 'UTC')
                THEN 1 ELSE LEAST("LoginAttempt"."count" + 1, 1000) END,
              "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" <= (${now}::timestamptz AT TIME ZONE 'UTC')
                THEN EXCLUDED."expiresAt" ELSE "LoginAttempt"."expiresAt" END
            RETURNING "count", "expiresAt"
          `;
          attempts.push(attempt);
        }
        return attempts.every((attempt, index) => attempt.count <= limits[index])?attempts:null;
      });
      if (!attempts) return null;
      const user = await db.user.findUnique({where:{login},select:{id:true,name:true,role:true,passwordHash:true}});
      const digest = user?.passwordHash ?? await (dummyHash ??= hash(randomBytes(32).toString("hex")));
      if (!(await verify(digest,password)) || !user) return null;
      await db.$transaction([
        db.loginAttempt.deleteMany({where:{key:keys[0],expiresAt:attempts[0].expiresAt}}),
        db.loginAttempt.updateMany({where:{key:keys[1],expiresAt:attempts[1].expiresAt,count:{gt:0}},data:{count:{decrement:1}}}),
      ]);
      return { id:user.id, name:user.name, role:user.role };
    },
  })],
  callbacks: {
    jwt({token,user}) { if(user) token.role = user.role; return token; },
    session({session,token}) {
      if (token.sub) session.user.id=token.sub;
      session.user.role=token.role as Role;
      return session;
    },
  },
});
