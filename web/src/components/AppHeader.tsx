"use client";

import Logo from "@/components/Logo";
import SignOutButton from "@/components/SignOutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Vacancies" },
  { href: "/profile", label: "My CV" },
  { href: "/settings", label: "Settings" },
];

/**
 * The header on every signed-in page: the landing page's, with the app's
 * sections in place of its anchors. Tailored CVs have no entry of their own:
 * each one opens from its vacancy's row. A client component only because it reads
 * the path to mark where you are.
 */
export default function AppHeader({
  wide = false,
}: {
  /** Match the dashboard, whose table runs wider than the other pages. */
  wide?: boolean;
}) {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/85 backdrop-blur">
      <div
        className={`mx-auto flex ${wide ? "max-w-7xl" : "max-w-6xl"} flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6`}
      >
        <Link href="/" aria-label="Job Seeker, home">
          <Logo />
        </Link>
        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {LINKS.map((link) => {
            const here = link.href === "/" ? path === "/" : path.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={here ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors duration-150 ${
                  here ? "bg-brand/10 font-medium text-brand" : "text-ink-soft hover:text-brand"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
