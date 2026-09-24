"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  COAST_PATH,
  DEFAULT_VIEW,
  DISTRICT_GEO,
  LANDMARKS,
  MAP_HEIGHT,
  MAP_WIDTH,
  METRES_PER_UNIT,
  ROADS_PATH,
  SEA_PATH,
  type DistrictGeo,
} from "@/lib/aktau-geo";
import { MAP, fillFor, statusLabelShort } from "@/lib/labels";
import type { DistrictState, PublicTanker, WaterStatus } from "@/lib/types";

type Box = { x: number; y: number; w: number; h: number };

const MIN_SPAN = 140;
const PAN_MARGIN = 60;

/** Polygon area in SVG units, from the real area in km². */
function areaUnits(district: DistrictGeo) {
  return (district.areaKm2 * 1_000_000) / METRES_PER_UNIT ** 2;
}

/**
 * The city is a tall diagonal band, so the map is drawn with `meet`: the whole
 * view always fits and the surrounding desert and sea fill whatever space is
 * left. Scaling one box uniformly keeps zoom behaviour predictable.
 */
function scaleBox(box: Box, factor: number, originX?: number, originY?: number): Box {
  const w = box.w * factor;
  const h = box.h * factor;
  const cx = originX ?? box.x + box.w / 2;
  const cy = originY ?? box.y + box.h / 2;
  const tx = (cx - box.x) / box.w;
  const ty = (cy - box.y) / box.h;
  return { x: cx - tx * w, y: cy - ty * h, w, h };
}

function clampBox(box: Box): Box {
  const ratio = box.h / box.w;
  const w = Math.min(MAP_WIDTH + PAN_MARGIN * 2, Math.max(MIN_SPAN, box.w));
  const h = w * ratio;
  return {
    w,
    h,
    x: Math.min(Math.max(-PAN_MARGIN, box.x), Math.max(-PAN_MARGIN, MAP_WIDTH + PAN_MARGIN - w)),
    y: Math.min(Math.max(-PAN_MARGIN, box.y), Math.max(-PAN_MARGIN, MAP_HEIGHT + PAN_MARGIN - h)),
  };
}

