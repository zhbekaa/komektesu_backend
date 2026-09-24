"use client";

import { useState } from "react";
import { CityMap } from "@/components/CityMap";
import { useSnapshot } from "@/components/useSnapshot";
import {
  Badge,
  Button,
  Card,
  Empty,
  PageHeader,
  SectionTitle,
  SimulatedBadge,
  Stat,
} from "@/components/ui";
import { ASSUMPTIONS } from "@/lib/aktau";
import { joinDistricts, findDistrict } from "@/lib/districts";
import { MAP, ago, litres, statusLabelShort, statusTone, tankerLabel, tankerTone } from "@/lib/labels";

export default function OverviewPage() {
  const { data, error, act } = useSnapshot();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function run(name: string, url: string, body: unknown) {
    setBusy(name);
    setMessage(null);
    try {
      await act(url, body);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return <p className="text-[#667085]">{error ?? "Загрузка диспетчерской…"}</p>;
  }

  const districts = joinDistricts(data.districts);
  const selected = selectedId ? findDistrict(districts, selectedId) : null;
  const none = districts.filter((district) => district.status === "none");
  const low = districts.filter((district) => district.status === "low");
  const idle = data.tankers.filter((tanker) => tanker.status === "idle");
  const recent = data.reports.filter(
    (report) => data.serverTime - report.createdAt <= ASSUMPTIONS.burstWindowMin * 60 * 1000,
  );
  const affected = none.reduce((sum, district) => sum + district.residential, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={`${data.meta.operator} · диспетчерская`}
        title="Вода в Актау"
        lead={`${data.meta.coverage.districts} микрорайонов на карте. Источник — ${data.meta.waterSource}.`}
        actions={
          <>
            <SimulatedBadge />
            <Button
              disabled={busy !== null}
              onClick={() => run("outage", "/api/demo", { action: "outage", districtId: "17" })}
            >
              {busy === "outage" ? "Сценарий…" : "Сценарий: порыв в 17 мкр"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy !== null}
              onClick={() => run("reset", "/api/demo", { action: "reset" })}
            >
              Сбросить
            </Button>
          </>
        }
      />

      {message ? <p className="text-[13px] text-[#e5484d]">{message}</p> : null}

      {data.incident ? (
        <Card className="border-[#f6d5d5] bg-[#fdf4f4]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="bg-[#fdeaea] text-[#b4272b]">Инцидент</Badge>
                <p className="text-[12px] text-[#98a2b3]">
                  начат {ago(data.incident.startedAt, data.serverTime)}
                </p>
              </div>
              <p className="mt-2 text-[17px] font-bold">{data.incident.title}</p>
              <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[#667085]">
                {data.incident.summary}
              </p>
            </div>
            {data.incident.expectedNormalAt ? (
              <div className="rounded-xl bg-white px-4 py-3 text-center">
                <p className="text-[11px] font-medium text-[#667085]">Ожидаемая норма</p>
                <p className="mt-0.5 text-[22px] font-bold tabular-nums">
                  {data.incident.expectedNormalAt}
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Районы без воды"
          value={String(none.length)}
          hint={none.map((item) => item.name).join(", ") || "нет"}
          tone="text-[#b4272b]"
          accent={MAP.none}
        />
        <Stat
          label="Слабый напор"
          value={String(low.length)}
          hint={low.map((item) => item.name).join(", ") || "нет"}
          tone="text-[#9a6400]"
          accent={MAP.low}
        />
        <Stat
          label="Свободные водовозы"
          value={`${idle.length} / ${data.tankers.length}`}
          hint={`Запас ${litres(idle.reduce((sum, item) => sum + item.waterLiters, 0))}`}
          tone="text-[#2f6bff]"
          accent={MAP.selected}
        />
        <Stat
          label={`Жалобы за ${ASSUMPTIONS.burstWindowMin} мин`}
          value={String(recent.length)}
          hint={`Порог порыва — ${ASSUMPTIONS.burstThreshold} из одного дома`}
          accent={MAP.normal}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#eef1f5] px-5 py-3.5">
            <SectionTitle
              aside={
                <span className="text-[12px] text-[#98a2b3]">
                  Обновлено {ago(data.serverTime, Date.now())}
                </span>
              }
            >
              Карта города
            </SectionTitle>
          </div>
          <div className="h-[640px]">
            <CityMap
              districts={data.districts}
              tankers={data.tankers}
              showTankers
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
          </div>
          {selected ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#eef1f5] px-5 py-3.5">
              <p className="text-[15px] font-bold">{selected.name}</p>
              <Badge tone={statusTone(selected.status)}>{statusLabelShort(selected.status)}</Badge>
              <span className="text-[12px] text-[#667085]">
                {selected.pressureBar.toFixed(1)} бар
              </span>
              <span className="text-[12px] text-[#667085]">
                {selected.areaKm2.toFixed(2)} км²
                {data.meta.coverage.residentialBuildings > 0
                  ? ` · ${selected.residential} жилых домов`
                  : ""}
              </span>
              <span className="text-[12px] text-[#667085]">
                жалоб за 6 ч: {selected.complaints6h}
              </span>
              {selected.cause ? (
                <span className="text-[12px] text-[#98a2b3]">{selected.cause}</span>
              ) : null}
            </div>
          ) : (
            <p className="border-t border-[#eef1f5] px-5 py-3.5 text-[12px] text-[#98a2b3]">
              Выберите район на карте. Колесо — масштаб, перетаскивание — сдвиг.
            </p>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <SectionTitle>Куда отправить водовоз</SectionTitle>
            <div className="mt-3 flex flex-col gap-2.5">
              {data.suggestions.length === 0 ? (
                <Empty>
                  Все районы без воды уже закрыты машинами. Предложение появится, когда житель
                  запросит подвоз или откроется новое отключение.
                </Empty>
              ) : (
                data.suggestions.map((suggestion) => (
                  <article
                    key={suggestion.districtId}
                    className="rounded-xl border border-[#e8ebf0] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-bold">{suggestion.districtName}</p>
                      <Badge tone="bg-[#e7f0ff] text-[#2f6bff]">
                        {suggestion.etaMinutes} мин
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-[18px] text-[#667085]">
                      {suggestion.reason}
                    </p>
                    <p className="mt-2 text-[12px] font-medium text-[#344054]">
                      №{suggestion.tankerNumber} · {suggestion.tankerPlate} ·{" "}
                      {suggestion.distanceKm} км
                    </p>
                    <div className="mt-3">
                      <Button
                        disabled={busy !== null}
                        onClick={() =>
                          run(suggestion.districtId, "/api/dispatch", {
                            districtId: suggestion.districtId,
                          })
                        }
                      >
                        {busy === suggestion.districtId
                          ? "Отправляем…"
                          : `Отправить №${suggestion.tankerNumber}`}
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-5 py-3.5">
              <SectionTitle
                aside={<span className="text-[12px] text-[#98a2b3]">{data.tankers.length} машин</span>}
              >
                Флот
              </SectionTitle>
            </div>
            <ul className="border-t border-[#eef1f5]">
              {data.tankers.map((tanker) => (
                <li
                  key={tanker.id}
                  className="flex items-center justify-between gap-3 border-b border-[#f2f4f7] px-5 py-2.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">
                      №{tanker.number}
                      <span className="ml-2 font-normal text-[#98a2b3]">{tanker.plate}</span>
                    </p>
                    <p className="text-[11px] text-[#98a2b3]">
                      {litres(tanker.waterLiters)} из {litres(tanker.capacityLiters)}
                    </p>
                  </div>
                  <Badge tone={tankerTone(tanker.status)}>
                    {tankerLabel(tanker.status)}
                    {tanker.status === "en_route" ? ` · ${tanker.etaMinutes} мин` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle aside={<SimulatedBadge compact />}>Обстановка</SectionTitle>
        <p className="mt-2 max-w-4xl text-[14px] leading-6 text-[#344054]">{data.situation}</p>
      </Card>
    </div>
  );
}
