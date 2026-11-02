import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: "file:" + path.resolve("dev.db").replace(/\\/g, "/") }),
});

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log("usuários locais:", JSON.stringify(users));
  const grouped = await prisma.category.groupBy({ by: ["userId"], _count: true });
  console.log("categorias por userId:", JSON.stringify(grouped));
  const tx = await prisma.transaction.groupBy({ by: ["userId"], _count: true });
  console.log("transações por userId:", JSON.stringify(tx));
  const bots = await prisma.bot.count();
  console.log("bots:", bots);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
