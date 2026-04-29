import { Inter, Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Keep existing export names so shared Tailwind utilities continue to work.
export const apercuRegular = {
  variable: spaceGrotesk.variable,
};

export const apercuBold = {
  variable: spaceGrotesk.variable,
};

export const dmSans = {
  variable: inter.variable,
};
