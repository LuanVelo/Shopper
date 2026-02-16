import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shopper v0",
  description: "Comparador de preços de supermercado"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
