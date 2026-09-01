// ── Recovery-trajectory line chart ────────────────────────────────────────────
// Shared by the Factors tab (FunctionalOutcomesPanel) and any other view that
// needs the potency / continence recovery curves. Pure presentational — hand it
// the timelines from computeFunctionalOutcomes().

const TIME_LABELS = ["6 wk", "3 mo", "6 mo", "12 mo", "18 mo"];

export function RecoveryLineChart({
  potency,
  continence,
  height = 140,
  large = false,
}: {
  potency: (number | null)[];
  continence: (number | null)[];
  height?: number;
  large?: boolean;
}) {
  const W = large ? 640 : 400,
    H = height;
  const padL = large ? 42 : 34,
    padR = large ? 20 : 12,
    padT = large ? 28 : 22,
    padB = large ? 34 : 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = TIME_LABELS.length;
  const dotR = large ? 5 : 3.5;
  const lineW = large ? 3.5 : 2.5;
  const labelSize = large ? 13 : 9;
  const axisSize = large ? 12 : 9;
  const labelGap = large ? 18 : 12;
  // Minimum vertical separation (px) below which two same-index labels would
  // visually collide; when lines converge, push labels further apart instead
  // of letting them overlap.
  const minSep = large ? 30 : 16;

  const xOf = (i: number) => padL + (i / (n - 1)) * plotW;
  const yOf = (v: number) => padT + (1 - v / 100) * plotH;

  function buildPath(vals: (number | null)[]) {
    let d = "",
      pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  }

  const grids = [25, 50, 75, 100];
  const potencyHasData = potency.some((v) => v !== null);

  // Decide, per time point, which series sits above the other so labels can
  // be pushed outward (away from the other line) instead of overlapping when
  // the two curves converge near the top of the chart.
  function labelOffsets(i: number): { continence: number; potency: number } {
    const c = continence[i],
      p = potency[i];
    if (c == null || p == null || !potencyHasData) {
      return { continence: labelGap, potency: -labelGap * 0.65 };
    }
    const dy = Math.abs(yOf(c) - yOf(p));
    const extra = dy < minSep ? minSep - dy : 0;
    if (yOf(c) <= yOf(p)) {
      // continence dot sits above (or level with) potency dot → push its
      // label further up, and potency's label further down, away from each other
      return { continence: -(labelGap * 0.65 + extra), potency: labelGap + extra };
    }
    return { continence: labelGap + extra, potency: -(labelGap * 0.65 + extra) };
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: H }}>
      {/* Grid lines */}
      {grids.map((g) => (
        <line
          key={g}
          x1={padL}
          y1={yOf(g)}
          x2={W - padR}
          y2={yOf(g)}
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={1}
        />
      ))}
      {/* Y-axis labels */}
      {grids.map((g) => (
        <text
          key={g}
          x={padL - 6}
          y={yOf(g)}
          textAnchor="end"
          dominantBaseline="middle"
          fill="currentColor"
          fillOpacity={0.35}
          fontSize={axisSize}
        >
          {g}%
        </text>
      ))}
      {/* X-axis baseline */}
      <line
        x1={padL}
        y1={padT + plotH}
        x2={W - padR}
        y2={padT + plotH}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />
      {/* X-axis labels */}
      {TIME_LABELS.map((lbl, i) => (
        <text
          key={i}
          x={xOf(i)}
          y={H - (large ? 8 : 4)}
          textAnchor="middle"
          fill="currentColor"
          fillOpacity={0.45}
          fontSize={axisSize}
        >
          {lbl}
        </text>
      ))}

      {/* Continence line + dots */}
      <path
        d={buildPath(continence)}
        fill="none"
        stroke="#8b5cf6"
        strokeWidth={lineW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {continence.map(
        (v, i) =>
          v !== null && (
            <g key={i}>
              <circle cx={xOf(i)} cy={yOf(v)} r={dotR} fill="#8b5cf6" />
              <text
                x={xOf(i)}
                y={yOf(v) + labelOffsets(i).continence}
                textAnchor="middle"
                fill="#8b5cf6"
                fontSize={labelSize}
                fontWeight="bold"
              >
                {v}%
              </text>
            </g>
          ),
      )}

      {/* Potency line + dots (only if SHIM valid) */}
      {potencyHasData && (
        <>
          <path
            d={buildPath(potency)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={lineW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {potency.map(
            (v, i) =>
              v !== null && (
                <g key={i}>
                  <circle cx={xOf(i)} cy={yOf(v)} r={dotR} fill="#3b82f6" />
                  <text
                    x={xOf(i)}
                    y={yOf(v) + labelOffsets(i).potency}
                    textAnchor="middle"
                    fill="#3b82f6"
                    fontSize={labelSize}
                    fontWeight="bold"
                  >
                    {v}%
                  </text>
                </g>
              ),
          )}
        </>
      )}
    </svg>
  );
}
