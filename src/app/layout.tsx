import type { Metadata, Viewport } from "next";

import "./globals.css";

const siteUrl = new URL(process.env.SITE_URL || "http://localhost:3000");
const allowIndexing = process.env.ALLOW_SEARCH_INDEXING === "true";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "Clínica WebMCP Campo Largo — Demonstração",
  description: "MVP fictício de agendamento de consultas com WebMCP e ChatGPT.",
  applicationName: "Clínica WebMCP",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Clínica WebMCP",
    title: "Clínica WebMCP — agendamento de demonstração",
    description: "Teste um agendamento fictício pelo site ou pelas Site Tools do ChatGPT.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clínica WebMCP — agendamento de demonstração com ChatGPT" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clínica WebMCP — agendamento de demonstração",
    description: "MVP fictício de agendamento com WebMCP.",
    images: ["/og.png"],
  },
  robots: {
    index: allowIndexing,
    follow: allowIndexing,
    nocache: !allowIndexing,
    googleBot: { index: allowIndexing, follow: allowIndexing },
  },
};

export const viewport: Viewport = {
  themeColor: "#0f5c51",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
