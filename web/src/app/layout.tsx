import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/**
 * next/font self-hosts the files at build time: no request to Google when the
 * page loads, and no layout shift while a webfont swaps in.
 *
 * Geist for the interface, Geist Mono for numbers and dates - a monospaced
 * face gives every digit the same width, so figures line up down a column
 * instead of wandering.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job Seeker",
  description: "Vacancies scored against your profile, and CVs tailored to them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
