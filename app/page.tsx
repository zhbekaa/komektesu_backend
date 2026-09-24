"use client";

import { useState } from "react";
import { CityMap } from "@/components/CityMap";
import { useSnapshot } from "@/components/useSnapshot";
import { ago, statusLabel, statusTone, tankerLabel } from "@/lib/labels";

export default function OverviewPage() {
  const { data, error, act } = useSnapshot();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const none = data.districts.filter((district) => district.status === "none");
  const low = data.districts.filter((district) => district.status === "low");
  const idle = data.tankers.filter((tanker) => tanker.status === "idle");
  const recent = data.reports.filter((report) => data.serverTime - report.createdAt <= 15 * 60 * 1000);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-[#2f6bff]">КЖСА · диспетчерская</p>
          <h1 className="mt-1 text-[32px] font-bold tracking-tight">Вода в Актау</h1>
          <p className="mt-1 text-[14px] text-[#667085]">Обновлено {ago(data.serverTime, Date.now())}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full bg-[#2f6bff] px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
            disabled={busy !== null}
            onClick={() => run("outage", "/api/demo", { action: "outage", districtId: "14" })}
          >
            {busy === "outage" ? "Отключаем…" : "Сценарий: отключение в 14 мкр"}
          </button>
          <button
            className="rounded-full border border-[#e8ebf0] bg-white px-4 py-2.5 text-[14px] font-semibold disabled:opacity-60"
            disabled={busy !== null}
            onClick={() => run("reset", "/api/demo", { action: "reset" })}
          >
            Сбросить демо
          </button>
        </div>
      </header>
      {message ? <p className="text-[14px] text-[#e5484d]">{message}</p> : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Без воды" value={String(none.length)} hint={none.map((item) => item.name).join(", ") || "нет"} tone="text-[#e5484d]" />
        <Stat label="Слабый напор" value={String(low.length)} hint={low.map((item) => item.name).join(", ") || "нет"} tone="text-[#e09a12]" />
        <Stat label="Свободные водовозы" value={String(idle.length)} hint={`из ${data.tankers.length} машин`} tone="text-[#2f6bff]" />
        <Stat label="Жалобы за 15 мин" value={String(recent.length)} hint={recent.length >= 10 ? "порог аномалии" : "порог порыва: 10"} tone="text-[#1b1f27]" />
      </section>

      {data.anomalies.length > 0 ? (
        <section className="rounded-2xl border border-[#f3c1c3] bg-[#fdecec] px-5 py-4">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[#e5484d]">Аномалия</p>
          {data.anomalies.map((anomaly) => (
            <p key={anomaly.id} className="mt-1 text-[15px] font-medium">
              {anomaly.message}
            </p>
          ))}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-[24px] bg-[#d4e5f2]">
          <div className="h-[520px]">
            <CityMap districts={data.districts} tankers={data.tankers} showTankers />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] font-bold">Куда отправить водовоз</h2>
          {data.suggestions.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-5 text-[14px] text-[#667085]">
              Свободные машины покрывают районы без воды. Новое предложение появится, когда район станет красным или из одного дома придёт 10 жалоб за 15 минут.
            </p>
          ) : (
            data.suggestions.map((suggestion) => (
              <article key={suggestion.districtId} className="rounded-2xl bg-white p-4 shadow-[0_8px_18px_rgba(26,38,64,0.06)]">
                <p className="text-[16px] font-bold">{suggestion.districtName}</p>
                <p className="mt-1 text-[13px] leading-5 text-[#667085]">{suggestion.reason}</p>
                <p className="mt-3 text-[14px] font-semibold">
                  Водовоз №{suggestion.tankerNumber} · {suggestion.etaMinutes} мин
                </p>
                <button
                  className="mt-3 w-full rounded-full bg-[#2f6bff] py-2.5 text-[14px] font-semibold text-white"
                  onClick={() =>
                    run(suggestion.districtId, "/api/dispatch", {
                      districtId: suggestion.districtId,
                      building: "12",
                    })
                  }
                >
                  Отправить №{suggestion.tankerNumber}
                </button>
              </article>
            ))
          )}
          <h2 className="mt-2 text-[18px] font-bold">Флот</h2>
          <ul className="overflow-hidden rounded-2xl bg-white">
            {data.tankers.map((tanker) => (
              <li key={tanker.id} className="flex items-center justify-between border-b border-[#e8ebf0] px-4 py-3 last:border-0">
                <div>
                  <p className="text-[14px] font-semibold">№{tanker.number}</p>
                  <p className="text-[12px] text-[#98a2b3]">{tanker.waterLiters.toLocaleString("ru-RU")} л</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${tanker.status === "idle" ? "bg-[#e5f8ec] text-[#1f9d55]" : tanker.status === "en_route" ? "bg-[#e7f0ff] text-[#2f6bff]" : "bg-[#fff4de] text-[#e09a12]"}`}>
                  {tankerLabel(tanker.status)}
                  {tanker.status === "en_route" ? ` · ${tanker.etaMinutes} мин` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[18px] font-bold">Районы</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {data.districts.map((district) => (
            <article key={district.id} className="rounded-2xl bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{district.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(district.status)}`}>
                  {statusLabel(district.status)}
                </span>
              </div>
              <p className="mt-2 text-[12px] text-[#98a2b3]">
                {district.pressureBar.toFixed(1)} бар · жалоб {data.complaintCounts[district.id] ?? 0}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    <article className="rounded-2xl bg-white px-4 py-4">
      <p className="text-[13px] text-[#667085]">{label}</p>
      <p className={`mt-1 text-[32px] font-bold leading-none ${tone}`}>{value}</p>
      <p className="mt-2 truncate text-[12px] text-[#98a2b3]">{hint}</p>
    </article>
  );
}
