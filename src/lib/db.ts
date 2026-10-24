import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client";

// SQLite local na raiz do projeto (file:./dev.db em .env). O libsql exige
// caminho absoluto, então resolvemos relativo ao cwd — a raiz do projeto
// tanto no dev server quanto nos scripts. PrismaLibSql é uma factory que
// recebe a config, não um client instanciado.
const configured = process.env.DATABASE_URL ?? "file:./dev.db";
const url = configured.startsWith("file:")
  ? "file:" + path.resolve(configured.slice("file:".length)).replace(/\\/g, "/")
  : configured;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaLibSql({ url }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
