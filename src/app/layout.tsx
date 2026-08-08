import "./globals.css";

import type { Metadata } from "next";
import { Anuphan, Geist_Mono } from "next/font/google";

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tax-Maxxing — คำนวณภาษีบุคคลธรรมดา",
  description:
    "เครื่องมือช่วยคำนวณและลดภาษีบุคคลธรรมดาสำหรับคนไทย รองรับ 40(1)/40(2)/40(4) ค่าลดหย่อน และตารางสรุปแบบ ภ.ง.ด.90/91",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${anuphan.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
