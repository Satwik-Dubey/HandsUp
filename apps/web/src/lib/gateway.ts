"use client";

/**
 * Where the browser finds the realtime gateway. If NEXT_PUBLIC_GATEWAY_URL is empty,
 * use the host the page was loaded from on port 4000, so a phone that opened
 * http://192.168.1.23:3000 talks to http://192.168.1.23:4000.
 */
export function gatewayUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000`;
}
