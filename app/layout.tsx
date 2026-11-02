import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://chagyeong-tea-room.ugojee.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "차경 — 토끼들의 온라인 다실",
  description: "토끼가 되어 조용히 차를 마시고 머무는 현대적인 3D 온라인 다실",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "차경 茶境 — 토끼들의 온라인 다실",
    description: "토끼가 되어 조용히 차를 마시고 머무는 현대적인 3D 온라인 다실",
    url: SITE_URL,
    siteName: "차경 茶境",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/chagyeong-og.png", width: 1200, height: 630, alt: "차경 茶境 온라인 다실" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "차경 茶境 — 토끼들의 온라인 다실",
    description: "토끼가 되어 조용히 차를 마시고 머무는 현대적인 3D 온라인 다실",
    images: ["/chagyeong-og.png"],
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
