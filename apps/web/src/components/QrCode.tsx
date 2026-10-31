"use client";

import { QRCodeSVG } from "qrcode.react";

/** Always black on white so every phone camera can read it, in both themes. */
export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  return (
    <div className="inline-block rounded-2xl bg-white p-3">
      <QRCodeSVG value={value} size={size} level="M" bgColor="#FFFFFF" fgColor="#121212" />
    </div>
  );
}
