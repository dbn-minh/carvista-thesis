import localFont from "next/font/local";

// Apercu fonts
export const apercuRegular = localFont({
  src: "../../public/fonts/Apercu-Regular.woff2",
  variable: "--font-apercu-regular",
  display: "swap",
});

export const apercuBold = localFont({
  src: "../../public/fonts/Apercu-Bold.woff2",
  variable: "--font-apercu-bold",
  display: "swap",
});

// DM Sans font
export const dmSans = localFont({
  src: "../../public/fonts/DMSans-Variable.woff2",
  variable: "--font-dm-sans",
  display: "swap",
});
