import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Vector3 } from "three";
import { ArmPhase, SimulationState } from "../types";

interface SwimmerModelProps {
  rollAngle: number;
  pitchAngle: number;
  leftArmPhase: ArmPhase;
  rightArmPhase: ArmPhase;
  leftArmTime: number;
  rightArmTime: number;
  distance: number;
  yOffset: number;
  state: SimulationState;
}

export function SwimmerModel({
  rollAngle,
  pitchAngle,
  leftArmPhase,
  rightArmPhase,
  leftArmTime,
  rightArmTime,
  distance,
  yOffset,
  state: simState,
}: SwimmerModelProps) {
  const groupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);

  const isRunning = simState !== SimulationState.Stopped && simState !== SimulationState.Finished;

  const getArmRotation = (phase: ArmPhase, time: number) => {
    if (phase === ArmPhase.Idle || phase === ArmPhase.ExtendedForward) return 0;
    if (phase === ArmPhase.Catch) return (time / 0.5) * 0.5;
    if (phase === ArmPhase.Pull) return 0.5 + ((time - 0.5) / 0.5) * 1.0;
    if (phase === ArmPhase.Push) return 1.5 + ((time - 1.0) / 1.0) * (Math.PI - 1.5);
    if (phase === ArmPhase.Recovery) return Math.PI + ((time - 2.0) / 2.0) * Math.PI;
    return 0;
  };

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.z = (rollAngle * Math.PI) / 180;
      groupRef.current.rotation.x = (pitchAngle * Math.PI) / 180;
      // Move forward based on distance
      groupRef.current.position.z = distance;
      groupRef.current.position.y = yOffset;
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = getArmRotation(leftArmPhase, leftArmTime);
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = getArmRotation(rightArmPhase, rightArmTime);
    }

    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = isRunning ? Math.sin(t * 12) * 0.25 : 0;
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = isRunning ? Math.sin(t * 12 + Math.PI) * 0.25 : 0;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Torso - Tapered for better look */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.2, 0.8]} />
        <meshStandardMaterial color="#00aaff" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Head with Swim Cap */}
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

      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.22, 0, 0.35]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.04, 0.03, 0.45, 8]} />
          <meshStandardMaterial color="#ffd6a5" />
        </mesh>
        {/* Hand */}
        <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.08, 0.01, 0.12]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.22, 0, 0.35]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.04, 0.03, 0.45, 8]} />
          <meshStandardMaterial color="#ffd6a5" />
        </mesh>
        {/* Hand */}
        <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.08, 0.01, 0.12]} />
          <meshStandardMaterial color="#0000ff" />
        </mesh>
      </group>

      {/* Legs */}
      <group ref={leftLegRef} position={[-0.12, 0, -0.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.06, 0.04, 0.65, 8]} />
          <meshStandardMaterial color="#ffd6a5" />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.12, 0, -0.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.06, 0.04, 0.65, 8]} />
          <meshStandardMaterial color="#ffd6a5" />
        </mesh>
      </group>

      {/* Trajectory visualization - only when running */}
      {isRunning && (
        <mesh position={[0, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.05, 50]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
}
