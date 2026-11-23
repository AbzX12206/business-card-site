/**
 * Собирает сайт дважды (основной режим и режим аналитики), поднимает `vite preview`
 * и запускает tests/e2e.mjs. Нужны: npm i, npx playwright install chromium.
 */
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const PORT = 4173;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const run = (cmd, args, env = {}) => spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });

async function waitFor(url, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* сервер ещё не поднялся */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`preview не ответил на ${url}`);
}

async function pass(mode, buildEnv) {
  const outDir = `dist-e2e-${mode}`;
  rmSync(outDir, { recursive: true, force: true });
  if (run(npx, ["vite", "build", "--outDir", outDir], buildEnv).status !== 0) return 1;
  const preview = spawn(npx, ["vite", "preview", "--outDir", outDir, "--port", String(PORT), "--strictPort"], { stdio: "inherit" });
  try {
    await waitFor(`http://localhost:${PORT}/`);
    return run("node", ["tests/e2e.mjs"], { BASE_URL: `http://localhost:${PORT}`, E2E_MODE: mode }).status ?? 1;
  } finally {
    preview.kill();
    rmSync(outDir, { recursive: true, force: true });
  }
}

const results = [
  await pass("main", { VITE_LEAD_ENDPOINT: "/api/lead", VITE_GA4_ID: "" }),
  await pass("analytics", { VITE_LEAD_ENDPOINT: "/api/lead", VITE_GA4_ID: "G-TEST1234" }),
];
process.exit(results.some((code) => code !== 0) ? 1 : 0);
