import { ratioColor } from "@/lib/insights";
import { useLanguage } from "@/context/LanguageContext";

interface RatioCircleProps {
  ratio: number;
  planned: number;
  done: number;
}

export function RatioCircle({ ratio, planned, done }: RatioCircleProps) {
  const { t } = useLanguage();
  const size = 120;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (ratio / 100) * circumference;
  const color = ratioColor(ratio);

  // The t() on LanguageContext doesn't pass values, so we interpolate manually.
  const summaryRaw = planned === 0
    ? t("ratio.empty")
    : t("ratio.summary")
        .replace("{done}", String(done))
        .replace("{planned}", String(planned));

  return (
    <div className="flex flex-col items-center" data-testid="ratio-circle">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2D3A2E"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease-out, stroke 0.3s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-heading font-bold text-[#E8EDE3] tabular-nums"
            style={{ fontSize: 32 }}
            data-testid="ratio-percent"
          >
            {ratio}%
          </span>
        </div>
      </div>
      <p className="text-sm text-[#7A8A72] mt-3 text-center" data-testid="ratio-summary">
        {summaryRaw}
      </p>
    </div>
  );
}