export function CityMap({
  districts,
  tankers = [],
  showTankers = false,
  selectedId,
  onSelect,
  focusId,
  showLegend = true,
  showLandmarks = true,
  interactive = true,
  className,
}: {
  districts: DistrictState[];
  tankers?: PublicTanker[];
  showTankers?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** District to zoom to. */
  focusId?: string | null;
  showLegend?: boolean;
  showLandmarks?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; box: Box; moved: boolean } | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [box, setBox] = useState<Box | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Track the rendered size so glyphs can be sized in real pixels.
  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const statusById = useMemo(() => {
    const map = new Map<string, DistrictState>();
    for (const district of districts) map.set(district.id, district);
    return map;
  }, [districts]);

  // Zoom to a district, keeping the home view's shape so nothing distorts.
  useEffect(() => {
    if (!focusId) return;
    const geo = DISTRICT_GEO.find((district) => district.id === focusId);
    if (!geo) return;
    const ratio = DEFAULT_VIEW.h / DEFAULT_VIEW.w;
    const w = Math.max(MIN_SPAN, Math.sqrt(areaUnits(geo)) * 3.6);
    setBox(
      clampBox({
        x: geo.center.x - w / 2,
        y: geo.center.y - (w * ratio) / 2,
        w,
        h: w * ratio,
      }),
    );
  }, [focusId]);

  const zoom = useCallback((factor: number, originX?: number, originY?: number) => {
    setBox((current) => clampBox(scaleBox(current ?? DEFAULT_VIEW, factor, originX, originY)));
  }, []);

  /** Client coordinates to map units, accounting for `meet` centring. */
  function toMap(event: { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    if (!svg || !px) return null;
    const rect = svg.getBoundingClientRect();
    const offsetX = (rect.width - view.w * px) / 2;
    const offsetY = (rect.height - view.h * px) / 2;
    return {
      x: view.x + (event.clientX - rect.left - offsetX) / px,
      y: view.y + (event.clientY - rect.top - offsetY) / px,
    };
  }

  const view = box ?? DEFAULT_VIEW;
  /**
   * Screen pixels per SVG unit under `meet` fitting: the smaller of the two
   * ratios wins. Everything drawn in pixel terms goes through `unit()`.
   */
  const px =
    size.width && size.height
      ? Math.min(size.width / view.w, size.height / view.h)
      : 0.5;
  const unit = (pixels: number) => pixels / px;
  const zoomed = box !== null;

  // Idle tankers all sit at the depot, so show them as one badge instead of a
  // pile of overlapping pins.
  const parked = tankers.filter((tanker) => tanker.status === "idle");
  const active = tankers.filter((tanker) => tanker.status !== "idle");
  const depot = LANDMARKS.find((item) => item.kind === "depot");

  return (
    <div ref={wrapRef} className={`relative h-full w-full overflow-hidden ${className ?? ""}`}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={`h-full w-full ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
        onWheel={
          interactive
            ? (event) => {
                event.preventDefault();
                const point = toMap(event);
                zoom(event.deltaY > 0 ? 1.18 : 0.85, point?.x, point?.y);
              }
            : undefined
        }
        onPointerDown={
          interactive
            ? (event) => {
                drag.current = { x: event.clientX, y: event.clientY, box: view, moved: false };
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            : undefined
        }
        onPointerMove={
          interactive
            ? (event) => {
                const start = drag.current;
                if (!start || !px) return;
                const dx = (event.clientX - start.x) / px;
                const dy = (event.clientY - start.y) / px;
                if (Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 4) {
                  start.moved = true;
                }
                if (!start.moved) return;
                setBox(clampBox({ ...start.box, x: start.box.x - dx, y: start.box.y - dy }));
              }
            : undefined
        }
        onPointerUp={interactive ? () => (drag.current = null) : undefined}
        onPointerLeave={
          interactive
            ? () => {
                drag.current = null;
                setHovered(null);
              }
            : undefined
        }
      >
        <defs>
          <linearGradient id="caspian" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor={MAP.seaDeep} />
            <stop offset="100%" stopColor={MAP.sea} />
          </linearGradient>
        </defs>

        {/* Mangystau desert around the city */}
        <rect
          x={-MAP_WIDTH}
          y={-MAP_HEIGHT}
          width={MAP_WIDTH * 3}
          height={MAP_HEIGHT * 3}
          fill={MAP.land}
        />
        <path d={SEA_PATH} fill="url(#caspian)" />
        <path
          d={ROADS_PATH}
          fill="none"
          stroke={MAP.road}
          strokeWidth={unit(2.2)}
          strokeLinecap="round"
        />
        <path d={COAST_PATH} fill="none" stroke={MAP.coast} strokeWidth={unit(1.4)} />

        {DISTRICT_GEO.map((geo) => {
          const state = statusById.get(geo.id);
          const unserved = geo.kind === "industrial" || !state;
          const selected = selectedId === geo.id;
          return (
            <path
              key={geo.id}
              d={geo.path}
              fill={unserved ? MAP.inactive : fillFor(state.status)}
              fillOpacity={unserved ? 0.5 : hovered === geo.id ? 1 : 0.88}
              stroke={selected ? MAP.selected : MAP.border}
              strokeWidth={unit(selected ? 2.6 : 1)}
              strokeLinejoin="round"
              className={onSelect && !unserved ? "cursor-pointer" : undefined}
              onClick={() => {
                if (drag.current?.moved) return;
                if (!unserved) onSelect?.(geo.id);
              }}
              onPointerEnter={() => setHovered(geo.id)}
            />
          );
        })}

        {showLandmarks
          ? LANDMARKS.filter((item) => item.onCanvas).map((item) => (
              <g key={item.id}>
                <circle cx={item.x} cy={item.y} r={unit(6)} fill={MAP.depot} />
                <circle cx={item.x} cy={item.y} r={unit(2.2)} fill="white" />
              </g>
            ))
          : null}

        {DISTRICT_GEO.map((geo) => {
          if (geo.kind === "industrial") return null;
          // Hide the label when the district is too small on screen to hold it.
          if (Math.sqrt(areaUnits(geo)) * px < 34) return null;
          const fontPx = 11;
          return (
            <text
              key={`${geo.id}-label`}
              x={geo.center.x}
              y={geo.center.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={unit(fontPx)}
              fontWeight={600}
              fill={MAP.label}
              stroke="white"
              strokeWidth={unit(fontPx * 0.28)}
              paintOrder="stroke"
              className="pointer-events-none select-none"
            >
              {geo.name.replace(" мкр", "")}
            </text>
          );
        })}

        {showTankers && depot && parked.length > 0 ? (
          <g className="pointer-events-none select-none">
            <rect
              x={depot.x - unit(24)}
              y={depot.y - unit(31)}
              width={unit(48)}
              height={unit(20)}
              rx={unit(10)}
              fill={MAP.depot}
            />
            <text
              x={depot.x}
              y={depot.y - unit(21)}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={unit(10.5)}
              fontWeight={700}
            >
              База {parked.length}
            </text>
          </g>
        ) : null}

        {showTankers
          ? active.map((tanker) => {
              const s = unit(24);
              return (
                <g key={tanker.id} transform={`translate(${tanker.x - s / 2} ${tanker.y - s / 2})`}>
                  <rect
                    width={s}
                    height={s}
                    rx={s * 0.28}
                    fill={tanker.status === "serving" ? MAP.tankerServing : MAP.tanker}
                    stroke="white"
                    strokeWidth={s * 0.1}
                  />
                  <text
                    x={s / 2}
                    y={s / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={s * 0.5}
                    fontWeight={700}
                    className="pointer-events-none select-none"
                  >
                    {tanker.number}
                  </text>
                </g>
              );
            })
          : null}
      </svg>

      {interactive ? (
        <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white/95 shadow-sm">
          <button
            className="px-2.5 py-1.5 text-[15px] leading-none text-[#2a3342] hover:bg-[#f4f6fa]"
            onClick={() => zoom(0.7)}
            aria-label="Приблизить"
          >
            +
          </button>
          <button
            className="border-t border-[#eef1f5] px-2.5 py-1.5 text-[15px] leading-none text-[#2a3342] hover:bg-[#f4f6fa]"
            onClick={() => zoom(1.42)}
            aria-label="Отдалить"
          >
            −
          </button>
          {zoomed ? (
            <button
              className="border-t border-[#eef1f5] px-2 py-1.5 text-[10px] font-semibold text-[#667085] hover:bg-[#f4f6fa]"
              onClick={() => setBox(null)}
            >
              Весь
            </button>
          ) : null}
        </div>
      ) : null}

      {showLegend ? <Legend parked={showTankers ? parked.length : null} /> : null}

      <p className="pointer-events-none absolute bottom-1.5 right-2.5 text-[10px] text-[#5c7891]">
        © OpenStreetMap
      </p>
    </div>
  );
}

const LEGEND: WaterStatus[] = ["normal", "low", "none"];

function Legend({ parked }: { parked: number | null }) {
  return (
    <div className="absolute bottom-3 left-3 rounded-xl border border-black/5 bg-white/95 px-2.5 py-2 shadow-sm">
      <div className="flex flex-col gap-1.5">
        {LEGEND.map((status) => (
          <div key={status} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: fillFor(status) }} />
            <span className="text-[10.5px] font-medium text-[#2a3342]">
              {statusLabelShort(status)}
            </span>
          </div>
        ))}
        <div className="mt-0.5 flex items-center gap-2 border-t border-[#eef1f5] pt-1.5">
          <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#1b2a4a]">
            <span className="h-[3px] w-[3px] rounded-full bg-white" />
          </span>
          <span className="text-[10.5px] font-medium text-[#2a3342]">
            {parked !== null ? `База КЖСА · ${parked} свободны` : "Инфраструктура"}
          </span>
        </div>
      </div>
    </div>
  );
}
