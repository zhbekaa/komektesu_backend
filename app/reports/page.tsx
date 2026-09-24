"use client";

import { useState } from "react";
import { useSnapshot } from "@/components/useSnapshot";
import { ago, reportLabel } from "@/lib/labels";

export default function ReportsPage() {
  const { data, error, act } = useSnapshot();
  const [districtId, setDistrictId] = useState("all");
  if (!data) return <p className="text-[#667085]">{error ?? "Загрузка жалоб…"}</p>;
  const rows = data.reports.filter((report) => districtId === "all" || report.districtId === districtId);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold">Жалобы жителей</h1>
          <p className="mt-1 text-[14px] text-[#667085]">Сигналы из приложения. Подтверждение уходит в статистику жителя.</p>
        </div>
        <select
          className="rounded-full border border-[#e8ebf0] bg-white px-4 py-2 text-[14px] font-semibold"
          value={districtId}
          onChange={(event) => setDistrictId(event.target.value)}
        >
          <option value="all">Все районы</option>
          {data.districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </select>
      </header>
      <div className="overflow-hidden rounded-2xl bg-white">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-[#f4f6fa] text-[12px] uppercase tracking-wide text-[#98a2b3]">
            <tr>
              <th className="px-4 py-3 font-semibold">Время</th>
              <th className="px-4 py-3 font-semibold">Район</th>
              <th className="px-4 py-3 font-semibold">Дом</th>
              <th className="px-4 py-3 font-semibold">Тип</th>
              <th className="px-4 py-3 font-semibold">Житель</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((report) => {
              const district = data.districts.find((item) => item.id === report.districtId);
              return (
                <tr key={report.id} className="border-t border-[#e8ebf0]">
                  <td className="px-4 py-3 text-[#667085]">{ago(report.createdAt, data.serverTime)}</td>
                  <td className="px-4 py-3 font-semibold">{district?.name}</td>
                  <td className="px-4 py-3">{report.building}</td>
                  <td className="px-4 py-3">{reportLabel(report.type)}</td>
                  <td className="px-4 py-3">{report.residentName}</td>
                  <td className="px-4 py-3 text-right">
                    {report.confirmed ? (
                      <span className="text-[12px] font-semibold text-[#1f9d55]">Подтверждено</span>
                    ) : (
                      <button
                        className="rounded-full bg-[#e7f0ff] px-3 py-1.5 text-[12px] font-semibold text-[#2f6bff]"
                        onClick={() => act("/api/reports", { confirmId: report.id })}
                      >
                        Подтвердить
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
