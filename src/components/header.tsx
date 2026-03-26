
"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function Header({ variant = 'default', showNavLinks = true, loginUrl = "/login" }: { variant?: 'default' | 'dark', showNavLinks?: boolean, loginUrl?: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 50;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    // Only add scroll listener for the default variant
    if (variant === 'default') {
      window.addEventListener("scroll", handleScroll);
      return () => {
        document.removeEventListener("scroll", handleScroll);
      };
    }
  }, [scrolled, variant]);

  const getTextClassName = () => {
    if (variant === 'dark') return 'text-foreground';
    return scrolled ? 'text-foreground' : 'text-white';
  }

  const navLinks = (
    <>
      {showNavLinks && (
        <>
          <Link
            href="/#plans"
            className={cn("text-sm font-medium hover:underline underline-offset-4", getTextClassName())}
          >
            Plans
          </Link>
          <Link
            href="/#features"
            className={cn("text-sm font-medium hover:underline underline-offset-4", getTextClassName())}
          >
            Features
          </Link>
        </>
      )}
      <ThemeToggle />
      <Link href={loginUrl}>
        <Button variant="outline" className="transition-colors border-primary text-primary hover:bg-primary/10 hover:text-primary">
          Login
        </Button>
      </Link>
    </>
  );

  return (
    <header className={cn(
      "px-4 lg:px-6 h-16 flex items-center z-50 transition-all duration-500",
      variant === 'dark'
        ? "sticky top-0 bg-background shadow-md"
        : `fixed top-0 left-0 right-0 ${scrolled ? "bg-background/90 shadow-lg backdrop-blur-xl border-b border-border/50" : "bg-transparent"}`
    )}>
      <Logo className={cn(getTextClassName(), "transition-all duration-300")} />
      <nav className="ml-auto hidden md:flex gap-4 sm:gap-6 items-center">
        {navLinks}
      </nav>
      <div className="ml-auto md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className={cn("hover:bg-white/20 focus:bg-white/20", getTextClassName())}>
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-background">
            <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
            <nav className="grid gap-6 text-lg font-medium mt-10">
              {showNavLinks && (
                <>
                  <SheetClose asChild>
                    <Link href="#plans" className="hover:underline">Plans</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="#features" className="hover:underline">Features</Link>
                  </SheetClose>
                </>
              )}
              <div className="flex items-center justify-between pt-4">
                <span>Switch Theme</span>
                <ThemeToggle />
              </div>
              <SheetClose asChild>
                <Link href={loginUrl}>
                  <Button variant="outline" className="w-full">Login</Button>
                </Link>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
