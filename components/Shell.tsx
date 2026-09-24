"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { COVERAGE, UTILITY, WATER_SOURCE } from "@/lib/aktau";

const LINKS = [
  { href: "/", label: "Обзор" },
  { href: "/map", label: "Карта" },
  { href: "/fleet", label: "Водовозы" },
  { href: "/reports", label: "Жалобы" },
  { href: "/analytics", label: "Аналитика" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#1b1f27]">
      <div className="mx-auto flex min-h-screen max-w-[1560px]">
        <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col border-r border-[#e8ebf0] bg-white px-4 py-6">
          <Link href="/" className="flex items-center gap-2.5 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f6bff] text-[17px] font-bold text-white">
              К
            </span>
            <span>
              <span className="block text-[16px] font-bold leading-none">Komektesu</span>
              <span className="mt-1 block text-[11px] text-[#98a2b3]">
                {UTILITY.short} · Актау
              </span>
            </span>
          </Link>

          <nav className="mt-7 flex flex-col gap-0.5">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
                    active
                      ? "bg-[#e7f0ff] text-[#2f6bff]"
                      : "text-[#667085] hover:bg-[#f6f7f9] hover:text-[#344054]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-3 px-1">
            <div className="rounded-xl bg-[#fdf1d8] px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#9a6400]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e09a12]" />
                Демо-данные
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[#9a6400]/85">
                Карта настоящая, оперативный слой сгенерирован.
              </p>
            </div>
            <dl className="flex flex-col gap-1.5 text-[11px] leading-4 text-[#98a2b3]">
              <div>
                <dt className="font-semibold text-[#667085]">Источник воды</dt>
                <dd>
                  {WATER_SOURCE.name} — {WATER_SOURCE.method.toLowerCase()}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#667085]">Покрытие</dt>
                <dd>
                  {COVERAGE.districts} районов, {COVERAGE.areaKm2.toFixed(0)} км²
                </dd>
              </div>
            </dl>
            <p className="text-[10px] text-[#c0c6d0]">Геометрия © OpenStreetMap</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
