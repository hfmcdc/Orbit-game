interface ProximityRingProps {
  bestRank: number | null;
  vocabSize?: number;
  size?: number;
}

/**
 * The signature visual: a "core" (the secret word) at the center, with the
 * player's best guess plotted as a glowing point along a ring. Distance from
 * the core encodes semantic distance — rank 1 sits on the core itself, high
 * ranks sit near the outer edge. Color shifts from cool blue (far) to warm
 * amber/gold (close) as the player's best rank improves.
 */
export function ProximityRing({ bestRank, vocabSize = 8000, size = 120 }: ProximityRingProps) {
  const center = size / 2;
  const maxRadius = size / 2 - 10;
  const minRadius = 8;

  // percentile: 0 = at the core (rank 1), 1 = at the far edge
  const percentile = bestRank
    ? Math.min(1, Math.log(bestRank) / Math.log(vocabSize))
    : 1;
  const radius = bestRank ? minRadius + percentile * (maxRadius - minRadius) : maxRadius;

  // color interpolation: far (blue) -> close (amber) -> won (gold)
  const t = 1 - percentile; // 0 = far, 1 = close
  const color = bestRank
    ? interpolateColor(t)
    : "#3A4265";

  const angle = -90; // fixed angle, point sits at top, distance is what matters
  const rad = (angle * Math.PI) / 180;
  const dotX = center + radius * Math.cos(rad);
  const dotY = center + radius * Math.sin(rad);

  const rings = [0.33, 0.66, 1].map((f) => minRadius + f * (maxRadius - minRadius));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={bestRank ? `Best rank: ${bestRank}` : "No guesses yet"}
    >
      {rings.map((r, i) => (
        <circle
          key={i}
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="#2A3350"
          strokeWidth={1}
        />
      ))}
      {/* core = the secret word */}
      <circle cx={center} cy={center} r={minRadius - 3} fill="#131829" stroke="#5B7CFA" strokeWidth={1.5} opacity={0.9} />
      {bestRank === 1 ? (
        <circle cx={center} cy={center} r={minRadius - 3} fill="#FFD166" opacity={0.9} />
      ) : (
        <circle
          cx={dotX}
          cy={dotY}
          r={6}
          fill={color}
          style={{ transition: "cx 400ms ease, cy 400ms ease, fill 400ms ease" }}
        >
          <title>{bestRank ? `#${bestRank}` : "No guesses yet"}</title>
        </circle>
      )}
    </svg>
  );
}

function interpolateColor(t: number): string {
  // t in [0,1]: 0 = far/blue (#5B7CFA), 1 = close/amber (#FFB454)
  const from = { r: 0x5b, g: 0x7c, b: 0xfa };
  const to = { r: 0xff, g: 0xb4, b: 0x54 };
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r},${g},${b})`;
}
