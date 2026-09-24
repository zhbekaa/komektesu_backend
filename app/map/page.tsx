"use client";

import { useState } from "react";
import { CityMap } from "@/components/CityMap";
import { useSnapshot } from "@/components/useSnapshot";
import { ago, reportLabel, statusLabel, statusTone } from "@/lib/labels";

export default function HeatmapPage() {
  const { data, error } = useSnapshot();
  const [selected, setSelected] = useState("14");
  if (!data) return <p className="text-[#667085]">{error ?? "Загрузка карты…"}</p>;
  const district = data.districts.find((item) => item.id === selected) ?? data.districts[0];
  const reports = data.reports.filter((report) => report.districtId === district.id).slice(0, 8);
  const max = Math.max(1, ...Object.values(data.complaintCounts));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[32px] font-bold">Тепловая карта</h1>
        <p className="mt-1 text-[14px] text-[#667085]">
          Цвет района — давление в сети. Насыщенность списка — жалобы за 6 часов.
        </p>
      </header>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="h-[640px] overflow-hidden rounded-[24px] bg-[#d4e5f2]">
          <CityMap districts={data.districts} selectedId={district.id} onSelect={setSelected} />
        </div>
        <div className="flex flex-col gap-3">
          <article className="rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[24px] font-bold">{district.name}</h2>
              <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${statusTone(district.status)}`}>
                {statusLabel(district.status)}
              </span>
            </div>
            <p className="mt-3 text-[14px] text-[#667085]">Давление {district.pressureBar.toFixed(1)} бар</p>
            <p className="text-[14px] text-[#667085]">Обновлено {ago(district.updatedAt, data.serverTime)}</p>
            {district.expectedNormalAt ? (
              <p className="text-[14px] text-[#667085]">Ожидаемое время нормы: {district.expectedNormalAt}</p>
            ) : null}
          </article>
          <ul className="rounded-2xl bg-white p-3">
            {data.districts.map((item) => {
              const count = data.complaintCounts[item.id] ?? 0;
              return (
                <li key={item.id}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${item.id === district.id ? "bg-[#e7f0ff]" : ""}`}
                    onClick={() => setSelected(item.id)}
                  >
                    <span className="w-16 text-[14px] font-semibold">{item.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#f2f4f7]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(8, (count / max) * 100)}%`,
                          background: item.status === "none" ? "#E5484D" : item.status === "low" ? "#E09A12" : "#1F9D55",
                        }}
                      />
                    </span>
                    <span className="w-6 text-right text-[13px] text-[#667085]">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <article className="rounded-2xl bg-white p-4">
            <h3 className="font-semibold">Последние жалобы</h3>
            {reports.length === 0 ? <p className="mt-2 text-[13px] text-[#98a2b3]">Пока нет</p> : null}
            <ul className="mt-2 flex flex-col gap-2">
              {reports.map((report) => (
                <li key={report.id} className="text-[13px] text-[#667085]">
                  <span className="font-semibold text-[#1b1f27]">{reportLabel(report.type)}</span>
                  {" · "}дом {report.building} · {ago(report.createdAt, data.serverTime)}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </div>
  );
}
