import { BreathingExercise } from "./BreathingExercise";

interface BreathingModalProps {
  onClose: () => void;
}

export function BreathingModal({ onClose }: BreathingModalProps) {
  return <BreathingExercise onFinish={() => onClose()} />;
}
