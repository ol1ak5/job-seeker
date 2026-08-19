import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";

/**
 * next/font self-hosts the files at build time: no request to Google when the
 * page loads, and no layout shift while a webfont swaps in.
 *
 * Fira Sans for the interface, Fira Code for numbers and dates - a monospaced
 * face gives every digit the same width, so figures line up down a column
 * instead of wandering.
 */
const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Job Seeker",
  description: "Vacancies scored against your profile, and CVs tailored to them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
