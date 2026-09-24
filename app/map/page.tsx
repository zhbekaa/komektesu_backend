"use client";

import { useState } from "react";
import { CityMap } from "@/components/CityMap";
import { useSnapshot } from "@/components/useSnapshot";
import { Badge, Card, Empty, PageHeader, SectionTitle, SimulatedBadge } from "@/components/ui";
import { findDistrict, joinDistricts } from "@/lib/districts";
import { MAP, ago, reportLabel, statusColor, statusLabel, statusTone } from "@/lib/labels";

export default function HeatmapPage() {
  const { data, error } = useSnapshot();
  const [selectedId, setSelectedId] = useState("14");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  if (!data) return <p className="text-[#667085]">{error ?? "Загрузка карты…"}</p>;

  const districts = joinDistricts(data.districts);
  const district = findDistrict(districts, selectedId);
  const reports = data.reports
    .filter((report) => report.districtId === district.id)
    .slice(0, 8);
  const max = Math.max(1, ...districts.map((item) => item.complaints6h));

  const needle = query.trim().toLowerCase();
  const listed = needle
    ? districts.filter(
        (item) =>
          item.name.toLowerCase().includes(needle) ||
          item.nameKk.toLowerCase().includes(needle) ||
          item.id.includes(needle),
      )
    : districts;

  function pick(id: string) {
    setSelectedId(id);
    setFocusId(id);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Карта"
        title="Давление и жалобы по районам"
        lead="Цвет района — состояние подачи. Полоса в списке — жалобы за 6 часов относительно самого проблемного района."
        actions={<SimulatedBadge />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <Card padded={false} className="overflow-hidden">
          <div className="h-[660px]">
            <CityMap
              districts={data.districts}
              selectedId={district.id}
              onSelect={pick}
              focusId={focusId}
            />
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[22px] font-bold">{district.name}</h2>
              <Badge tone={statusTone(district.status)}>{statusLabel(district.status)}</Badge>
            </div>
            <p className="mt-1 text-[12px] text-[#98a2b3]">{district.nameKk}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <Fact label="Давление" value={`${district.pressureBar.toFixed(1)} бар`} />
              <Fact label="Площадь" value={`${district.areaKm2.toFixed(2)} км²`} />
              {data.meta.coverage.residentialBuildings > 0 ? (
                <Fact label="Жилых домов" value={String(district.residential)} />
              ) : null}
              <Fact label="От базы КЖСА" value={`${district.depotKm.toFixed(1)} км`} />
              <Fact label="Жалоб за 6 ч" value={String(district.complaints6h)} />
              <Fact
                label="Обновлено"
                value={ago(district.updatedAt, data.serverTime)}
              />
            </dl>
            {district.expectedNormalAt ? (
              <p className="mt-3 rounded-xl bg-[#fdf1d8] px-3 py-2 text-[12px] font-medium text-[#9a6400]">
                Ожидаемое восстановление — {district.expectedNormalAt}
              </p>
            ) : null}
            {district.cause ? (
              <p className="mt-2 text-[12px] leading-5 text-[#667085]">{district.cause}</p>
            ) : null}
            <p className="mt-3 text-[11px] text-[#98a2b3]">
              Границы и площадь — OpenStreetMap, way {district.osmId}.
            </p>
          </Card>

          <Card padded={false}>
            <div className="px-4 pt-4">
              <SectionTitle>Все районы</SectionTitle>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск: 14, Шығыс, Самал…"
                className="mt-3 w-full rounded-xl border border-[#e8ebf0] px-3 py-2 text-[13px] outline-none focus:border-[#2f6bff]"
              />
            </div>
            <ul className="mt-2 max-h-[420px] overflow-y-auto px-2 pb-2">
              {listed.map((item) => (
                <li key={item.id}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-[#f9fafb] ${
                      item.id === district.id ? "bg-[#e7f0ff] hover:bg-[#e7f0ff]" : ""
                    }`}
                    onClick={() => pick(item.id)}
                  >
                    <span className="w-[86px] shrink-0 truncate text-[13px] font-semibold">
                      {item.name}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f2f4f7]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(6, (item.complaints6h / max) * 100)}%`,
                          background: statusColor(item.status),
                        }}
                      />
                    </span>
                    <span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-[#667085]">
                      {item.complaints6h}
                    </span>
                  </button>
                </li>
              ))}
              {listed.length === 0 ? (
                <li className="px-2 py-4 text-center text-[13px] text-[#98a2b3]">
                  Ничего не найдено
                </li>
              ) : null}
            </ul>
          </Card>

          <Card>
            <SectionTitle>Последние жалобы</SectionTitle>
            {reports.length === 0 ? (
              <div className="mt-3">
                <Empty>По этому району жалоб нет</Empty>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {reports.map((report) => (
                  <li key={report.id} className="flex items-baseline gap-2 text-[12px]">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: MAP.none }}
                    />
                    <span className="font-semibold text-[#1b1f27]">
                      {reportLabel(report.type)}
                    </span>
                    <span className="text-[#667085]">
                      дом {report.building} · {ago(report.createdAt, data.serverTime)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[#98a2b3]">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
