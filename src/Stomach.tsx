import { useId, type CSSProperties } from "react";
import type { Food, Settings } from "./data";
const shape =
  "M 116 18 C 115 53 123 80 153 82 C 172 46 215 44 241 75 C 276 117 270 185 239 221 C 210 255 165 266 128 249 C 91 232 82 204 59 206 L 42 211 L 31 188 C 50 173 69 172 90 181 C 123 195 137 179 134 151 C 130 123 105 110 98 82 C 92 60 92 40 92 18 Z";
export default function Stomach({
  level,
  items,
  motion,
}: {
  level: number;
  items: Food[];
  motion?: Pick<Settings, "motion" | "motionSpeed" | "motionAmplitude">;
}) {
  const id = useId().replace(/:/g, "");
  const scale = 0.48 + (level - 1) * 0.104;
  const columns = Math.max(1, Math.ceil(Math.sqrt(items.length)));
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const size = Math.min(68, 108 / Math.max(columns, rows));
  return (
    <svg
      className="stomach"
      viewBox="0 0 300 290"
      role="img"
      aria-label={`${level}级胃部示意图，${items.map((f) => f.name).join("、") || "没有选择食物"}`}
    >
      <defs>
        <linearGradient id={`${id}fill`} x2=".8" y2="1">
          <stop stopColor="#ffe7cb" />
          <stop offset="1" stopColor="#f5b696" />
        </linearGradient>
        <clipPath id={`${id}clip`}>
          <path d={shape} />
        </clipPath>
        <radialGradient id={`${id}fade`}>
          <stop offset=".58" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
        <mask id={`${id}mask`} maskContentUnits="objectBoundingBox">
          <rect width="1" height="1" fill={`url(#${id}fade)`} />
        </mask>
      </defs>
      <g transform={`translate(150 145) scale(${scale}) translate(-150 -145)`}>
        <g
          className={
            motion?.motion ? "stomach-motion active" : "stomach-motion"
          }
          style={
            {
              "--motion-duration": `${[6, 4.5, 3, 2, 1.2][(motion?.motionSpeed ?? 3) - 1]}s`,
              "--squeeze-x": 1 - (motion?.motionAmplitude ?? 2) * 0.012,
              "--stretch-y": 1 + (motion?.motionAmplitude ?? 2) * 0.009,
              "--stretch-x": 1 + (motion?.motionAmplitude ?? 2) * 0.008,
              "--squeeze-y": 1 - (motion?.motionAmplitude ?? 2) * 0.01,
            } as CSSProperties
          }
        >
          <path d={shape} fill={`url(#${id}fill)`} />
          <g clipPath={`url(#${id}clip)`}>
            {items.map((f, i) => {
              const x = 143 + (i % columns) * size,
                y = 125 + Math.floor(i / columns) * size;
              return (
                <g
                  key={f.id}
                  transform={`translate(${x} ${y}) rotate(${i % 2 ? 9 : -9} ${size / 2} ${size / 2})`}
                >
                  <g mask={`url(#${id}mask)`}>
                    {f.image ? (
                      <image
                        href={f.image}
                        width={size}
                        height={size}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    ) : (
                      <text
                        x={size / 2}
                        y={size * 0.8}
                        textAnchor="middle"
                        fontSize={size * 0.82}
                      >
                        {f.emoji}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
            <ellipse
              cx="211"
              cy="104"
              rx="13"
              ry="22"
              fill="white"
              opacity=".2"
              transform="rotate(-30 211 104)"
            />
          </g>
          <path
            d={shape}
            fill="none"
            stroke="#dc987c"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <path
            d="M109 42Q108 65 122 82"
            fill="none"
            stroke="#fff6e7"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="181" cy="94" r="3.5" fill="#79594f" />
          <circle cx="208" cy="94" r="3.5" fill="#79594f" />
          <path
            d="M189 103Q195 109 201 103"
            fill="none"
            stroke="#79594f"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
