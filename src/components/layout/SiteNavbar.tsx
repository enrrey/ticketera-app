"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavLink {
  label: string;
  href: string;
}

const NAV_LINKS: NavLink[] = [
  { label: "Eventos", href: "#" },
  { label: "Categorías", href: "#" },
  { label: "Ayuda", href: "#" },
];

/**
 * Top-level site navigation: logo + nav links + mobile menu trigger.
 * Purely static/presentational (no props, no state), so it has no
 * dedicated test — same reasoning already applied to `SiteFooter`.
 * Search/date/price filtering lives in `SiteTopbar`, not here.
 */
export function SiteNavbar() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 lg:px-6">
        <Link
          href="/"
          className="shrink-0 text-lg font-semibold text-primary"
        >
          Ticketera
        </Link>

        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto md:hidden"
              />
            }
          >
            <Menu />
            <span className="sr-only">Abrir menú</span>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Ticketera</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-3 px-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
