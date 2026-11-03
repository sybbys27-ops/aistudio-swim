import { useState, useRef, useEffect } from "react";
import { ArmPhase, SimulationParams, SimulationState, SimulationMetrics } from "../types";

export interface MetricPoint {
  time: number;
  thrust: number;
  drag: number;
  speed: number;
}

const MIN_KICK_SPEED = 0.3;
const SWIMMER_MASS = 80;

export function useSimulation() {
  const [params, setParams] = useState<SimulationParams>({
    rollingAngle: 50,
    rollingTime: 3.0,
    strokeInterval: 3.5,
    glideHold: 1.0,
    bodyPitch: -1,
  });

  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const [state, setState] = useState<SimulationState>(SimulationState.Stopped);
  const [time, setTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [roll, setRoll] = useState(0);
  const [energy, setEnergy] = useState(100);
  const [yOffset, setYOffset] = useState(0);
  const [finishReason, setFinishReason] = useState<"complete" | "fail" | null>(null);
  const [metrics, setMetrics] = useState<SimulationMetrics>({
    thrust: 0,
    drag: 0,
    efficiency: 0,
    strokeRate: 0,
  });
  const [history, setHistory] = useState<MetricPoint[]>([]);

  const [rightArmPhase, setRightArmPhase] = useState<ArmPhase>(ArmPhase.ExtendedForward);
  const [leftArmPhase, setLeftArmPhase] = useState<ArmPhase>(ArmPhase.ExtendedForward);
  const [rightArmTime, setRightArmTime] = useState(0);
  const [leftArmTime, setLeftArmTime] = useState(0);
  const [activeArm, setActiveArm] = useState<"Right" | "Left" | "Both" | "None">("None");

  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const historyRef = useRef<MetricPoint[]>([]);

  const simData = useRef({
    state: SimulationState.Stopped,
    time: 0,
    strokeTimelineTime: 0,
    initialRollElapsed: 0,
    distance: 0,
    speed: 0,
    roll: 0,
    energy: 100,
    yOffset: 0,
    rightArmTime: 0,
    leftArmTime: 0,
    rightArmPhase: ArmPhase.ExtendedForward,
    leftArmPhase: ArmPhase.ExtendedForward,
    strokeCount: 0,
    thrust: 0,
    drag: 0,
  });

  const getStrokeTime = (p: SimulationParams) => p.rollingTime + p.glideHold;

  const getStrokeEnergyCost = (p: SimulationParams) => {
    const strokeTime = getStrokeTime(p);
    let cost = 4;

    if (p.rollingAngle <= 30) cost += 0.5;
    if (p.rollingAngle >= 80) cost += 0.5;
    if (strokeTime <= 1.5) cost += 0.5;

    const absPitch = Math.abs(p.bodyPitch);
    if (absPitch >= 7) cost += 1.0;
    else if (absPitch >= 4) cost += 0.5;

    return cost;
  };

  const isGlidePhase = (timelineTime: number, p: SimulationParams) => {
    if (p.glideHold <= 0) return false;
    const strokeTime = getStrokeTime(p);
    if (strokeTime <= 0) return false;

    const localTime = timelineTime % strokeTime;
    return localTime >= p.rollingTime;
  };

  const updateArmPhase = (armTime: number, strokeTime: number): ArmPhase => {
    if (armTime < 0 || armTime >= strokeTime) return ArmPhase.ExtendedForward;

    const progress = armTime / Math.max(0.001, strokeTime);
    if (progress < 0.125) return ArmPhase.Catch;
    if (progress < 0.25) return ArmPhase.Pull;
    if (progress < 0.5) return ArmPhase.Push;
    return ArmPhase.Recovery;
  };

  const getArmTiming = (
    timelineTime: number,
    arm: "Right" | "Left",
    p: SimulationParams
  ) => {
    const strokeTime = getStrokeTime(p);
    const interval = Math.max(0.001, Math.min(p.strokeInterval, strokeTime));
    const sameArmPeriod = interval * 2;

    if (arm === "Left" && timelineTime < interval) {
      return { time: strokeTime, phase: ArmPhase.ExtendedForward };
    }

    const firstStart = arm === "Right" ? 0 : interval;
    const cycles = Math.floor(Math.max(0, timelineTime - firstStart) / sameArmPeriod);
    const startTime = firstStart + cycles * sameArmPeriod;
    const elapsed = timelineTime - startTime;

    if (elapsed < 0 || elapsed >= strokeTime) {
      return { time: strokeTime, phase: ArmPhase.ExtendedForward };
    }

    return {
      time: elapsed,
      phase: updateArmPhase(elapsed, strokeTime),
    };
  };

  const countStrokeStarts = (timelineTime: number, p: SimulationParams) => {
    const strokeTime = getStrokeTime(p);
    const interval = Math.max(0.001, Math.min(p.strokeInterval, strokeTime));
    const sameArmPeriod = interval * 2;

    const rightStarts = Math.floor(Math.max(0, timelineTime) / sameArmPeriod) + 1;
    const leftStarts =
      timelineTime >= interval
        ? Math.floor((timelineTime - interval) / sameArmPeriod) + 1
        : 0;

    return rightStarts + leftStarts;
  };

  const calculateRoll = (timelineTime: number, p: SimulationParams) => {
    const strokeTime = getStrokeTime(p);
    if (p.rollingAngle === 0 || strokeTime <= 0) return 0;

    const segment = Math.floor(timelineTime / strokeTime);
    const localTime = timelineTime - segment * strokeTime;
    const startAngle = segment % 2 === 0 ? -p.rollingAngle : p.rollingAngle;
    const endAngle = -startAngle;

    if (localTime >= p.rollingTime) {
      return endAngle;
    }

    const progress = localTime / Math.max(0.001, p.rollingTime);
    return startAngle + (endAngle - startAngle) * progress;
  };

  const getRollingThrustEfficiency = (rollingAngle: number) => {
    const angle = Math.abs(rollingAngle);

    if (angle <= 20) return 0.75 + (angle / 20) * 0.10;
    if (angle <= 30) return 0.85 + ((angle - 20) / 10) * 0.10;
    if (angle <= 40) return 0.95 + ((angle - 30) / 10) * 0.05;
    if (angle <= 60) return 1.0;
    if (angle <= 70) return 1.0 - ((angle - 60) / 10) * 0.05;
    if (angle <= 80) return 0.95 - ((angle - 70) / 10) * 0.10;
    return Math.max(0.75, 0.85 - ((angle - 80) / 10) * 0.10);
  };

  const getStrokeTimeThrustEfficiency = (strokeTime: number) => {
    if (strokeTime >= 2.5) return 1.0;
    if (strokeTime >= 2.0) return 0.95 + ((strokeTime - 2.0) / 0.5) * 0.05;
    if (strokeTime >= 1.5) return 0.90 + ((strokeTime - 1.5) / 0.5) * 0.05;
    if (strokeTime >= 1.0) return 0.825 + ((strokeTime - 1.0) / 0.5) * 0.075;
    return 0.825;
  };

  const calculateThrust = (
    phase: ArmPhase,
    armTime: number,
    strokeTime: number,
    rollingAngle: number
  ) => {
    if (strokeTime <= 0) return 0;

    const progress = armTime / strokeTime;
    let baseThrust = 0;

    if (phase === ArmPhase.Pull) {
      const phaseProgress = (progress - 0.125) / 0.125;
      baseThrust = 300 + Math.sin(phaseProgress * Math.PI) * 100;
    } else if (phase === ArmPhase.Push) {
      const phaseProgress = (progress - 0.25) / 0.25;
      baseThrust = 400 + Math.sin(phaseProgress * Math.PI) * 150;
    }

    const rollingEfficiency = getRollingThrustEfficiency(rollingAngle);
    const strokeTimeEfficiency = getStrokeTimeThrustEfficiency(strokeTime);

    return baseThrust * rollingEfficiency * strokeTimeEfficiency * 0.5;
  };

  const calculateDrag = (currentSpeed: number, pitch: number) => {
    const baseDrag = 50 * currentSpeed * currentSpeed;
    const pitchPenalty = Math.abs(pitch) * 20 * currentSpeed;
    return baseDrag + pitchPenalty;
  };

  const syncReactState = () => {
    const d = simData.current;

    setTime(d.time);
    setDistance(d.distance);
    setSpeed(d.speed);
    setRoll(d.roll);
    setEnergy(d.energy);
    setYOffset(d.yOffset);
    setRightArmPhase(d.rightArmPhase);
    setLeftArmPhase(d.leftArmPhase);
    setRightArmTime(d.rightArmTime);
    setLeftArmTime(d.leftArmTime);

    const rightActive =
      d.rightArmPhase !== ArmPhase.Idle &&
      d.rightArmPhase !== ArmPhase.ExtendedForward;
    const leftActive =
      d.leftArmPhase !== ArmPhase.Idle &&
      d.leftArmPhase !== ArmPhase.ExtendedForward;

    if (rightActive && leftActive) setActiveArm("Both");
    else if (rightActive) setActiveArm("Right");
    else if (leftActive) setActiveArm("Left");
    else setActiveArm("None");

    setMetrics({
      thrust: d.thrust,
      drag: d.drag,
      efficiency: d.thrust > 0 ? (d.speed / d.thrust) * 1000 : 0,
      strokeRate:
        d.strokeTimelineTime > 0
          ? (d.strokeCount / d.strokeTimelineTime) * 60
          : 0,
    });
  };

  const animate = (t: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = t;
    const dt = Math.min(0.1, (t - lastTimeRef.current) / 1000);
    lastTimeRef.current = t;

    const d = simData.current;
    const p = paramsRef.current;
    const strokeTime = getStrokeTime(p);

    if (d.state === SimulationState.Sinking) {
      d.time += dt;
      d.yOffset -= dt * 0.5;
      d.speed *= 0.95;
      d.roll *= 0.95;
      d.thrust = 0;
      d.drag = calculateDrag(d.speed, p.bodyPitch);

      if (d.yOffset <= -2) {
        d.yOffset = -2;
        d.state = SimulationState.Finished;
        setFinishReason("fail");
        setState(SimulationState.Finished);
        syncReactState();
        return;
      }
    } else {
      d.time += dt;

      if (d.state === SimulationState.InitialRolling) {
        const initialRollDuration =
          p.rollingAngle === 0 ? 0 : Math.max(0.001, p.rollingTime / 2);

        d.initialRollElapsed += dt;
        const progress =
          initialRollDuration === 0
            ? 1
            : Math.min(1, d.initialRollElapsed / initialRollDuration);

        // Start flat, then lower the anatomical right shoulder to -Rolling Angle.
        d.roll = -p.rollingAngle * progress;
        d.rightArmPhase = ArmPhase.ExtendedForward;
        d.leftArmPhase = ArmPhase.ExtendedForward;
        d.rightArmTime = strokeTime;
        d.leftArmTime = strokeTime;

        if (progress >= 1) {
          // First right-arm stroke starts immediately at -Rolling Angle.
          // No initial glide is inserted here.
          d.state = SimulationState.Running;
          d.strokeTimelineTime = 0;
          d.strokeCount = 1;
          d.energy = Math.max(0, d.energy - getStrokeEnergyCost(p));
          d.rightArmTime = 0;
          d.rightArmPhase = ArmPhase.Catch;
          d.leftArmTime = strokeTime;
          d.leftArmPhase = ArmPhase.ExtendedForward;
          setState(SimulationState.Running);
        }
      } else if (d.state === SimulationState.Running) {
        d.strokeTimelineTime += dt;

        d.roll = calculateRoll(d.strokeTimelineTime, p);

        const rightTiming = getArmTiming(d.strokeTimelineTime, "Right", p);
        const leftTiming = getArmTiming(d.strokeTimelineTime, "Left", p);
        d.rightArmTime = rightTiming.time;
        d.rightArmPhase = rightTiming.phase;
        d.leftArmTime = leftTiming.time;
        d.leftArmPhase = leftTiming.phase;

        const newStrokeCount = countStrokeStarts(d.strokeTimelineTime, p);
        if (newStrokeCount > d.strokeCount) {
          d.energy = Math.max(
            0,
            d.energy -
              (newStrokeCount - d.strokeCount) * getStrokeEnergyCost(p)
          );
          d.strokeCount = newStrokeCount;
        }

        // Recover 1 energy point per second only while the body is
        // holding the completed roll angle during Glide Duration.
        if (isGlidePhase(d.strokeTimelineTime, p)) {
          d.energy = Math.min(100, d.energy + dt);
        }
      }

      const rightThrust = calculateThrust(
        d.rightArmPhase,
        d.rightArmTime,
        strokeTime,
        p.rollingAngle
      );
      const leftThrust = calculateThrust(
        d.leftArmPhase,
        d.leftArmTime,
        strokeTime,
        p.rollingAngle
      );

      d.thrust = rightThrust + leftThrust;
      d.drag = calculateDrag(d.speed, p.bodyPitch);

      const effectiveDrag = d.thrust > 0 ? d.drag : d.drag * 0.5;
      const acceleration = (d.thrust - effectiveDrag) / SWIMMER_MASS;
      d.speed = Math.max(MIN_KICK_SPEED, d.speed + acceleration * dt);
      d.distance += d.speed * dt;

      if (
        d.energy <= 0 &&
        d.state !== SimulationState.Finished
      ) {
        d.energy = 0;
        d.state = SimulationState.Sinking;
        d.thrust = 0;
        d.rightArmPhase = ArmPhase.Idle;
        d.leftArmPhase = ArmPhase.Idle;
        setState(SimulationState.Sinking);
      }

      if (d.distance >= 49.5) {
        d.distance = 49.5;
        d.speed = 0;
        d.thrust = 0;
        d.roll = 0;
        d.state = SimulationState.Finished;
        d.rightArmPhase = ArmPhase.ExtendedForward;
        d.leftArmPhase = ArmPhase.ExtendedForward;
        d.rightArmTime = strokeTime;
        d.leftArmTime = strokeTime;
        setFinishReason("complete");
        setState(SimulationState.Finished);
      }
    }

    if (Math.floor(d.time * 10) > Math.floor((d.time - dt) * 10)) {
      const point = {
        time: d.time,
        thrust: d.thrust,
        drag: d.drag,
        speed: d.speed,
      };
      historyRef.current = [...historyRef.current.slice(-100), point];
      setHistory(historyRef.current);
    }

    syncReactState();

    if (d.state !== SimulationState.Finished && d.state !== SimulationState.Stopped) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  const start = () => {
    if (
      simData.current.state !== SimulationState.Stopped &&
      simData.current.state !== SimulationState.Finished
    ) {
      return;
    }

    const p = paramsRef.current;
    const strokeTime = getStrokeTime(p);

    simData.current = {
      state: SimulationState.InitialRolling,
      time: 0,
      strokeTimelineTime: 0,
      initialRollElapsed: 0,
      distance: 0,
      speed: MIN_KICK_SPEED,
      roll: 0,
      energy: 100,
      yOffset: 0,
      rightArmTime: strokeTime,
      leftArmTime: strokeTime,
      rightArmPhase: ArmPhase.ExtendedForward,
      leftArmPhase: ArmPhase.ExtendedForward,
      strokeCount: 0,
      thrust: 0,
      drag: 0,
    };

    historyRef.current = [];
    setHistory([]);
    setState(SimulationState.InitialRolling);
    setSpeed(MIN_KICK_SPEED);
    setDistance(0);
    setRoll(0);
    setEnergy(100);
    setFinishReason(null);
    setActiveArm("None");

    lastTimeRef.current = 0;
    requestRef.current = requestAnimationFrame(animate);
  };

  const stop = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    simData.current.state = SimulationState.Stopped;
    setFinishReason(null);
    setState(SimulationState.Stopped);
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return {
    params,
    setParams,
    strokeTime: params.rollingTime + params.glideHold,
    state,
    time,
    distance,
    speed,
    roll,
    energy,
    yOffset,
    finishReason,
    metrics,
    history,
    rightArmPhase,
    leftArmPhase,
    rightArmTime,
    leftArmTime,
    activeArm,
    start,
    stop,
    strokeCount: simData.current.strokeCount,
  };
}
