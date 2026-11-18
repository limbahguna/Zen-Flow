import { useId } from "react";

interface KindEaseMarkProps {
  size?: number;
  variant?: "tile" | "plain";
  className?: string;
  title?: string;
}

const CREAM = "#EFE7D6";
const SAGE = "#8FA889";
const TILE_BG = "#2F4236";

/**
 * Inline KindEase mark (circle + breath wave).
 * Small sizes use thicker strokes so the mark stays readable when scaled down.
 */
export function KindEaseMark({
  size = 40,
  variant = "plain",
  className,
  title,
}: KindEaseMarkProps) {
  const rawId = useId().replace(/:/g, "");
  const gradientId = `kindease-wave-${rawId}`;
  const markPx = variant === "tile" ? Math.round(size * 0.7) : size;
  const thick = markPx <= 48;
  const circleStroke = thick ? 44 : 26;
  const waveStroke = thick ? 52 : 30;
  const radiusPx = Math.round(size * 0.22);

  const svg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={markPx}
      height={markPx}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title && variant === "plain" ? "img" : "presentation"}
      aria-label={variant === "plain" ? title : undefined}
      aria-hidden={variant === "plain" && title ? undefined : true}
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="150"
          y1="0"
          x2="874"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={CREAM} />
          <stop offset="0.5" stopColor={CREAM} />
          <stop offset="0.62" stopColor={SAGE} />
          <stop offset="1" stopColor={SAGE} />
        </linearGradient>
      </defs>
      <circle
        cx="512"
        cy="512"
        r="312"
        stroke={CREAM}
        strokeWidth={circleStroke}
        strokeOpacity={1}
      />
      <path
        d="M150 556 C205 556 228 498 290 498 C365 498 392 604 452 604 C522 604 578 424 664 424 C742 424 784 548 874 548"
        stroke={`url(#${gradientId})`}
        strokeWidth={waveStroke}
        strokeOpacity={1}
      />
    </svg>
  );

  if (variant === "tile") {
    return (
      <span
        className={className}
        role={title ? "img" : undefined}
        aria-label={title}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: radiusPx,
          backgroundColor: TILE_BG,
          flexShrink: 0,
          boxShadow: size >= 72 ? "0 8px 20px rgba(0, 0, 0, 0.28)" : undefined,
        }}
      >
        {svg}
      </span>
    );
  }

  return className ? (
    <span className={className} style={{ display: "inline-flex", flexShrink: 0 }}>
      {svg}
    </span>
  ) : (
    svg
  );
}
