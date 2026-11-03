import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Group } from "three";
import { ArmPhase, SimulationState } from "../types";

interface SwimmerModelProps {
  rollAngle: number;
  pitchAngle: number;
  strokeTime: number;
  strokeInterval: number;
  rightArmPhase: ArmPhase;
  leftArmPhase: ArmPhase;
  rightArmTime: number;
  leftArmTime: number;
  distance: number;
  yOffset: number;
  state: SimulationState;
}

export function SwimmerModel({
  rollAngle,
  pitchAngle,
  strokeTime,
  strokeInterval,
  rightArmPhase,
  leftArmPhase,
  rightArmTime,
  leftArmTime,
  distance,
  yOffset,
  state: simState,
}: SwimmerModelProps) {
  const groupRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);

  const isMoving = simState !== SimulationState.Stopped && simState !== SimulationState.Finished;

  const getArmRotation = (phase: ArmPhase, time: number) => {
    if (phase === ArmPhase.Idle || phase === ArmPhase.ExtendedForward || strokeTime <= 0) return 0;

    const progress = Math.max(0, Math.min(1, time / strokeTime));

    if (phase === ArmPhase.Catch) {
      return (progress / 0.125) * 0.5;
    }
    if (phase === ArmPhase.Pull) {
      return 0.5 + ((progress - 0.125) / 0.125) * 1.0;
    }
    if (phase === ArmPhase.Push) {
      return 1.5 + ((progress - 0.25) / 0.25) * (Math.PI - 1.5);
    }
    if (phase === ArmPhase.Recovery) {
      return Math.PI + ((progress - 0.5) / 0.5) * Math.PI;
    }

    return 0;
  };

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (groupRef.current) {
      // Simulation convention: negative roll = right shoulder down.
      // Three.js Z rotation is inverted here so the visual pose follows that convention.
      groupRef.current.rotation.z = (-rollAngle * Math.PI) / 180;
      // Positive Body Pitch raises the upper body; negative lowers it.
      groupRef.current.rotation.x = (-pitchAngle * Math.PI) / 180;
      groupRef.current.position.z = distance;
      groupRef.current.position.y = yOffset;
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = getArmRotation(rightArmPhase, rightArmTime);
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = getArmRotation(leftArmPhase, leftArmTime);
    }

    // Flutter kick remains continuous while the swimmer is active.
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = isMoving ? Math.sin(t * 12) * 0.25 : 0;
    }
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = isMoving ? Math.sin(t * 12 + Math.PI) * 0.25 : 0;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.2, 0.8]} />
        <meshStandardMaterial color="#00aaff" roughness={0.3} metalness={0.2} />
      </mesh>

      <group position={[0, 0, 0.5]}>
        <mesh>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#ffd6a5" />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.125, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#00ffff" />
        </mesh>
      </group>

      {/* Anatomical right arm: red hand */}
      <group ref={rightArmRef} position={[-0.22, 0, 0.35]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.04, 0.03, 0.45, 8]} />
          <meshStandardMaterial color="#ffd6a5" />
        </mesh>
        <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.08, 0.01, 0.12]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      </group>

      {/* Anatomical left arm: blue hand */}
      <group ref={leftArmRef} position={[0.22, 0, 0.35]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.04, 0.03, 0.45, 8]} />
          <meshStandardMaterial color="#ffd6a5" />
        </mesh>
        <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.08, 0.01, 0.12]} />
          <meshStandardMaterial color="#0000ff" />
        </mesh>
      </group>

      <group ref={rightLegRef} position={[-0.12, 0, -0.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.06, 0.04, 0.65, 8]} />
          <meshStandardMaterial color="#ffd6a5" />
        </mesh>
      </group>
      <group ref={leftLegRef} position={[0.12, 0, -0.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.06, 0.04, 0.65, 8]} />
          <meshStandardMaterial color="#ffd6a5" />
        </mesh>
      </group>

      {isMoving && (
        <>
          <mesh position={[0, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.05, 50]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.2} />
          </mesh>

          {/* Anchored to the swimmer itself: local -Z is behind the legs. */}
          <Html
            position={[0, 0.05, -1.15]}
            center
            distanceFactor={8}
            style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
          >
            <div className="px-4 py-2 bg-black/80 backdrop-blur-md border border-blue-500/50 rounded-xl shadow-2xl flex items-center gap-3 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,1)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                Roll: <span className="text-cyan-400">{rollAngle.toFixed(1)}°</span>
                <span className="mx-2 text-gray-500">|</span>
                Stroke Interval: <span className="text-yellow-400">{strokeInterval.toFixed(2)}s</span>
              </span>
            </div>
          </Html>
        </>
      )}
    </group>
  );
}
