import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["variant", ['&:is([data-theme="dark"] *)', '@media (prefers-color-scheme: dark) { &:not([data-theme="light"] *) }']],
  theme: {
    extend: {
      colors: {
        paper: v("bg"),
        card: v("card"),
        ink: v("ink"),
        muted: v("muted"),
        line: v("line"),
        text2: v("text2"),
        "on-ink": v("on-ink"),
        // a touch deeper than the design's #E0573F so white text on coral meets WCAG AA (4.5:1)
        coral: { DEFAULT: "#CC4A31", 2: "#F08A6F" },
        forest: "#3F7A61",
        sun: "#F2C94C",
        sky: "#9CCADF",
        lime: "#8CC56C",
        violet: "#9A7CEB",
        pink: "#F3A9B7",
      },
      fontFamily: {
        poster: ["var(--font-anton)", "Oswald", "Impact", "Arial Narrow", "sans-serif"],
        cond: ["var(--font-oswald)", "Arial Narrow", "system-ui", "sans-serif"],
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        soft: "0 2px 8px rgba(60,45,30,.08)",
        float: "0 8px 24px rgba(60,45,30,.16)",
      },
      keyframes: {
        pop: { "0%": { transform: "scale(1)" }, "40%": { transform: "scale(0.92)" }, "100%": { transform: "scale(1)" } },
        boing: { "0%": { transform: "scale(1)" }, "35%": { transform: "scale(1.22) rotate(-6deg)" }, "100%": { transform: "scale(1)" } },
        rise: { "0%": { opacity: "1", transform: "translateY(0)" }, "100%": { opacity: "0", transform: "translateY(-40px)" } },
        "fade-up": { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "none" } },
        "slide-up": { "0%": { opacity: "0", transform: "translateY(40px) scale(.97)" }, "100%": { opacity: "1", transform: "none" } },
        "slide-in": { "0%": { opacity: "0", transform: "translateX(-16px)" }, "100%": { opacity: "1", transform: "none" } },
        "grow-x": { "0%": { transform: "scaleX(0)" }, "100%": { transform: "scaleX(1)" } },
        "grow-y": { "0%": { transform: "scaleY(0)" }, "100%": { transform: "scaleY(1)" } },
        ring: { "0%": { boxShadow: "0 0 0 0 rgba(224,87,63,.55)" }, "100%": { boxShadow: "0 0 0 14px rgba(224,87,63,0)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        fall: { "0%": { transform: "translateY(-10vh) rotate(0)", opacity: "1" }, "100%": { transform: "translateY(105vh) rotate(720deg)", opacity: "0.9" } },
      },
      animation: {
        pop: "pop .18s ease-out",
        boing: "boing .32s ease-out",
        rise: "rise .7s ease-out forwards",
        "fade-up": "fade-up .35s ease-out both",
        "slide-up": "slide-up .45s cubic-bezier(.2,.9,.3,1.2) both",
        "slide-in": "slide-in .4s ease-out both",
        "grow-x": "grow-x .7s cubic-bezier(.2,.8,.2,1) both",
        "grow-y": "grow-y .6s cubic-bezier(.2,.9,.3,1.15) both",
        ring: "ring 1.1s ease-out 2",
        float: "float 6s ease-in-out infinite",
        fall: "fall 2.8s ease-in forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
