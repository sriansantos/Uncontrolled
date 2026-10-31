import "dotenv/config";
import { defineConfig } from "prisma/config";

// O CLI do Prisma opera o banco de referência local (dev.db): `prisma migrate dev`
// atualiza o schema local e gera o client. Para aplicar no Turso, use
// `npm run db:migrate:remote` (scripts/db-migrate.ts).
// Se DATABASE_URL apontar para o Turso, damos a url de referência file: ao CLI.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]?.startsWith("libsql://")
      ? "file:./dev.db"
      : (process.env["DATABASE_URL"] ?? "file:./dev.db"),
  },
});
