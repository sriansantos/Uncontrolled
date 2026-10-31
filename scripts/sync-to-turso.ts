import "dotenv/config";
import { createClient, type Client, type InStatement } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// Copia o banco local (dev.db) para o banco configurado no .env.
//
// Uso:
//   1. Configure no .env:  DATABASE_URL="libsql://seu-banco.turso.io"
//                          DATABASE_AUTH_TOKEN="eyJ..."
//   2. npm run db:sync            → cria as tabelas e copia os dados
//      npm run db:sync -- --force → apaga o que houver no remoto e recopia
//
// Também funciona para testar sem Turso: DATABASE_URL="file:./copia.db".

const TABLES = ["Category", "Recurrence", "Transaction", "BudgetItem"]; // ordem FK-safe
const WIPE_ORDER = ["Transaction", "BudgetItem", "Recurrence", "Category"];

const force = process.argv.includes("--force");

function toFileUrl(p: string): string {
  return "file:" + path.resolve(p.startsWith("file:") ? p.slice(5) : p).replace(/\\/g, "/");
}

function targetConfig(): { url: string; authToken?: string } {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  const token = process.env.DATABASE_AUTH_TOKEN;
  if (raw.startsWith("libsql://")) {
    if (!token) {
      console.error("✗ Para libsql:// defina também DATABASE_AUTH_TOKEN no .env.");
      process.exit(1);
    }
    return { url: raw, authToken: token };
  }
  return { url: toFileUrl(raw) };
}

const localUrl = toFileUrl(process.env.LOCAL_DB_URL ?? "./dev.db");
const source = createClient({ url: localUrl });
const targetCfg = targetConfig();
const target: Client = createClient(targetCfg);

// guarda contra copiar o arquivo nele mesmo
if (targetCfg.url === localUrl) {
  console.error(
    "✗ Origem e destino são o mesmo banco. Configure DATABASE_URL no .env apontando para o Turso (libsql://…)."
  );
  process.exit(1);
}

async function applyMigrations() {
  const dir = path.resolve("prisma/migrations");
  const dirs = fs
    .readdirSync(dir)
    .filter((d) => !d.startsWith("migration_lock"))
    .sort();
  for (const name of dirs) {
    const file = path.join(dir, name, "migration.sql");
    if (!fs.existsSync(file)) continue;
    const sql = fs.readFileSync(file, "utf8");
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await target.batch(
      statements.map((s) => ({ sql: s, args: [] }) satisfies InStatement),
      "write"
    );
    console.log(`  migration aplicada: ${name}`);
  }
}

async function tableExists(name: string): Promise<boolean> {
  const r = await target.execute({
    sql: "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?",
    args: [name],
  });
  return Number(r.rows[0]?.n ?? 0) > 0;
}

async function count(client: Client, table: string): Promise<number> {
  const r = await client.execute({ sql: `SELECT COUNT(*) AS n FROM "${table}"`, args: [] });
  return Number(r.rows[0]?.n ?? 0);
}

async function main() {
  console.log(`→ Origem:  ${localUrl}`);
  console.log(`→ Destino: ${targetCfg.url}`);

  const categoriesExist = await tableExists("Category");
  if (categoriesExist) {
    const existing = await count(target, "Category");
    if (existing > 0 && !force) {
      console.error(
        `✗ O destino já tem ${existing} categorias. Use --force para apagar e recopiar.`
      );
      process.exit(1);
    }
    if (force) {
      console.log("  --force: limpando tabelas do destino…");
      for (const t of WIPE_ORDER) {
        await target.execute({ sql: `DELETE FROM "${t}"`, args: [] });
      }
    }
  } else {
    console.log("  criando tabelas no destino…");
    await applyMigrations();
  }

  for (const table of TABLES) {
    const total = await count(source, table);
    if (total === 0) {
      console.log(`  ${table}: 0 linhas (nada a copiar)`);
      continue;
    }
    const result = await source.execute({ sql: `SELECT * FROM "${table}"`, args: [] });
    const cols = result.columns;
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const placeholders = cols.map(() => "?").join(", ");

    const CHUNK = 50;
    for (let i = 0; i < result.rows.length; i += CHUNK) {
      const stmts: InStatement[] = result.rows
        .slice(i, i + CHUNK)
        .map((row) => ({
          sql: `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
          args: cols.map((c) => row[c]),
        }));
      await target.batch(stmts, "write");
    }
    console.log(`  ${table}: ${total} linhas copiadas`);
  }

  console.log("\n✅ Sincronizado! Confira o resumo:");
  for (const table of TABLES) {
    console.log(`  ${table}: ${await count(target, table)} linhas no destino`);
  }
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => Promise.all([source.close(), target.close()]));
