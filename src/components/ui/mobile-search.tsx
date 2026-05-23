"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * On mobile: renders a Search icon button. Clicking it slides a search bar
 * down from the top of the viewport as a fixed overlay.
 * On desktop (md+): renders a standard inline search input.
 */
export function MobileSearch({ value, onChange, placeholder = "Search...", className }: MobileSearchProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when overlay opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleClose = () => setOpen(false);

  return (
    <>
      {/* ── Mobile: icon trigger ─────────────────────────────── */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("md:hidden shrink-0", value && "border-primary text-primary")}
        onClick={() => setOpen(true)}
        aria-label="Open search"
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* ── Mobile: sliding overlay from top ─────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={handleClose}
        >
          {/* dim backdrop */}
          <div className="absolute inset-0 bg-black/30" />

          {/* search bar panel */}
          <div
            className="absolute top-0 left-0 right-0 bg-background border-b shadow-xl px-4 py-3 animate-in slide-in-from-top duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputRef}
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="pl-9 h-10"
                />
                {value && (
                  <button
                    type="button"
                    onClick={() => onChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={handleClose} aria-label="Close search">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop: standard inline input ───────────────────── */}
      <div className={cn("relative hidden md:block", className ?? "flex-1")}>
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-8"
        />
      </div>
    </>
  );
}
