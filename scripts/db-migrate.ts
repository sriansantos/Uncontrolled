import "dotenv/config";
import { createClient, type Client, type InStatement } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// Aplica as migrations de prisma/migrations no banco do .env (Turso ou local),
// com marcador próprio (_app_migrations). Complemento ao prisma migrate dev,
// que só opera o banco de referência local.
//
// Uso: npm run db:migrate:remote   (ou npx tsx scripts/db-migrate.ts)

function targetConfig(): { url: string; authToken?: string } {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  const token = process.env.DATABASE_AUTH_TOKEN;
  if (raw.startsWith("libsql://")) {
    if (!token) {
      console.error("✗ libsql:// exige DATABASE_AUTH_TOKEN no .env");
      process.exit(1);
    }
    return { url: raw, authToken: token };
  }
  return {
    url: "file:" + path.resolve(raw.startsWith("file:") ? raw.slice(5) : raw).replace(/\\/g, "/"),
  };
}

async function tableExists(client: Client, table: string): Promise<boolean> {
  const r = await client.execute({
    sql: "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?",
    args: [table],
  });
  return Number(r.rows[0]?.n ?? 0) > 0;
}

async function main() {
  const cfg = targetConfig();
  const client = createClient(cfg);
  console.log(`→ Destino: ${cfg.url}`);

  await client.execute(
    "CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
  );

  const applied = new Set(
    (await client.execute("SELECT name FROM _app_migrations")).rows.map((r) => String(r[0]))
  );

  const dir = path.resolve("prisma/migrations");
  const folders = fs.readdirSync(dir).filter((d) => !d.startsWith("migration_lock")).sort();

  for (const name of folders) {
    if (applied.has(name)) {
      console.log(`  = ${name} (já aplicada)`);
      continue;
    }
    const file = path.join(dir, name, "migration.sql");
    if (!fs.existsSync(file)) continue;
    const sql = fs.readFileSync(file, "utf8");

    // Heurística de idempotência: se a primeira tabela da migration já
    // existe no destino (ex.: criada por outra via), marca como aplicada.
    const firstTable = sql.match(/CREATE TABLE\s+"?(\w+)"?/i)?.[1];
    if (firstTable && (await tableExists(client, firstTable))) {
      console.log(`  = ${name} (tabela ${firstTable} já existe — marcada)`);
      await client.execute({ sql: "INSERT INTO _app_migrations (name, applied_at) VALUES (?, ?)", args: [name, new Date().toISOString()] });
      continue;
    }

    const statements = sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
    await client.batch(statements.map((s) => ({ sql: s, args: [] }) satisfies InStatement), "write");
    await client.execute({ sql: "INSERT INTO _app_migrations (name, applied_at) VALUES (?, ?)", args: [name, new Date().toISOString()] });
    console.log(`  ✓ ${name} aplicada`);
  }

  console.log("✅ Migrations em dia.");
  await client.close();
}

main().catch((e) => {
  console.error("✗ Falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
