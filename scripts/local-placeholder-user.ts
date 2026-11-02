import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";

// Insere um usuário de referência no dev.db LOCAL (o CLI do Prisma opera
// esse banco na migração — o backfill do multi-usuário precisa de um User).
const config = {
  url: "file:" + path.resolve("dev.db").replace(/\\/g, "/"),
};
const prisma = new PrismaClient({ adapter: new PrismaLibSql(config) });

async function main() {
  const count = await prisma.user.count();
  if (count === 0) {
    await prisma.user.create({
      data: { email: "dev@local", passwordHash: "local-placeholder" },
    });
    console.log("usuário placeholder criado no dev.db local");
  } else {
    console.log(`dev.db já tem ${count} usuário(s) — nada a fazer`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
