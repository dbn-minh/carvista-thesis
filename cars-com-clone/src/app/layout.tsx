import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ClientBody from "./ClientBody";
import { apercuRegular, apercuBold, dmSans } from "@/lib/fonts";

const themeInitScript = `
(() => {
  try {
    const storageKey = "carvista-theme";
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (_) {}
})();
`;

export const metadata: Metadata = {
  title: "CarVista | AI-Powered Intelligent Car Platform",
  description:
    "Explore real car data, compare models intelligently, track listings, and use AI-powered insights for price trends, total cost of ownership, and expert-style guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${apercuRegular.variable} ${apercuBold.variable} ${dmSans.variable}`}
    >
      <head>
        <Script id="carvista-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className="antialiased bg-background font-dm-sans text-foreground"
      >
        <ClientBody>{children}</ClientBody>
      </body>
    </html>
  );
}
