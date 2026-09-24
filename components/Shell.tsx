"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const LINKS = [
  { href: "/", label: "Обзор" },
  { href: "/map", label: "Тепловая карта" },
  { href: "/fleet", label: "Водовозы" },
  { href: "/reports", label: "Жалобы" },
  { href: "/analytics", label: "Аналитика" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-[#1b1f27]">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-[#e8ebf0] bg-white px-4 py-6">
          <div className="px-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f6bff] text-lg text-white">
                ⌁
              </span>
              <div>
                <p className="text-[17px] font-bold leading-none">Komektesu</p>
                <p className="mt-1 text-[12px] text-[#667085]">Акимат Актау</p>
              </div>
            </div>
          </div>
          <nav className="mt-8 flex flex-col gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl px-3 py-2.5 text-[14px] font-semibold ${
                    active ? "bg-[#e7f0ff] text-[#2f6bff]" : "text-[#667085] hover:bg-[#f4f6fa]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <p className="mt-auto px-3 text-[12px] leading-5 text-[#98a2b3]">
            Жалобы жителей и давление в сети. Водовоз предлагается автоматически.
          </p>
        </aside>
        <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
