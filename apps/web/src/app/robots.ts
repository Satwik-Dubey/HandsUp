import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/utils";

/** Public pages may be indexed; teacher and class pages stay out of search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/students", "/teachers", "/privacy", "/terms", "/join"], disallow: ["/courses", "/sessions", "/welcome", "/j/", "/r/", "/api/"] },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
