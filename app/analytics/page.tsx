"use client";

import { useSnapshot } from "@/components/useSnapshot";
import { Badge, Card, Empty, PageHeader, SectionTitle, SimulatedBadge } from "@/components/ui";
import { joinDistricts } from "@/lib/districts";
import { MAP, statusColor, statusLabelShort, statusTone } from "@/lib/labels";

export default function AnalyticsPage() {
  const { data, error } = useSnapshot();
  if (!data) return <p className="text-[#667085]">{error ?? "Загрузка аналитики…"}</p>;

  const max = Math.max(1, ...data.hourly.map((item) => item.count));
  const districts = joinDistricts(data.districts);
  const problem = districts
    .filter((district) => district.status !== "normal" || district.complaints6h > 0)
    .sort(
      (a, b) =>
        b.complaints6h - a.complaints6h || a.pressureBar - b.pressureBar,
    );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Аналитика"
        title="Обстановка и правила"
        lead="Здесь нет прогнозной модели. Диспетчер видит подсчёты по жалобам и одно явное правило, по которому серия сигналов превращается в аварию."
        actions={<SimulatedBadge />}
      />

      <Card className="border-[#d7e3ff] bg-[#f4f8ff]">
        <SectionTitle>Сводка</SectionTitle>
        <p className="mt-2 max-w-4xl text-[15px] leading-6 text-[#344054]">{data.situation}</p>
      </Card>

      {data.anomalies.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.anomalies.map((anomaly) => (
            <Card key={anomaly.id} className="border-[#f6d5d5] bg-[#fdf4f4]">
              <div className="flex items-start gap-3">
                <Badge tone="bg-[#fdeaea] text-[#b4272b]">
                  {anomaly.kind === "pipe_burst" ? "Порыв" : "Пик"}
                </Badge>
                <p className="text-[14px] leading-6 text-[#344054]">{anomaly.message}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <SectionTitle
            aside={<span className="text-[12px] text-[#98a2b3]">за 12 часов</span>}
          >
            Жалобы по часам
          </SectionTitle>
          <div className="mt-5 flex h-48 items-end gap-1.5">
            {data.hourly.map((item, index) => (
              <div key={`${item.hour}-${index}`} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] tabular-nums text-[#98a2b3]">
                  {item.count || ""}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-[#2f6bff]"
                    style={{
                      height: `${Math.max(3, (item.count / max) * 100)}%`,
                      opacity: 0.45 + 0.55 * (item.count / max),
                    }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-[#667085]">
                  {String(item.hour).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Правила, по которым работает система</SectionTitle>
          <ol className="mt-3 flex flex-col gap-3">
            {data.meta.assumptions.map((note, index) => (
              <li key={note} className="flex gap-3 text-[13px] leading-5 text-[#344054]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f2f4f7] text-[11px] font-bold text-[#667085]">
                  {index + 1}
                </span>
                {note}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 py-3.5">
          <SectionTitle
            aside={<span className="text-[12px] text-[#98a2b3]">{problem.length} районов</span>}
          >
            Районы, требующие внимания
          </SectionTitle>
        </div>
        {problem.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Все районы в норме, жалоб за 6 часов нет</Empty>
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="border-y border-[#eef1f5] bg-[#fafbfc] text-[11px] uppercase tracking-wide text-[#98a2b3]">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Район</th>
                <th className="px-3 py-2.5 font-semibold">Состояние</th>
                <th className="px-3 py-2.5 font-semibold">Давление</th>
                <th className="px-3 py-2.5 font-semibold">Жалоб / 6 ч</th>
                {data.meta.coverage.residentialBuildings > 0 ? (
                  <th className="px-3 py-2.5 font-semibold">Жилых домов</th>
                ) : null}
                <th className="px-5 py-2.5 font-semibold">Причина</th>
              </tr>
            </thead>
            <tbody>
              {problem.map((district) => (
                <tr key={district.id} className="border-b border-[#f2f4f7] last:border-0">
                  <td className="px-5 py-2.5 font-semibold">{district.name}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={statusTone(district.status)}>
                      {statusLabelShort(district.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {district.pressureBar.toFixed(1)} бар
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="w-4 tabular-nums">{district.complaints6h}</span>
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[#f2f4f7]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.min(100, district.complaints6h * 10)}%`,
                            background: statusColor(district.status),
                          }}
                        />
                      </span>
                    </span>
                  </td>
                  {data.meta.coverage.residentialBuildings > 0 ? (
                    <td className="px-3 py-2.5 tabular-nums text-[#667085]">
                      {district.residential}
                    </td>
                  ) : null}
                  <td className="px-5 py-2.5 text-[12px] text-[#667085]">
                    {district.cause ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <SectionTitle>Что здесь реально, а что сгенерировано</SectionTitle>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#127a45]">
              Реальные данные
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {data.meta.sources.map((source) => (
                <li key={source.label} className="text-[13px] leading-5">
                  <span className="font-semibold">{source.label}</span>
                  <span className="block text-[#667085]">
                    {source.source} · {source.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9a6400]">
              Сгенерировано для демо
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-[13px] leading-5 text-[#667085]">
              <li>Давление в сети и статусы районов</li>
              <li>Состав и положение флота водовозов</li>
              <li>Жалобы жителей, имена и номера домов</li>
              <li>Расписание подачи воды</li>
            </ul>
            <p className="mt-3 rounded-xl bg-[#f9fafb] px-3 py-2.5 text-[12px] leading-5 text-[#667085]">
              Для подключения к реальной сети нужны телеметрия давления от{" "}
              {data.meta.operator} и GPS водовозов. Структура API под это уже готова.
            </p>
          </div>
        </div>
        <p className="mt-4 border-t border-[#eef1f5] pt-3 text-[11px] text-[#98a2b3]">
          Карта: {data.meta.coverage.districts} районов, {data.meta.coverage.areaKm2} км²
          {data.meta.coverage.residentialBuildings > 0
            ? `, ${data.meta.coverage.residentialBuildings.toLocaleString("ru-RU")} жилых домов`
            : ""}
          . Геометрия © OpenStreetMap contributors, ODbL.
        </p>
      </Card>
    </div>
  );
}
