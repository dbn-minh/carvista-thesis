import type { Metadata } from "next";
import "./globals.css";
import ClientBody from "./ClientBody";
import { apercuRegular, apercuBold, dmSans } from "@/lib/fonts";

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
      className={`${apercuRegular.variable} ${apercuBold.variable} ${dmSans.variable}`}
    >
      <body
        suppressHydrationWarning
        className="antialiased font-apercu-regular"
      >
        <ClientBody>{children}</ClientBody>
      </body>
    </html>
  );
}
