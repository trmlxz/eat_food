import { useId, type CSSProperties } from "react";
import type { Food, Settings, Expression } from "./data";
const shape =
  "M 116 18 C 115 53 123 80 153 82 C 172 46 215 44 241 75 C 276 117 270 185 239 221 C 210 255 165 266 128 249 C 91 232 82 204 59 206 L 42 211 L 31 188 C 50 173 69 172 90 181 C 123 195 137 179 134 151 C 130 123 105 110 98 82 C 92 60 92 40 92 18 Z";
export default function Stomach({
  level,
  items,
  motion,
  expression = "smile",
  craving,
}: {
  expression?: Expression;
  craving?: Food;
  level: number;
  items: Food[];
  motion?: Pick<Settings, "motion" | "motionSpeed" | "motionAmplitude">;
}) {
  const id = useId().replace(/:/g, "");
  const scale = [0.36, 0.54, 0.75, 1, 1.5, 2.2][level - 1];
  const columns = Math.max(1, Math.ceil(Math.sqrt(items.length)));
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const size = Math.min(68, 108 / Math.max(columns, rows));
  return (
    <svg
      className="stomach"
      viewBox="20 4 260 264"
      role="img"
      aria-label={`${level}级胃部示意图，${items.map((f) => f.name).join("、") || "没有选择食物"}${craving ? `，想吃${craving.name}` : ""}`}
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
        {craving?.image && (
          <clipPath id={`${id}craving-clip`}>
            <rect x="208" y="20" width="48" height="44" rx="10" />
          </clipPath>
        )}
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
          <g
            data-expression={expression}
            transform="translate(-10 32)"
            stroke="#79594f"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            {expression === "cry" ? (
              <>
                <path d="M175 90l10 4M204 94l10-4" fill="none" />
                <path d="M186 110Q195 99 204 110" fill="none" />
                <path
                  d="M179 98Q171 108 179 111Q187 108 179 98Z"
                  fill="#80cff0"
                  stroke="none"
                />
                <path
                  d="M210 98Q202 108 210 111Q218 108 210 98Z"
                  fill="#80cff0"
                  stroke="none"
                />
              </>
            ) : expression === "sad" ? (
              <>
                <path d="M175 88l10 4M204 92l10-4" fill="none" />
                <circle cx="181" cy="96" r="3" fill="#79594f" stroke="none" />
                <circle cx="208" cy="96" r="3" fill="#79594f" stroke="none" />
                <path d="M186 111Q195 101 204 111" fill="none" />
              </>
            ) : expression === "laugh" ? (
              <>
                <path
                  d="M176 94Q181 84 186 94M203 94Q208 84 213 94"
                  fill="none"
                />
                <path
                  d="M183 101H207Q205 121 195 122Q185 121 183 101Z"
                  fill="#79594f"
                />
                <path
                  d="M188 116Q195 110 202 116Q195 124 188 116Z"
                  fill="#ee9293"
                  stroke="none"
                />
              </>
            ) : (
              <>
                <circle cx="181" cy="94" r="3.5" fill="#79594f" stroke="none" />
                <circle cx="208" cy="94" r="3.5" fill="#79594f" stroke="none" />
                <path d="M187 103Q195 114 203 103" fill="none" />
              </>
            )}
          </g>
        </g>
        {craving && (
          <g
            className="thought-bubble"
            data-craving={craving.id}
            aria-hidden="true"
          >
            <g fill="#fffdf7" stroke="#dc987c" strokeWidth="2.3">
              <circle cx="192" cy="96" r="3" />
              <circle cx="202" cy="83" r="5" />
              <path
                d="M200 23C198 11 214 6 224 12C234 1 252 7 254 17C270 15 279 29 272 40C282 51 270 67 257 65C248 77 231 73 227 66C211 75 196 67 198 56C184 55 182 37 193 32C190 27 194 23 200 23Z"
                strokeLinejoin="round"
              />
            </g>
            {craving.image ? (
              <image
                href={craving.image}
                x="208"
                y="20"
                width="48"
                height="44"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${id}craving-clip)`}
              />
            ) : (
              <text x="232" y="57" textAnchor="middle" fontSize="40">
                {craving.emoji}
              </text>
            )}
          </g>
        )}
      </g>
    </svg>
  );
}
