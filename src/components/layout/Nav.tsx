"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { primaryNav } from "@/lib/nav";
import { cta } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Nav() {
  const [open, setOpen] = useState(false); // mobile menu
  const [menu, setMenu] = useState<string | null>(null); // desktop dropdown label
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const prevOpen = useRef(false);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Return focus to the toggle when the mobile menu closes (but not on first
  // mount), so keyboard users aren't dropped at the top of the document.
  useEffect(() => {
    if (prevOpen.current && !open) toggleRef.current?.focus();
    prevOpen.current = open;
  }, [open]);

  // Close desktop dropdown AND the mobile menu on outside click / Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu(null);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function isActive(href: string) {
    const base = href.split("#")[0];
    return pathname === href || (base !== "/" && pathname.startsWith(base));
  }

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md no-print"
    >
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="SC Design Wirral — home"
        >
          <span aria-hidden className="font-display text-2xl font-bold leading-none">
            <span className="text-ink">|</span>
            <span className="text-accent-strong">SC</span>
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-base text-ink">Design Wirral</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted">
              Architectural Design
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-0.5 lg:flex">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            if (!item.children) {
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-card",
                      active && "text-accent-strong"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            }
            const panelId = `menu-${item.label.toLowerCase()}`;
            const isOpen = menu === item.label;
            return (
              <li
                key={item.href}
                className="relative"
                onMouseEnter={() => setMenu(item.label)}
                onMouseLeave={() => setMenu(null)}
                onBlur={(e) => {
                  // Close when keyboard focus leaves this menu group entirely.
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenu(null);
                }}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setMenu((m) => (m === item.label ? null : item.label))}
                  onKeyDown={(e) => {
                    // ArrowDown opens the panel and moves focus to its first link.
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMenu(item.label);
                      requestAnimationFrame(() => {
                        document
                          .getElementById(panelId)
                          ?.querySelector<HTMLElement>("a")
                          ?.focus();
                      });
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-card",
                    (active || isOpen) && "text-accent-strong"
                  )}
                >
                  {item.label}
                  <span aria-hidden className="text-[10px]">
                    ▾
                  </span>
                </button>
                <div
                  id={panelId}
                  hidden={!isOpen}
                  className="absolute left-0 top-full z-50 min-w-56 rounded-xl border border-line bg-paper p-2 shadow-card-hover"
                >
                  <ul>
                    {item.children.map((c) => (
                      <li key={c.href}>
                        <Link
                          href={c.href}
                          onClick={() => setMenu(null)}
                          className="block rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-paper-card hover:text-accent-strong"
                        >
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="hidden lg:block">
          <Link
            href={cta.primary.href}
            className="inline-flex h-10 items-center rounded-full bg-accent-strong px-5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
          >
            {cta.primary.label}
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          ref={toggleRef}
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="text-2xl" aria-hidden>
            {open ? "✕" : "☰"}
          </span>
        </button>
      </nav>

      {/* Mobile menu — always rendered, hidden via the [hidden] attribute when
          closed so aria-controls always resolves and the links leave the a11y
          tree + tab order when the menu is shut. */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="max-h-[calc(100dvh-4rem)] overflow-y-auto lg:hidden"
      >
        <ul className="space-y-1 border-t border-line bg-paper px-5 pb-8 pt-3">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-3 text-base font-semibold hover:bg-paper-card",
                    active ? "text-accent-strong" : "text-ink"
                  )}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <ul className="mb-1 ml-3 border-l border-line pl-3">
                    {item.children
                      .filter((c) => !c.label.startsWith("All "))
                      .map((c) => {
                        const cActive = isActive(c.href);
                        return (
                          <li key={c.href}>
                            <Link
                              href={c.href}
                              aria-current={cActive ? "page" : undefined}
                              className={cn(
                                "block rounded-md px-3 py-2 text-sm hover:bg-paper-card",
                                cActive ? "text-accent-strong" : "text-ink-soft"
                              )}
                              onClick={() => setOpen(false)}
                            >
                              {c.label}
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </li>
            );
          })}
          <li>
            <Link
              href="/contact"
              aria-current={isActive("/contact") ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-3 text-base font-semibold hover:bg-paper-card",
                isActive("/contact") ? "text-accent-strong" : "text-ink"
              )}
              onClick={() => setOpen(false)}
            >
              Contact
            </Link>
          </li>
          <li className="pt-2">
            <Link
              href={cta.primary.href}
              className="block rounded-full bg-accent-strong px-5 py-3 text-center text-base font-medium text-white transition-colors hover:bg-accent-deep"
              onClick={() => setOpen(false)}
            >
              {cta.primary.label}
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
