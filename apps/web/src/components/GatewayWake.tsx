"use client";

import { useEffect } from "react";
import { gatewayUrl } from "@/lib/gateway";

/**
 * Pings the realtime server once when a teacher opens their pages. On a free host that
 * sleeps when idle, this wakes it up while the teacher is still preparing, so it's ready
 * by the time they press Go live and students scan the QR.
 */
export function GatewayWake() {
  useEffect(() => {
    fetch(`${gatewayUrl()}/health`, { mode: "no-cors", cache: "no-store" }).catch(() => {});
  }, []);
  return null;
}
