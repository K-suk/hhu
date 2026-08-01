import type { Metadata } from "next";
import localFont from "next/font/local";

import { TaproomFooter } from "@/components/layout/taproom-footer";
import { TaproomHeader } from "@/components/layout/taproom-header";
import { ToastProvider } from "@/components/ui/toast-provider";

import "./globals.css";

const geistSans = localFont({
  src: "../public/fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../public/fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

const spaceGrotesk = localFont({
  src: "../public/fonts/SpaceGrotesk-Variable.woff2",
  variable: "--font-space-grotesk",
  display: "swap",
  weight: "300 700",
});

const materialSymbols = localFont({
  src: "../public/fonts/MaterialSymbolsOutlined.woff2",
  variable: "--font-material-symbols",
  display: "swap",
  weight: "100 700",
});

export const metadata: Metadata = {
  title: "HHU",
  description: "Ephemeral matching for UBC students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${materialSymbols.variable} antialiased`}
      >
        <ToastProvider>
          <TaproomHeader />
          {children}
          <TaproomFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
