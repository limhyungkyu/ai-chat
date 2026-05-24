import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata = {
  title: "SUEAAZ AI Chat - 다국어 글래스모피즘 AI 채팅 서비스",
  description: "한국어로 질문하면 일본어 또는 원하는 언어로 AI가 실시간으로 번역하고 답변해주는 프리미엄 글래스모피즘 AI 채팅 서비스입니다.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${inter.variable} ${outfit.variable} h-full dark`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="h-full w-full overflow-hidden flex bg-[#0a080d] antialiased">
        {children}
      </body>
    </html>
  );
}
