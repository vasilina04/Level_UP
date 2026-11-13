import { PrismaClient } from "@prisma/client";
const globalDatabase = globalThis as typeof globalThis & { levelUpDb?: PrismaClient };
export const db = globalDatabase.levelUpDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDatabase.levelUpDb = db;
