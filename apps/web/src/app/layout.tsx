import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonts ship inside the app (src/app/fonts) so they load the same everywhere, with no call to Google Fonts.
const anton = localFont({ src: "./fonts/Anton.woff2", weight: "400", variable: "--font-anton", display: "swap" });
const oswald = localFont({ src: "./fonts/Oswald.woff2", weight: "200 700", variable: "--font-oswald", display: "swap" });

const DESCRIPTION = "Know the moment your class gets lost. Anonymous, live feedback from every student: reactions, upvoted questions, polls and an AI report after class.";

export const metadata: Metadata = {
  // Absolute links in share cards need the public address.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "HandsUp · live classroom feedback", template: "%s · HandsUp" },
  description: DESCRIPTION,
  applicationName: "HandsUp",
  keywords: ["classroom feedback", "student engagement", "anonymous questions", "live polls", "lecture", "teaching"],
  openGraph: { type: "website", siteName: "HandsUp", title: "HandsUp · live classroom feedback", description: DESCRIPTION, locale: "en" },
  twitter: { card: "summary_large_image", title: "HandsUp · live classroom feedback", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEEBE5" },
    { media: "(prefers-color-scheme: dark)", color: "#1B1A18" },
  ],
};

// Applies the saved theme before first paint so there's no flash.
const themeScript = `try{var t=localStorage.getItem("handsup:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${oswald.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
