import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/students", "/teachers", "/join", "/privacy", "/terms"].map((path) => ({ url: `${appUrl()}${path}`, changeFrequency: "monthly", priority: path ? 0.6 : 1 }));
}
