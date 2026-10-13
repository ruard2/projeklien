// Plaaslike Postgres sonder Docker (slegs vir ontwikkeling).
// Begin met: npm run db  — en laat dit in 'n aparte terminaal loop.
// Produksie (Railway) gebruik sy eie Postgres via DATABASE_URL.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { join } from "node:path";

const port = Number(process.env.DEV_DB_PORT || 5439);
const dataDir = join(process.cwd(), ".pgdata");
const fresh = !existsSync(join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "vol",
  password: "vol",
  port,
  persistent: true,
  onLog: () => {},
  onError: (m) => console.error("[db]", String(m).trim())
});

if (fresh) {
  console.log("[db] Nuwe databasis-gids word geskep in .pgdata …");
  await pg.initialise();
}
try {
  await pg.start();
} catch (e) {
  console.error(`[db] Kon nie begin nie. Loop Postgres dalk reeds op poort ${port}? (${e?.message ?? e ?? "onbekende fout"})`);
  console.error("[db] Indien nie: verwyder .pgdata/postmaster.pid en probeer weer.");
  process.exit(1);
}

const client = pg.getPgClient();
await client.connect();
const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'vol'");
if (res.rowCount === 0) {
  await client.query("CREATE DATABASE vol");
  console.log("[db] Databasis 'vol' geskep.");
}
await client.end();

console.log(`[db] Postgres loop op poort ${port}.`);
console.log(`[db] DATABASE_URL="postgresql://vol:vol@localhost:${port}/vol"`);
console.log("[db] Druk Ctrl+C om te stop.");

async function stop() {
  console.log("\n[db] Stop …");
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
