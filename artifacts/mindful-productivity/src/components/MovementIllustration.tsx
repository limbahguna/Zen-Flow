/**
 * MovementIllustration — inline SVG animated character for each movement step.
 *
 * Uses Framer Motion (already installed). Zero external assets, zero network
 * requests, zero new libraries.
 *
 * Character: stylised adult figure, green-themed clothing matching Mindful Space.
 * Respects `prefers-reduced-motion` and the `paused` prop.
 */
import { motion, useReducedMotion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MovementId =
  | "shoulder-rolls"
  | "neck-stretch"
  | "stand-walk"
  | "back-stretch"
  | "cooldown";

export interface MovementIllustrationProps {
  movement: MovementId;
  paused?: boolean;
  ariaLabel?: string;
  className?: string;
}

// ── Palette ───────────────────────────────────────────────────────────────────

const SKIN  = "#D4A574";   // warm neutral skin
const HAIR  = "#3D2B1F";   // dark brown
const SHIRT = "#4A6741";   // Mindful Space green
const PANTS = "#2D3A2E";   // dark green
const SHOE  = "#2A1A0E";   // near-black
const GLOW  = "#C8D5B9";   // theme accent

// ── Transition helpers ────────────────────────────────────────────────────────

function easeLoop(duration: number): Parameters<typeof motion.g>[0]["transition"] {
  return { duration, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" };
}
function linearLoop(duration: number): Parameters<typeof motion.g>[0]["transition"] {
  return { duration, repeat: Infinity, ease: "linear" };
}
function keyframeT(
  duration: number,
  times: number[],
): Parameters<typeof motion.g>[0]["transition"] {
  return { duration, repeat: Infinity, ease: "easeInOut", times };
}

// ── Static body primitives ────────────────────────────────────────────────────
// ViewBox "0 0 120 185" — character ~155px tall in 185px space

function Hair() {
  return <ellipse cx="60" cy="13" rx="12.5" ry="8" fill={HAIR} />;
}

function HeadFace() {
  return (
    <g>
      <circle cx="60" cy="26" r="15" fill={SKIN} />
      {/* eyes */}
      <circle cx="55" cy="25" r="2"   fill={HAIR} />
      <circle cx="65" cy="25" r="2"   fill={HAIR} />
      {/* smile */}
      <path
        d="M 54 31 Q 60 36 66 31"
        stroke={HAIR} strokeWidth="1.5" strokeLinecap="round" fill="none"
      />
    </g>
  );
}

function Neck() {
  return <rect x="56" y="39" width="8" height="9" rx="3.5" fill={SKIN} />;
}

function Torso() {
  return <rect x="37" y="46" width="46" height="46" rx="10" fill={SHIRT} />;
}

function PantsShape() {
  return <rect x="40" y="90" width="40" height="36" rx="6" fill={PANTS} />;
}

function LeftArm() {
  return (
    <g>
      <line x1="38" y1="58" x2="22" y2="82" stroke={SHIRT} strokeWidth="10" strokeLinecap="round" />
      <line x1="22" y1="82" x2="18" y2="104" stroke={SKIN}  strokeWidth="8"  strokeLinecap="round" />
    </g>
  );
}

function RightArm() {
  return (
    <g>
      <line x1="82" y1="58" x2="98" y2="82" stroke={SHIRT} strokeWidth="10" strokeLinecap="round" />
      <line x1="98" y1="82" x2="102" y2="104" stroke={SKIN}  strokeWidth="8"  strokeLinecap="round" />
    </g>
  );
}

function LeftLeg() {
  return (
    <g>
      <line x1="51" y1="126" x2="46" y2="158" stroke={PANTS} strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="42" cy="162" rx="9" ry="5" fill={SHOE} />
    </g>
  );
}

function RightLeg() {
  return (
    <g>
      <line x1="69" y1="126" x2="74" y2="158" stroke={PANTS} strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="78" cy="162" rx="9" ry="5" fill={SHOE} />
    </g>
  );
}

// Full static character — used when paused or reduced-motion
function StaticCharacter() {
  return (
    <>
      <LeftLeg /><RightLeg />
      <Torso /><PantsShape />
      <LeftArm /><RightArm />
      <Neck /><HeadFace /><Hair />
    </>
  );
}

// ── Movement compositions ─────────────────────────────────────────────────────

/** Shoulder rolls: shoulders rise + small circular sweep, ~2.5 s loop */
function ShoulderRolls({ go }: { go: boolean }) {
  const armT = go ? keyframeT(2.5, [0, 0.25, 0.5, 0.75, 1]) : {};
  const leftAnim  = go ? { y: [0, -9, -3, 3, 0], x: [0, -3, -5, -1, 0] } : { y: 0, x: 0 };
  const rightAnim = go ? { y: [0, -9, -3, 3, 0], x: [0,  3,  5,  1, 0] } : { y: 0, x: 0 };

  return (
    <>
      <LeftLeg /><RightLeg />
      <Torso /><PantsShape />

      {/* Circular arrows near each shoulder */}
      {go && (
        <>
          <motion.g
            style={{ transformOrigin: "22px 68px" }}
            animate={{ rotate: [0, 360] }}
            transition={linearLoop(2.5)}
          >
            <circle cx="22" cy="68" r="11" stroke={GLOW} strokeWidth="1.5"
              strokeDasharray="6 3" opacity="0.55" fill="none" />
          </motion.g>
          <motion.g
            style={{ transformOrigin: "98px 68px" }}
            animate={{ rotate: [360, 0] }}
            transition={linearLoop(2.5)}
          >
            <circle cx="98" cy="68" r="11" stroke={GLOW} strokeWidth="1.5"
              strokeDasharray="6 3" opacity="0.55" fill="none" />
          </motion.g>
        </>
      )}

      {/* Animated arms */}
      <motion.g animate={leftAnim}  transition={armT}><LeftArm  /></motion.g>
      <motion.g animate={rightAnim} transition={armT}><RightArm /></motion.g>

      <Neck /><HeadFace /><Hair />
    </>
  );
}

/** Neck stretch: head tilts gently left ↔ right, ~4 s loop */
function NeckStretch({ go }: { go: boolean }) {
  return (
    <>
      <LeftLeg /><RightLeg />
      <Torso /><PantsShape />
      <LeftArm /><RightArm />
      <Neck />
      {/* Rotate head around base of neck (60, 48) */}
      <motion.g
        style={{ transformOrigin: "60px 48px" }}
        animate={go ? { rotate: [-13, 13] } : { rotate: 0 }}
        transition={go ? easeLoop(4) : {}}
      >
        <HeadFace />
        <Hair />
      </motion.g>
    </>
  );
}

/** Stand and walk: arms + legs swing in natural walking coordination, ~1.5 s loop */
function StandWalk({ go }: { go: boolean }) {
  const t = go ? keyframeT(1.5, [0, 0.25, 0.5, 0.75, 1]) : {};
  // Natural walk: left arm with right leg; right arm with left leg
  const lArmRot  = go ? { rotate: [0, -24, 0,  24, 0] } : { rotate: 0 };
  const rArmRot  = go ? { rotate: [0,  24, 0, -24, 0] } : { rotate: 0 };
  const lLegRot  = go ? { rotate: [0,  20, 0, -20, 0] } : { rotate: 0 };
  const rLegRot  = go ? { rotate: [0, -20, 0,  20, 0] } : { rotate: 0 };
  const bodyBob  = go ? { y: [0, -3, 0, -3, 0] }        : { y: 0 };

  return (
    <motion.g animate={bodyBob} transition={t}>
      <motion.g style={{ transformOrigin: "51px 126px" }} animate={lLegRot} transition={t}>
        <LeftLeg />
      </motion.g>
      <motion.g style={{ transformOrigin: "69px 126px" }} animate={rLegRot} transition={t}>
        <RightLeg />
      </motion.g>
      <Torso /><PantsShape />
      <motion.g style={{ transformOrigin: "38px 58px" }} animate={lArmRot} transition={t}>
        <LeftArm />
      </motion.g>
      <motion.g style={{ transformOrigin: "82px 58px" }} animate={rArmRot} transition={t}>
        <RightArm />
      </motion.g>
      <Neck /><HeadFace /><Hair />
    </motion.g>
  );
}

/** Back stretch: arms raise alternately + body leans, ~4 s loop */
function BackStretch({ go }: { go: boolean }) {
  const t4 = go ? keyframeT(4, [0, 0.25, 0.5, 0.75, 1]) : {};
  // Left arm raises in first half; right arm raises in second half
  const lArmRot = go ? { rotate: [0, -115, -115, 0, 0] } : { rotate: 0 };
  const rArmRot = go ? { rotate: [0, 0, 0,  115, 0]    } : { rotate: 0 };
  const leanX   = go ? { x:      [0, -5, 0,  5, 0]     } : { x: 0 };

  return (
    <>
      <LeftLeg /><RightLeg />
      {/* Body leans with arm */}
      <motion.g animate={leanX} transition={t4}>
        <Torso /><PantsShape />
        <motion.g style={{ transformOrigin: "38px 58px" }} animate={lArmRot} transition={t4}>
          <LeftArm />
        </motion.g>
        <motion.g style={{ transformOrigin: "82px 58px" }} animate={rArmRot} transition={t4}>
          <RightArm />
        </motion.g>
        <Neck /><HeadFace /><Hair />
      </motion.g>
    </>
  );
}

/** Slow cooldown: standing still with breathing torso + pulsing glow, ~5 s loop */
function Cooldown({ go }: { go: boolean }) {
  const breatheT = go ? easeLoop(5) : {};
  return (
    <>
      <LeftLeg /><RightLeg />
      {/* Chest breathes gently */}
      <motion.g
        style={{ transformOrigin: "60px 69px" }}
        animate={go ? { scaleY: [1, 1.035, 1] } : { scaleY: 1 }}
        transition={breatheT}
      >
        <Torso /><PantsShape />
      </motion.g>
      <LeftArm /><RightArm />
      <Neck /><HeadFace /><Hair />
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MovementIllustration({
  movement,
  paused = false,
  ariaLabel,
  className,
}: MovementIllustrationProps) {
  const prefersReduced = useReducedMotion() ?? false;
  const go = !paused && !prefersReduced;

  return (
    <svg
      viewBox="0 0 120 185"
      role="img"
      aria-label={ariaLabel}
      data-movement={movement}
      data-paused={paused ? "true" : "false"}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Cooldown: pulsing glow circle behind character */}
      {movement === "cooldown" && (
        <motion.circle
          cx="60" cy="100" r="56"
          fill={GLOW}
          animate={go
            ? { scale: [1, 1.14, 1], opacity: [0.07, 0.17, 0.07] }
            : { scale: 1, opacity: 0.07 }
          }
          transition={go ? easeLoop(5) : {}}
          style={{ transformOrigin: "60px 100px" }}
        />
      )}

      {prefersReduced || paused ? (
        // Static pose for reduced motion or paused — all movements show rest position
        <StaticCharacter />
      ) : (
        <>
          {movement === "shoulder-rolls" && <ShoulderRolls go={go} />}
          {movement === "neck-stretch"   && <NeckStretch   go={go} />}
          {movement === "stand-walk"     && <StandWalk     go={go} />}
          {movement === "back-stretch"   && <BackStretch   go={go} />}
          {movement === "cooldown"       && <Cooldown      go={go} />}
        </>
      )}
    </svg>
  );
}
