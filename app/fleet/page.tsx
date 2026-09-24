"use client";

import { useState } from "react";
import { CityMap } from "@/components/CityMap";
import { useSnapshot } from "@/components/useSnapshot";
import { Badge, Button, Card, Empty, PageHeader, SectionTitle, SimulatedBadge, Stat } from "@/components/ui";
import { districtName, joinDistricts } from "@/lib/districts";
import { MAP, litres, tankerLabel, tankerTone } from "@/lib/labels";

export default function FleetPage() {
  const { data, error, act } = useSnapshot();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return <p className="text-[#667085]">{error ?? "Загрузка флота…"}</p>;

  const districts = joinDistricts(data.districts);
  const pendingIds = new Set(
    data.requests.filter((request) => request.status === "accepted").map((request) => request.districtId),
  );
  const uncovered = districts.filter(
    (district) =>
      (district.status === "none" || pendingIds.has(district.id)) &&
      !data.tankers.some(
        (tanker) =>
          tanker.targetDistrictId === district.id &&
          (tanker.status === "en_route" || tanker.status === "serving"),
      ),
  );
  const idle = data.tankers.filter((tanker) => tanker.status === "idle");
  const total = data.tankers.reduce((sum, tanker) => sum + tanker.waterLiters, 0);
  const capacity = data.tankers.reduce((sum, tanker) => sum + tanker.capacityLiters, 0);

  async function dispatch(districtId: string) {
    setBusy(districtId);
    setMessage(null);
    try {
      await act("/api/dispatch", { districtId });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Водовозы"
        title="Флот и покрытие"
        lead="Машины выезжают с базы КЖСА. Время в пути считается по расстоянию на карте при средней скорости 24 км/ч плюс 4 минуты на выезд."
        actions={<SimulatedBadge />}
      />
      {message ? <p className="text-[13px] text-[#e5484d]">{message}</p> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Свободны" value={`${idle.length} / ${data.tankers.length}`} accent={MAP.normal} />
        <Stat label="Воды в машинах" value={litres(total)} hint={`из ${litres(capacity)}`} accent={MAP.selected} />
        <Stat
          label="В пути"
          value={String(data.tankers.filter((tanker) => tanker.status === "en_route").length)}
          accent={MAP.low}
        />
        <Stat
          label="Районы без машины"
          value={String(uncovered.length)}
          hint={uncovered.map((item) => item.name).join(", ") || "все закрыты"}
          tone={uncovered.length ? "text-[#b4272b]" : undefined}
          accent={MAP.none}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card padded={false} className="overflow-hidden">
          <div className="h-[520px]">
            <CityMap districts={data.districts} tankers={data.tankers} showTankers />
          </div>
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="px-5 py-3.5">
            <SectionTitle>Машины</SectionTitle>
          </div>
          <table className="w-full text-left text-[13px]">
            <thead className="border-y border-[#eef1f5] bg-[#fafbfc] text-[11px] uppercase tracking-wide text-[#98a2b3]">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Машина</th>
                <th className="px-3 py-2.5 font-semibold">Статус</th>
                <th className="px-3 py-2.5 font-semibold">Запас</th>
                <th className="px-5 py-2.5 font-semibold">Назначение</th>
              </tr>
            </thead>
            <tbody>
              {data.tankers.map((tanker) => {
                const fill = tanker.waterLiters / tanker.capacityLiters;
                return (
                  <tr key={tanker.id} className="border-b border-[#f2f4f7] last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-semibold">№{tanker.number}</p>
                      <p className="text-[11px] text-[#98a2b3]">{tanker.plate}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={tankerTone(tanker.status)}>
                        {tankerLabel(tanker.status)}
                        {tanker.status === "en_route" ? ` · ${tanker.etaMinutes} мин` : ""}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <p className="tabular-nums">{litres(tanker.waterLiters)}</p>
                      <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-[#f2f4f7]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, fill * 100)}%`,
                            background: fill < 0.25 ? MAP.none : MAP.selected,
                          }}
                        />
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#667085]">
                      {tanker.targetDistrictId ? districtName(tanker.targetDistrictId) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <Card>
        <SectionTitle>Покрытие дефицита</SectionTitle>
        {uncovered.length === 0 ? (
          <div className="mt-3">
            <Empty>Каждый район без воды уже обслуживается или к нему едет машина.</Empty>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {uncovered.map((district) => {
              const suggestion = data.suggestions.find(
                (item) => item.districtId === district.id,
              );
              return (
                <li
                  key={district.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fdf4f4] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">
                      {district.name} —{" "}
                      {pendingIds.has(district.id)
                        ? "заявка жителя, машина не назначена"
                        : "без воды, машина не назначена"}
                    </p>
                    <p className="text-[12px] text-[#667085]">
                      {data.meta.coverage.residentialBuildings > 0
                        ? `${district.residential} жилых домов · `
                        : ""}
                      {suggestion
                        ? `ближайший №${suggestion.tankerNumber}, ${suggestion.distanceKm} км, ${suggestion.etaMinutes} мин`
                        : "свободных машин нет"}
                    </p>
                  </div>
                  <Button
                    disabled={busy !== null || !suggestion}
                    onClick={() => void dispatch(district.id)}
                  >
                    {busy === district.id ? "Отправляем…" : "Назначить ближайший"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
