"use client";

import { useState } from "react";
import styles from "./customer-insights.module.css";

export type ChartSlice = {
  label: string;
  value: number;
  percentage?: number;
  color: string;
  subtext?: string;
};

export type PieChartSVGProps = {
  title?: string;
  slices: ChartSlice[];
  size?: number;
  donutRadius?: number;
  centerLabel?: string;
  centerSub?: string;
  emptyText?: string;
  valueUnit?: string;
  selectedLabel?: string | null;
  onSliceClick?: (label: string) => void;
  interactiveHint?: string;
};

export function PieChartSVG({
  title,
  slices,
  size = 180,
  centerLabel,
  centerSub,
  emptyText = "Chưa có dữ liệu",
  valueUnit = "",
  selectedLabel = null,
  onSliceClick,
  interactiveHint,
}: PieChartSVGProps) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const total = slices.reduce((acc, s) => acc + (s.value || 0), 0);
  const cx = 100;
  const cy = 100;
  const R = 86;
  const r = 52;

  // Filter out non-positive slices for drawing, but keep legend
  const drawableSlices = slices.filter((s) => s.value > 0);

  // Compute SVG arcs
  let currentAngle = -Math.PI / 2;
  const paths = drawableSlices.map((slice, idx) => {
    const fraction = total > 0 ? slice.value / total : 0;
    const angle = fraction * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const isSingleSlice = drawableSlices.length === 1 || fraction >= 0.999;
    if (isSingleSlice) {
      return {
        isSingle: true,
        slice,
        idx,
      };
    }

    const largeArc = angle > Math.PI ? 1 : 0;
    const x1o = cx + R * Math.cos(startAngle);
    const y1o = cy + R * Math.sin(startAngle);
    const x2o = cx + R * Math.cos(endAngle);
    const y2o = cy + R * Math.sin(endAngle);

    const x2i = cx + r * Math.cos(endAngle);
    const y2i = cy + r * Math.sin(endAngle);
    const x1i = cx + r * Math.cos(startAngle);
    const y1i = cy + r * Math.sin(startAngle);

    const d = `M ${x1o.toFixed(2)} ${y1o.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)} L ${x2i.toFixed(2)} ${y2i.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)} Z`;

    return {
      isSingle: false,
      d,
      slice,
      idx,
    };
  });

  const activeSlice = hoveredLabel !== null ? slices.find((s) => s.label === hoveredLabel) || null : null;
  const displayCenterLabel = activeSlice
    ? activeSlice.value.toLocaleString("vi-VN")
    : centerLabel !== undefined
    ? centerLabel
    : total.toLocaleString("vi-VN");
  const displayCenterSub = activeSlice
    ? `${activeSlice.percentage ?? (total > 0 ? ((activeSlice.value / total) * 100).toFixed(1) : 0)}%`
    : centerSub !== undefined
    ? centerSub
    : valueUnit;

  return (
    <div className={styles.pieCardBlock}>
      <div className={styles.pieBlockHeader}>
        {title && <h4 className={styles.pieBlockTitle}>{title}</h4>}
        {interactiveHint && (
          <span className={styles.pieInteractiveHint}>{interactiveHint}</span>
        )}
      </div>
      <div className={styles.pieChartContainer}>
        <div className={styles.pieSvgWrapper} style={{ width: size, height: size }}>
          <svg
            viewBox="0 0 200 200"
            className={styles.pieSvg}
            role="img"
            aria-label={title || "Biểu đồ tròn"}
          >
            {total <= 0 ? (
              // Empty placeholder ring
              <circle
                cx={cx}
                cy={cy}
                r={(R + r) / 2}
                fill="none"
                stroke="#e5e9e2"
                strokeWidth={R - r}
              />
            ) : (
              paths.map((p) => {
                const isHovered = hoveredLabel === p.slice.label;
                const isSelected = selectedLabel === p.slice.label;
                const hasSelection = Boolean(selectedLabel && selectedLabel !== "Tất cả");

                let opacity = 1;
                if (hasSelection) {
                  opacity = isSelected ? 1 : 0.35;
                } else if (hoveredLabel !== null) {
                  opacity = isHovered ? 1 : 0.55;
                }

                if (p.isSingle) {
                  return (
                    <circle
                      key={p.idx}
                      cx={cx}
                      cy={cy}
                      r={(R + r) / 2}
                      fill="none"
                      stroke={p.slice.color}
                      strokeWidth={R - r}
                      opacity={opacity}
                      style={{
                        transition: "opacity 0.2s, stroke-width 0.2s",
                        cursor: onSliceClick ? "pointer" : "default",
                      }}
                      onMouseEnter={() => setHoveredLabel(p.slice.label)}
                      onMouseLeave={() => setHoveredLabel(null)}
                      onClick={() => onSliceClick && onSliceClick(p.slice.label)}
                    >
                      <title>{`${p.slice.label}: ${p.slice.value.toLocaleString("vi-VN")} (100%)`}</title>
                    </circle>
                  );
                }

                return (
                  <path
                    key={p.idx}
                    d={p.d}
                    fill={p.slice.color}
                    stroke={isSelected ? "#14a800" : "#ffffff"}
                    strokeWidth={isSelected ? 3 : 1.5}
                    opacity={opacity}
                    style={{
                      transition: "opacity 0.2s, transform 0.2s, stroke 0.2s",
                      cursor: onSliceClick ? "pointer" : "default",
                    }}
                    onMouseEnter={() => setHoveredLabel(p.slice.label)}
                    onMouseLeave={() => setHoveredLabel(null)}
                    onClick={() => onSliceClick && onSliceClick(p.slice.label)}
                  >
                    <title>{`${p.slice.label}: ${p.slice.value.toLocaleString("vi-VN")} (${p.slice.percentage ?? ((p.slice.value / total) * 100).toFixed(1)}%)`}</title>
                  </path>
                );
              })
            )}

            {/* Donut Center Label */}
            <circle cx={cx} cy={cy} r={r - 4} fill="#ffffff" />
            <text
              x={cx}
              y={displayCenterSub ? cy - 2 : cy + 6}
              textAnchor="middle"
              className={styles.pieCenterVal}
            >
              {total <= 0 ? "0" : displayCenterLabel}
            </text>
            {displayCenterSub && (
              <text
                x={cx}
                y={cy + 16}
                textAnchor="middle"
                className={styles.pieCenterSub}
              >
                {total <= 0 ? emptyText : displayCenterSub}
              </text>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className={styles.pieLegend}>
          {slices.length === 0 || total <= 0 ? (
            <div className={styles.pieEmptyHint}>{emptyText}</div>
          ) : (
            slices.map((s) => {
              const isHovered = hoveredLabel === s.label;
              const isSelected = selectedLabel === s.label;
              const pct =
                s.percentage !== undefined
                  ? s.percentage
                  : total > 0
                  ? Number(((s.value / total) * 100).toFixed(1))
                  : 0;

              return (
                <div
                  key={s.label}
                  className={`${styles.pieLegendRow} ${
                    onSliceClick ? styles.pieLegendRowClickable : ""
                  } ${isHovered ? styles.pieLegendRowActive : ""} ${
                    isSelected ? styles.pieLegendRowSelected : ""
                  }`}
                  onMouseEnter={() => setHoveredLabel(s.label)}
                  onMouseLeave={() => setHoveredLabel(null)}
                  onClick={() => onSliceClick && onSliceClick(s.label)}
                  title={onSliceClick ? `Nhấp để lọc tương tác theo ${s.label}` : s.label}
                >
                  <div className={styles.pieLegendLeft}>
                    <span
                      className={styles.pieLegendDot}
                      style={{ backgroundColor: s.color }}
                    />
                    <span className={styles.pieLegendLabel} title={s.label}>
                      {s.label}
                    </span>
                  </div>
                  <div className={styles.pieLegendRight}>
                    <strong>{s.value.toLocaleString("vi-VN")}</strong>
                    <small>{pct}%</small>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

