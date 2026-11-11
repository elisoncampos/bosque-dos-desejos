import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bosque dos Desejos · Para Júlia",
  description: "Uma floresta encantada. Uma aventura feita para você.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
