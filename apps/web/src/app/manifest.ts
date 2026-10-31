import type { MetadataRoute } from "next";

/** Lets students "Add to Home Screen" (never required). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HandsUp",
    short_name: "HandsUp",
    description: "Tell your teacher when you're lost, anonymously.",
    start_url: "/join",
    display: "standalone",
    background_color: "#EEEBE5",
    theme_color: "#E0573F",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
