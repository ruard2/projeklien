import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "VOL-projek", template: "%s · VOL-projek" },
  description: "Verskynselgebaseerde Ondersoekende Leer — Gereformeerde Hoërskool Dirk Postma",
  icons: { icon: "/wapen.png" },
  robots: { index: false, follow: false }
};

export const viewport: Viewport = { themeColor: "#13296b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="af" className={`${inter.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
