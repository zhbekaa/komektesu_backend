"use client";

import { useState } from "react";
import { CityMap } from "@/components/CityMap";
import { useSnapshot } from "@/components/useSnapshot";
import { tankerLabel } from "@/lib/labels";

export default function FleetPage() {
  const { data, error, act } = useSnapshot();
  const [message, setMessage] = useState<string | null>(null);

  if (!data) return <p className="text-[#667085]">{error ?? "Загрузка флота…"}</p>;

  const uncovered = data.districts.filter(
    (district) =>
      district.status === "none" &&
      !data.tankers.some(
        (tanker) =>
          tanker.targetDistrictId === district.id &&
          (tanker.status === "en_route" || tanker.status === "serving"),
      ),
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[32px] font-bold">Водовозы</h1>
        <p className="mt-1 text-[14px] text-[#667085]">
          Где машины сейчас, кто свободен и закрывают ли они районы с наибольшим дефицитом.
        </p>
      </header>
      {message ? <p className="text-[14px] text-[#e5484d]">{message}</p> : null}
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="h-[560px] overflow-hidden rounded-[24px] bg-[#d4e5f2]">
          <CityMap districts={data.districts} tankers={data.tankers} showTankers />
        </div>
        <div className="overflow-hidden rounded-2xl bg-white">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-[#f4f6fa] text-[12px] uppercase tracking-wide text-[#98a2b3]">
              <tr>
                <th className="px-4 py-3 font-semibold">Машина</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Запас</th>
                <th className="px-4 py-3 font-semibold">Куда</th>
              </tr>
            </thead>
            <tbody>
              {data.tankers.map((tanker) => {
                const target = data.districts.find((district) => district.id === tanker.targetDistrictId);
                return (
                  <tr key={tanker.id} className="border-t border-[#e8ebf0]">
                    <td className="px-4 py-3 font-semibold">№{tanker.number}</td>
                    <td className="px-4 py-3">
                      {tankerLabel(tanker.status)}
                      {tanker.status === "en_route" ? ` · ${tanker.etaMinutes} мин` : ""}
                    </td>
                    <td className="px-4 py-3">{tanker.waterLiters.toLocaleString("ru-RU")} л</td>
                    <td className="px-4 py-3 text-[#667085]">{target?.name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-[18px] font-bold">Покрытие дефицита</h2>
        {uncovered.length === 0 ? (
          <p className="mt-2 text-[14px] text-[#667085]">Каждый красный район уже обслуживается или к нему едет машина.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {uncovered.map((district) => (
              <li key={district.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#fdecec] px-4 py-3">
                <span className="font-semibold">{district.name} без воды, водовоз не назначен</span>
                <button
                  className="rounded-full bg-[#2f6bff] px-4 py-2 text-[13px] font-semibold text-white"
                  onClick={() =>
                    act("/api/dispatch", { districtId: district.id, building: "12" }).catch((err: unknown) =>
                      setMessage(err instanceof Error ? err.message : "Ошибка"),
                    )
                  }
                >
                  Назначить ближайший
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
