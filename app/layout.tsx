import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "차경 — 토끼들의 온라인 다실",
  description: "토끼가 되어 조용히 차를 마시고 머무는 현대적인 3D 온라인 다실",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "차경 茶境 — 토끼들의 온라인 다실",
    description: "토끼가 되어 조용히 차를 마시고 머무는 현대적인 3D 온라인 다실",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/chagyeong-og-v1.png", width: 1672, height: 941, alt: "차경 茶境 온라인 다실" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "차경 茶境 — 토끼들의 온라인 다실",
    description: "토끼가 되어 조용히 차를 마시고 머무는 현대적인 3D 온라인 다실",
    images: ["/chagyeong-og-v1.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
