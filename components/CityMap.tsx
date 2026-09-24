"use client";

import { fillFor } from "@/lib/labels";
import type { District, PublicTanker } from "@/lib/types";

export function CityMap({
  districts,
  tankers = [],
  showTankers = false,
  selectedId,
  onSelect,
}: {
  districts: District[];
  tankers?: PublicTanker[];
  showTankers?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <svg viewBox="0 0 390 640" className="h-full w-full">
      <rect width="390" height="640" fill="#D4E5F2" />
      {districts.map((district) => (
        <path
          key={district.id}
          d={district.path}
          fill={fillFor(district.status, district.baseFill)}
          stroke={selectedId === district.id ? "#2F6BFF" : "white"}
          strokeWidth={selectedId === district.id ? 8 : 6}
          strokeLinejoin="round"
          className={onSelect ? "cursor-pointer" : undefined}
          onClick={() => onSelect?.(district.id)}
        />
      ))}
      {districts.map((district) => (
        <text
          key={`${district.id}-label`}
          x={district.label.x}
          y={district.label.y + 12}
          fill="#1B1F27"
          fontSize="12"
          fontWeight="600"
          className="pointer-events-none"
        >
          {district.name}
        </text>
      ))}
      <text x="16" y="460" fill="#1B1F27" fontSize="12" fontWeight="600">
        Актау
      </text>
      {showTankers
        ? tankers.map((tanker) => (
            <g key={tanker.id} transform={`translate(${tanker.x - 17} ${tanker.y - 17})`}>
              <rect width="34" height="34" rx="10" fill="#2F6BFF" />
              <text x="17" y="22" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">
                {tanker.number}
              </text>
            </g>
          ))
        : null}
    </svg>
  );
}
