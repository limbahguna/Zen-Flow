import type { FocusGoalId } from "@/lib/focusGoals";

const PALETTE = {
  sky: "#C5D4B8",
  leaf: "#8FA680",
  deep: "#4A5D3E",
  gold: "#D4B96A",
  dusk: "#7A8FB0",
  paper: "#E8EDE3",
  ink: "#2D3A2E",
  water: "#7AA8A8",
};

interface FocusGoalArtProps {
  goal: FocusGoalId;
  label: string;
  className?: string;
}

export function FocusGoalArt({ goal, label, className }: FocusGoalArtProps) {
  return (
    <svg
      viewBox="0 0 96 72"
      className={className}
      role="img"
      aria-label={label}
      focusable="false"
    >
      {goal === "mood" && <MoodArt />}
      {goal === "calm" && <CalmArt />}
      {goal === "focus" && <FocusArt />}
      {goal === "sleep" && <SleepArt />}
      {goal === "journal" && <JournalArt />}
    </svg>
  );
}

function MoodArt() {
  return (
    <g>
      <rect width="96" height="72" rx="14" fill="#2A3328" />
      <circle cx="28" cy="24" r="10" fill={PALETTE.gold} />
      <circle cx="68" cy="22" r="7" fill={PALETTE.dusk} opacity="0.85" />
      <path d="M8 56 C24 40, 40 48, 52 42 C64 36, 76 44, 88 38 L88 64 L8 64 Z" fill={PALETTE.leaf} />
      <path d="M8 62 C22 52, 38 58, 50 54 C66 48, 78 56, 88 52 L88 64 L8 64 Z" fill={PALETTE.deep} />
    </g>
  );
}

function CalmArt() {
  return (
    <g>
      <rect width="96" height="72" rx="14" fill="#24302C" />
      <ellipse cx="48" cy="44" rx="28" ry="10" fill={PALETTE.water} opacity="0.35" />
      <ellipse cx="48" cy="44" rx="18" ry="6" fill="none" stroke={PALETTE.water} strokeWidth="1.5" />
      <ellipse cx="48" cy="44" rx="10" ry="3" fill="none" stroke={PALETTE.paper} strokeWidth="1" opacity="0.7" />
      <path d="M48 18 C54 18, 58 24, 52 32 C50 28, 46 28, 44 32 C38 24, 42 18, 48 18 Z" fill={PALETTE.leaf} />
    </g>
  );
}

function FocusArt() {
  return (
    <g>
      <rect width="96" height="72" rx="14" fill="#2C2A22" />
      <rect x="18" y="38" width="60" height="18" rx="3" fill="#3A372C" />
      <rect x="38" y="22" width="20" height="16" rx="2" fill={PALETTE.paper} />
      <rect x="42" y="18" width="12" height="4" rx="1" fill={PALETTE.gold} />
      <circle cx="72" cy="30" r="8" fill="none" stroke={PALETTE.leaf} strokeWidth="2.5" />
      <path d="M72 24 V30 H76" fill="none" stroke={PALETTE.gold} strokeWidth="2" strokeLinecap="round" />
      <circle cx="26" cy="32" r="5" fill={PALETTE.deep} />
      <path d="M26 37 C22 44, 30 44, 26 37" fill={PALETTE.leaf} />
    </g>
  );
}

function SleepArt() {
  return (
    <g>
      <rect width="96" height="72" rx="14" fill="#1C2230" />
      <path d="M58 20 A16 16 0 1 1 42 44 A12 12 0 1 0 58 20 Z" fill={PALETTE.gold} />
      <circle cx="22" cy="22" r="1.6" fill={PALETTE.paper} />
      <circle cx="34" cy="16" r="1.2" fill={PALETTE.paper} />
      <circle cx="78" cy="28" r="1.4" fill={PALETTE.paper} />
      <circle cx="70" cy="14" r="1" fill={PALETTE.paper} />
      <path d="M12 56 C28 48, 48 60, 84 50 L84 64 L12 64 Z" fill="#2A3348" />
    </g>
  );
}

function JournalArt() {
  return (
    <g>
      <rect width="96" height="72" rx="14" fill="#2A2420" />
      <rect x="22" y="16" width="52" height="42" rx="4" fill={PALETTE.paper} />
      <rect x="46" y="16" width="4" height="42" fill="#C8C2B4" />
      <path d="M30 28 H42" stroke={PALETTE.ink} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M30 34 H42" stroke={PALETTE.ink} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M30 40 H40" stroke={PALETTE.ink} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M56 28 H70" stroke={PALETTE.leaf} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M56 34 H68" stroke={PALETTE.leaf} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M62 48 C66 42, 72 46, 66 52 C64 48, 60 48, 58 52 C54 46, 58 42, 62 48 Z" fill={PALETTE.leaf} />
    </g>
  );
}
