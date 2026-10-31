import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: { default: "Kinly — a companion for the people you love", template: "%s · Kinly" },
  description:
    "Kinly is a voice companion for older adults: daily check-in calls in their language, medicine reminders, safety alerts and real video calls with family.",
  applicationName: "Kinly",
};

export const viewport: Viewport = {
  themeColor: "#f6f2ea",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable} ${atkinson.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
