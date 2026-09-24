"use client";

import { useState } from "react";
import { useSnapshot } from "@/components/useSnapshot";
import { Badge, Button, Card, Empty, PageHeader, SimulatedBadge, Stat } from "@/components/ui";
import { districtName, joinDistricts } from "@/lib/districts";
import { MAP, ago, reportLabel } from "@/lib/labels";
import type { ReportType } from "@/lib/types";

const TYPE_TONE: Record<ReportType, string> = {
  no_water: "bg-[#fdeaea] text-[#b4272b]",
  emergency: "bg-[#fdeaea] text-[#b4272b]",
  low_pressure: "bg-[#fdf1d8] text-[#9a6400]",
  no_hot: "bg-[#e7f0ff] text-[#2f6bff]",
};

export default function ReportsPage() {
  const { data, error, act } = useSnapshot();
  const [districtId, setDistrictId] = useState("all");
  const [type, setType] = useState<"all" | ReportType>("all");
  const [onlyOpen, setOnlyOpen] = useState(false);

  if (!data) return <p className="text-[#667085]">{error ?? "Загрузка жалоб…"}</p>;

  const districts = joinDistricts(data.districts);
  const rows = data.reports.filter(
    (report) =>
      (districtId === "all" || report.districtId === districtId) &&
      (type === "all" || report.type === type) &&
      (!onlyOpen || !report.confirmed),
  );
  const open = data.reports.filter((report) => !report.confirmed).length;
  const lastHour = data.reports.filter(
    (report) => data.serverTime - report.createdAt <= 3600_000,
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Жалобы"
        title="Сигналы жителей"
        lead="Каждый сигнал приходит из приложения с микрорайоном и номером дома — так устроена адресация в Актау. Подтверждение возвращается жителю в историю."
        actions={<SimulatedBadge />}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Всего сигналов" value={String(data.reports.length)} accent={MAP.selected} />
        <Stat label="За последний час" value={String(lastHour)} accent={MAP.low} />
        <Stat label="Не подтверждены" value={String(open)} tone={open ? "text-[#b4272b]" : undefined} accent={MAP.none} />
        <Stat
          label="Аномалии"
          value={String(data.anomalies.length)}
          hint={data.anomalies[0]?.message ?? "нет"}
          accent={MAP.normal}
        />
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
          <select
            className="rounded-full border border-[#e8ebf0] bg-white px-3.5 py-2 text-[13px] font-semibold outline-none focus:border-[#2f6bff]"
            value={districtId}
            onChange={(event) => setDistrictId(event.target.value)}
          >
            <option value="all">Все районы</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-full border border-[#e8ebf0] bg-white px-3.5 py-2 text-[13px] font-semibold outline-none focus:border-[#2f6bff]"
            value={type}
            onChange={(event) => setType(event.target.value as "all" | ReportType)}
          >
            <option value="all">Все типы</option>
            <option value="no_water">Нет воды</option>
            <option value="low_pressure">Слабый напор</option>
            <option value="no_hot">Нет горячей воды</option>
            <option value="emergency">Авария</option>
          </select>
          <Button variant={onlyOpen ? "quiet" : "ghost"} onClick={() => setOnlyOpen((value) => !value)}>
            Только неподтверждённые
          </Button>
          <span className="ml-auto text-[12px] text-[#98a2b3]">
            {rows.length} из {data.reports.length}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Под фильтр ничего не попало</Empty>
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="border-y border-[#eef1f5] bg-[#fafbfc] text-[11px] uppercase tracking-wide text-[#98a2b3]">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Время</th>
                <th className="px-3 py-2.5 font-semibold">Район</th>
                <th className="px-3 py-2.5 font-semibold">Дом</th>
                <th className="px-3 py-2.5 font-semibold">Тип</th>
                <th className="px-3 py-2.5 font-semibold">Житель</th>
                <th className="px-5 py-2.5 text-right font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 60).map((report) => (
                <tr key={report.id} className="border-b border-[#f2f4f7] last:border-0">
                  <td className="whitespace-nowrap px-5 py-2.5 text-[#667085]">
                    {ago(report.createdAt, data.serverTime)}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{districtName(report.districtId)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{report.building}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={TYPE_TONE[report.type]}>{reportLabel(report.type)}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-[#667085]">{report.residentName}</td>
                  <td className="px-5 py-2.5 text-right">
                    {report.confirmed ? (
                      <span className="text-[12px] font-semibold text-[#127a45]">
                        Подтверждено
                      </span>
                    ) : (
                      <button
                        className="rounded-full bg-[#e7f0ff] px-3 py-1.5 text-[12px] font-semibold text-[#2f6bff] hover:bg-[#dbe8ff]"
                        onClick={() => void act("/api/reports", { confirmId: report.id })}
                      >
                        Подтвердить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 60 ? (
          <p className="px-5 py-3 text-[12px] text-[#98a2b3]">
            Показаны первые 60 записей.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
