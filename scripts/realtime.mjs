// Runs the gateway and the workers together in one process group, for hosts where
// one always-on service is all you get (Render's free plan). Locally, `pnpm dev` is still the way.
//   node scripts/realtime.mjs        (after `pnpm --filter @handsup/gateway --filter @handsup/workers build`)
// If either one stops, the other is stopped too and this exits, so the host restarts both.
import { spawn } from "node:child_process";

const port = process.env.PORT ?? process.env.GATEWAY_PORT ?? "4000";
const env = {
  ...process.env,
  // Demo students (run by the workers) connect to the gateway next door.
  GATEWAY_INTERNAL_URL: process.env.GATEWAY_INTERNAL_URL || `http://127.0.0.1:${port}`,
};

const children = [
  ["gateway", "apps/gateway/dist/index.js"],
  ["workers", "apps/workers/dist/index.js"],
].map(([name, file]) => {
  const child = spawn(process.execPath, [file], { env, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    console.error(`[realtime] ${name} stopped (${signal ?? code}); stopping the rest.`);
    shutdown(code ?? 1);
  });
  return child;
});

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 3000).unref();
}
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
