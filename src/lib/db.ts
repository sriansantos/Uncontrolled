import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client";

// Dois modos, escolhidos pelo .env (mesmo código para os dois):
// - Local: DATABASE_URL="file:./dev.db"                     → SQLite no disco
// - Turso: DATABASE_URL="libsql://seu-banco.turso.io"       → nuvem (libSQL)
//          + DATABASE_AUTH_TOKEN="eyJ..." (token do painel/CLI)
const raw = process.env.DATABASE_URL ?? "file:./dev.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const config = raw.startsWith("libsql://")
  ? { url: raw, ...(authToken ? { authToken } : {}) }
  : {
      url:
        "file:" +
        path.resolve(raw.startsWith("file:") ? raw.slice(5) : raw).replace(/\\/g, "/"),
    };

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaLibSql(config),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
