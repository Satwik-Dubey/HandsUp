import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { resolve } from "node:path";

// One .env for the whole monorepo, in the repo root.
loadEnvConfig(resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production", undefined, true);

/** Lets phones on your Wi-Fi load the dev server when NEXT_PUBLIC_APP_URL points at your computer's address. */
function devOrigins(): string[] {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").hostname;
    return host && host !== "localhost" ? [host] : [];
  } catch {
    return [];
  }
}

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@handsup/shared", "@handsup/db"],
  // pdf-lib is large; load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["pdf-lib"],
  allowedDevOrigins: devOrigins(),
};

export default config;
