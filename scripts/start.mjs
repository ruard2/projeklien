import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const port = process.env.PORT || "8081";
const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const prismaBin = join(process.cwd(), "node_modules", "prisma", "build", "index.js");

if (!existsSync(nextBin)) {
  console.error("[start] Next.js binary not found. Did the install step finish?");
  process.exit(1);
}

// Databasis bywerk voor die bediener begin (idempotent; veilig by elke herbegin).
function run(label, args) {
  console.log(`[start] ${label} …`);
  const r = spawnSync(process.execPath, args, { cwd: process.cwd(), env: process.env, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`[start] ${label} het misluk (kode ${r.status}).`);
    process.exit(1);
  }
}
run("prisma migrate deploy", [prismaBin, "migrate", "deploy"]);
run("seed", [join(process.cwd(), "scripts", "seed.mjs")]);

if (!process.env.PORT) {
  console.warn("[start] PORT is not set; falling back to local port 8081.");
} else {
  console.log(`[start] PORT from environment is ${process.env.PORT}.`);
}

console.log(`[start] Starting Next.js on 0.0.0.0:${port}`);
console.log(
  `[start] IMPORTANT: the Railway public domain 'target port' MUST equal ${port}, ` +
    "otherwise the public URL returns 502 even though this container is healthy."
);

const child = spawn(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", port], {
  cwd: process.cwd(),
  env: process.env,
  shell: false,
  stdio: "inherit"
});

function stop(signal) {
  console.log(`[start] Received ${signal}, stopping Next.js.`);
  child.kill(signal);
}

process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

child.on("exit", (code, signal) => {
  if (signal === "SIGTERM" || signal === "SIGINT") {
    process.exit(0);
  }

  process.exit(code ?? 1);
});
