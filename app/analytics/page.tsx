"use client";

import { useSnapshot } from "@/components/useSnapshot";

export default function AnalyticsPage() {
  const { data, error } = useSnapshot();
  if (!data) return <p className="text-[#667085]">{error ?? "Загрузка аналитики…"}</p>;
  const max = Math.max(1, ...data.hourly.map((item) => item.count));

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <header>
        <h1 className="text-[32px] font-bold">Аналитика и прогноз</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-6 text-[#667085]">
          Правило порыва: 10 и больше жалоб из одного дома за 15 минут. Это быстрее, чем обычный вечерний разбор воды, и вместе с падением давления отмечается как авария.
        </p>
      </header>
      <article className="rounded-2xl bg-[#e7f0ff] px-5 py-4">
        <p className="text-[13px] font-semibold text-[#2f6bff]">Прогноз</p>
        <p className="mt-1 text-[16px] font-medium leading-6">{data.forecast}</p>
      </article>
      {data.anomalies.map((anomaly) => (
        <article key={anomaly.id} className="rounded-2xl bg-[#fdecec] px-5 py-4 text-[15px] font-medium">
          {anomaly.message}
        </article>
      ))}
      <article className="rounded-2xl bg-white p-5">
        <h2 className="text-[18px] font-bold">Жалобы по часам</h2>
        <div className="mt-5 flex h-48 items-end gap-2">
          {data.hourly.map((item) => (
            <div key={`${item.hour}-${item.count}`} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] text-[#98a2b3]">{item.count}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-[#2f6bff]"
                  style={{ height: `${Math.max(6, (item.count / max) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-[#667085]">{item.hour}</span>
            </div>
          ))}
        </div>
      </article>
      <article className="rounded-2xl bg-white p-5">
        <h2 className="text-[18px] font-bold">Давление и жалобы</h2>
        <ul className="mt-3 divide-y divide-[#e8ebf0]">
          {data.districts.map((district) => (
            <li key={district.id} className="flex items-center justify-between py-3 text-[14px]">
              <span className="font-semibold">{district.name}</span>
              <span className="text-[#667085]">
                {district.pressureBar.toFixed(1)} бар · {data.complaintCounts[district.id] ?? 0} жалоб / 6 ч
              </span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
