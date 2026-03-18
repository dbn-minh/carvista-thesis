import type { Metadata } from "next";
import "./globals.css";
import ClientBody from "./ClientBody";
import { apercuRegular, apercuBold, dmSans } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "New Cars, Used Cars, Car Dealers, Prices & Reviews | Cars.com",
  description:
    "Find the perfect car for your needs at Cars.com. Shop new and used cars, sell your car, compare prices, and explore financing options to find your dream car today!",
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
