import { useState, useRef, useEffect } from "react";
import { ArmPhase, SimulationMode, SimulationParams, SimulationState, SimulationMetrics } from "../types";

export interface MetricPoint {
  time: number;
  thrust: number;
  drag: number;
  speed: number;
}

const MIN_KICK_SPEED = 0.3;
const SWIMMER_MASS = 80;
const ENDLESS_STROKE_COST = 3.75;
const TURN_ENERGY_COST = 4;
const TURN_DURATION = 2.5;
const UNDERWATER_DISTANCE = 5;
const UNDERWATER_START_DEPTH = -1;

export function useSimulation() {
  const [params, setParams] = useState<SimulationParams>({
    rollingAngle: 50,
    rollingTime: 3.0,
    strokeInterval: 3.5,
    glideHold: 1.0,
    bodyPitch: -1,
  });
  const [mode, setMode] = useState<SimulationMode>("SPRINT50");

  const paramsRef = useRef(params);
  const modeRef = useRef(mode);
  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const [state, setState] = useState<SimulationState>(SimulationState.Stopped);
  const [time, setTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [roll, setRoll] = useState(0);
  const [heading, setHeading] = useState(0);
  const [turnPitch, setTurnPitch] = useState(0);
  const [energy, setEnergy] = useState(100);
  const [yOffset, setYOffset] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [finishReason, setFinishReason] = useState<"complete" | "fail" | "endless" | null>(null);
  const [metrics, setMetrics] = useState<SimulationMetrics>({ thrust: 0, drag: 0, efficiency: 0, strokeRate: 0 });
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
    totalDistance: 0,
    speed: 0,
    roll: 0,
    heading: 0,
    turnPitch: 0,
    energy: 100,
    yOffset: 0,
    direction: 1 as 1 | -1,
    turnElapsed: 0,
    turnStartRoll: 0,
    turnStartPitch: 0,
    underwaterDistance: 0,
    pendingExhaustion: false,
    leadArm: "Right" as "Right" | "Left",
    rightArmTime: 0,
    leftArmTime: 0,
    rightArmPhase: ArmPhase.ExtendedForward,
    leftArmPhase: ArmPhase.ExtendedForward,
    strokeCount: 0,
    turnCount: 0,
    thrust: 0,
    drag: 0,
  });

  const getStrokeTime = (p: SimulationParams) => p.rollingTime + p.glideHold;

  const getStrokeEnergyCost = (p: SimulationParams, currentMode: SimulationMode) => {
    const strokeTime = getStrokeTime(p);
    let cost = currentMode === "ENDLESS" ? ENDLESS_STROKE_COST : 4;
    if (p.rollingAngle <= 30) cost += 0.5;
    if (p.rollingAngle >= 80) cost += 0.5;
    if (strokeTime <= 1.5) cost += 0.5;
    const absPitch = Math.abs(p.bodyPitch);
    if (absPitch >= 7) cost += 1.0;
    else if (absPitch >= 4) cost += 0.5;
    return cost;
  };

  const getEndlessGlideRecovery = (glideHold: number) => {
    if (glideHold <= 0) return 0;
    if (glideHold <= 1.5) return glideHold;
    return Math.max(0, 3 - glideHold);
  };

  const getGlideRecoveryRate = (p: SimulationParams, currentMode: SimulationMode) => {
    if (p.glideHold <= 0) return 0;
    if (currentMode === "SPRINT50") return 1;
    return getEndlessGlideRecovery(p.glideHold) / p.glideHold;
  };

  const isComfortRhythm = (p: SimulationParams) => {
    const strokeTime = getStrokeTime(p);
    return strokeTime >= 3 && strokeTime <= 4 &&
      p.strokeInterval >= strokeTime - 0.5 &&
      p.strokeInterval <= strokeTime;
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
    p: SimulationParams,
    leadArm: "Right" | "Left"
  ) => {
    const strokeTime = getStrokeTime(p);
    const interval = Math.max(0.001, Math.min(p.strokeInterval, strokeTime));
    const sameArmPeriod = interval * 2;
    const isLead = arm === leadArm;
    if (!isLead && timelineTime < interval) {
      return { time: strokeTime, phase: ArmPhase.ExtendedForward };
    }
    const firstStart = isLead ? 0 : interval;
    const cycles = Math.floor(Math.max(0, timelineTime - firstStart) / sameArmPeriod);
    const startTime = firstStart + cycles * sameArmPeriod;
    const elapsed = timelineTime - startTime;
    if (elapsed < 0 || elapsed >= strokeTime) {
      return { time: strokeTime, phase: ArmPhase.ExtendedForward };
    }
    return { time: elapsed, phase: updateArmPhase(elapsed, strokeTime) };
  };

  const countStrokeStarts = (timelineTime: number, p: SimulationParams) => {
    const strokeTime = getStrokeTime(p);
    const interval = Math.max(0.001, Math.min(p.strokeInterval, strokeTime));
    const sameArmPeriod = interval * 2;
    const leadStarts = Math.floor(Math.max(0, timelineTime) / sameArmPeriod) + 1;
    const followStarts = timelineTime >= interval
      ? Math.floor((timelineTime - interval) / sameArmPeriod) + 1
      : 0;
    return leadStarts + followStarts;
  };

  const calculateRoll = (timelineTime: number, p: SimulationParams, leadArm: "Right" | "Left") => {
    const strokeTime = getStrokeTime(p);
    if (p.rollingAngle === 0 || strokeTime <= 0) return 0;
    const segment = Math.floor(timelineTime / strokeTime);
    const localTime = timelineTime - segment * strokeTime;
    const firstAngle = leadArm === "Right" ? -p.rollingAngle : p.rollingAngle;
    const startAngle = segment % 2 === 0 ? firstAngle : -firstAngle;
    const endAngle = -startAngle;
    if (localTime >= p.rollingTime) return endAngle;
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

  const calculateThrust = (phase: ArmPhase, armTime: number, strokeTime: number, rollingAngle: number) => {
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
    return baseThrust *
      getRollingThrustEfficiency(rollingAngle) *
      getStrokeTimeThrustEfficiency(strokeTime) * 0.5;
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
    setTotalDistance(d.totalDistance);
    setSpeed(d.speed);
    setRoll(d.roll);
    setHeading(d.heading);
    setTurnPitch(d.turnPitch);
    setEnergy(d.energy);
    setYOffset(d.yOffset);
    setTurnCount(d.turnCount);
    setRightArmPhase(d.rightArmPhase);
    setLeftArmPhase(d.leftArmPhase);
    setRightArmTime(d.rightArmTime);
    setLeftArmTime(d.leftArmTime);

    const rightActive = d.rightArmPhase !== ArmPhase.Idle && d.rightArmPhase !== ArmPhase.ExtendedForward;
    const leftActive = d.leftArmPhase !== ArmPhase.Idle && d.leftArmPhase !== ArmPhase.ExtendedForward;
    if (rightActive && leftActive) setActiveArm("Both");
    else if (rightActive) setActiveArm("Right");
    else if (leftActive) setActiveArm("Left");
    else setActiveArm("None");

    setMetrics({
      thrust: d.thrust,
      drag: d.drag,
      efficiency: d.thrust > 0 ? (d.speed / d.thrust) * 1000 : 0,
      strokeRate: d.strokeTimelineTime > 0 ? (d.strokeCount / d.strokeTimelineTime) * 60 : 0,
    });
  };

  const enterSinking = () => {
    const d = simData.current;
    d.energy = 0;
    d.state = SimulationState.Sinking;
    d.thrust = 0;
    d.rightArmPhase = ArmPhase.Idle;
    d.leftArmPhase = ArmPhase.Idle;
    setState(SimulationState.Sinking);
  };

  const beginTurn = () => {
    const d = simData.current;
    d.state = SimulationState.Turning;
    d.turnElapsed = 0;
    d.turnStartRoll = d.roll;
    d.turnStartPitch = 0;
    d.speed = 0;
    d.thrust = 0;
    d.rightArmPhase = ArmPhase.ExtendedForward;
    d.leftArmPhase = ArmPhase.ExtendedForward;
    d.energy = Math.max(0, d.energy - TURN_ENERGY_COST);
    d.pendingExhaustion = d.energy <= 0;
    d.turnCount += 1;
    setState(SimulationState.Turning);
  };

  const animate = (t: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = t;
    const dt = Math.min(0.1, (t - lastTimeRef.current) / 1000);
    lastTimeRef.current = t;

    const d = simData.current;
    const p = paramsRef.current;
    const currentMode = modeRef.current;
    const strokeTime = getStrokeTime(p);

    if (d.state === SimulationState.Sinking) {
      d.time += dt;
      d.yOffset -= dt * 0.5;
      d.speed *= 0.95;
      d.roll *= 0.95;
      d.turnPitch *= 0.9;
      d.thrust = 0;
      d.drag = calculateDrag(d.speed, p.bodyPitch);
      if (d.yOffset <= -2) {
        d.yOffset = -2;
        d.state = SimulationState.Finished;
        setFinishReason(currentMode === "ENDLESS" ? "endless" : "fail");
        setState(SimulationState.Finished);
        syncReactState();
        return;
      }
    } else {
      d.time += dt;

      if (d.state === SimulationState.InitialRolling) {
        const initialRollDuration = p.rollingAngle === 0 ? 0 : Math.max(0.001, p.rollingTime / 2);
        d.initialRollElapsed += dt;
        const progress = initialRollDuration === 0 ? 1 : Math.min(1, d.initialRollElapsed / initialRollDuration);
        d.roll = -p.rollingAngle * progress;
        d.rightArmPhase = ArmPhase.ExtendedForward;
        d.leftArmPhase = ArmPhase.ExtendedForward;
        d.rightArmTime = strokeTime;
        d.leftArmTime = strokeTime;
        if (progress >= 1) {
          d.state = SimulationState.Running;
          d.leadArm = "Right";
          d.strokeTimelineTime = 0;
          d.strokeCount = 1;
          d.energy = Math.max(0, d.energy - getStrokeEnergyCost(p, currentMode));
          d.rightArmTime = 0;
          d.rightArmPhase = ArmPhase.Catch;
          d.leftArmTime = strokeTime;
          d.leftArmPhase = ArmPhase.ExtendedForward;
          setState(SimulationState.Running);
        }
      } else if (d.state === SimulationState.Running) {
        d.strokeTimelineTime += dt;
        d.roll = calculateRoll(d.strokeTimelineTime, p, d.leadArm);

        const rightTiming = getArmTiming(d.strokeTimelineTime, "Right", p, d.leadArm);
        const leftTiming = getArmTiming(d.strokeTimelineTime, "Left", p, d.leadArm);
        d.rightArmTime = rightTiming.time;
        d.rightArmPhase = rightTiming.phase;
        d.leftArmTime = leftTiming.time;
        d.leftArmPhase = leftTiming.phase;

        const newStrokeCount = countStrokeStarts(d.strokeTimelineTime, p);
        if (newStrokeCount > d.strokeCount) {
          const starts = newStrokeCount - d.strokeCount;
          d.energy = Math.max(0, d.energy - starts * getStrokeEnergyCost(p, currentMode));

          if (currentMode === "ENDLESS" && isComfortRhythm(p)) {
            for (let count = d.strokeCount + 1; count <= newStrokeCount; count += 1) {
              if (count % 2 === 0) d.energy = Math.min(100, d.energy + 1);
            }
          }
          d.strokeCount = newStrokeCount;
        }

        if (isGlidePhase(d.strokeTimelineTime, p)) {
          d.energy = Math.min(100, d.energy + dt * getGlideRecoveryRate(p, currentMode));
        }

        const rightThrust = calculateThrust(d.rightArmPhase, d.rightArmTime, strokeTime, p.rollingAngle);
        const leftThrust = calculateThrust(d.leftArmPhase, d.leftArmTime, strokeTime, p.rollingAngle);
        d.thrust = rightThrust + leftThrust;
        d.drag = calculateDrag(d.speed, p.bodyPitch);
        const effectiveDrag = d.thrust > 0 ? d.drag : d.drag * 0.5;
        const acceleration = (d.thrust - effectiveDrag) / SWIMMER_MASS;
        d.speed = Math.max(MIN_KICK_SPEED, d.speed + acceleration * dt);

        const move = d.speed * dt;
        d.distance += move * d.direction;
        d.totalDistance += move;

        if (d.energy <= 0) {
          enterSinking();
        } else if (currentMode === "ENDLESS") {
          const hitWall = (d.direction === 1 && d.distance >= 49.5) ||
            (d.direction === -1 && d.distance <= 0.5);
          if (hitWall) {
            d.distance = d.direction === 1 ? 49.5 : 0.5;
            beginTurn();
          }
        } else if (d.distance >= 49.5) {
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
      } else if (d.state === SimulationState.Turning) {
        d.turnElapsed += dt;
        const progress = Math.min(1, d.turnElapsed / TURN_DURATION);

        // Step 1: at the wall, roll to +75° (right shoulder rises).
        if (progress < 0.2) {
          const p1 = progress / 0.2;
          d.roll = d.turnStartRoll + (75 - d.turnStartRoll) * p1;
          d.turnPitch = 0;
          d.yOffset = 0;
        } else {
          // Step 2: keep moving backward through a full 180° flip.
          // At the same time, continue the body roll from +75° to +180°.
          // This restores the swimmer to a prone freestyle orientation after the flip
          // instead of leaving the body inverted in a backstroke-like posture.
          const p2 = (progress - 0.2) / 0.8;
          // Use the opposite pitch sign at the far wall so the head always
          // travels over the water surface during the backward turn.
          const flipDirection = d.direction === 1 ? -1 : 1;
          d.turnPitch = flipDirection * 180 * p2;
          d.roll = 75 + 105 * p2;
          d.yOffset = UNDERWATER_START_DEPTH * p2;
        }

        d.rightArmPhase = ArmPhase.ExtendedForward;
        d.leftArmPhase = ArmPhase.ExtendedForward;
        d.thrust = 0;
        d.drag = 0;

        if (progress >= 1) {
          d.direction = d.direction === 1 ? -1 : 1;
          d.state = SimulationState.UnderwaterGlide;
          d.underwaterDistance = 0;
          d.speed = 1.6;
          d.yOffset = UNDERWATER_START_DEPTH;

          // The completed direction-aware 180° backward flip + +180° body roll
          // is visually equivalent to a clean 180° change of heading while remaining prone.
          // Normalize all temporary turn rotations here so the underwater glide
          // does not suddenly invert into a backstroke posture.
          d.roll = 0;
          d.turnPitch = 0;
          d.heading = d.direction === -1 ? 180 : 0;
          setState(SimulationState.UnderwaterGlide);
        }
      } else if (d.state === SimulationState.UnderwaterGlide) {
        d.speed = Math.max(1.15, d.speed - dt * 0.08);
        const move = d.speed * dt;
        d.distance += move * d.direction;
        d.totalDistance += move;
        d.underwaterDistance += move;

        const progress = Math.min(1, d.underwaterDistance / UNDERWATER_DISTANCE);
        d.roll = 0;
        d.yOffset = UNDERWATER_START_DEPTH * (1 - progress);
        d.thrust = 0;
        d.drag = 0;
        d.rightArmPhase = ArmPhase.ExtendedForward;
        d.leftArmPhase = ArmPhase.ExtendedForward;

        if (progress >= 1) {
          d.roll = 0;
          d.yOffset = 0;
          if (d.pendingExhaustion) {
            d.pendingExhaustion = false;
            enterSinking();
          } else {
            // Restart with the anatomical left arm (blue hand) after each turn.
            d.state = SimulationState.Running;
            d.leadArm = "Left";
            d.strokeTimelineTime = 0;
            d.strokeCount = 1;
            d.energy = Math.max(0, d.energy - getStrokeEnergyCost(p, currentMode));
            d.leftArmTime = 0;
            d.leftArmPhase = ArmPhase.Catch;
            d.rightArmTime = strokeTime;
            d.rightArmPhase = ArmPhase.ExtendedForward;
            setState(SimulationState.Running);
          }
        }
      }
    }

    if (Math.floor(d.time * 10) > Math.floor((d.time - dt) * 10)) {
      const point = { time: d.time, thrust: d.thrust, drag: d.drag, speed: d.speed };
      historyRef.current = [...historyRef.current.slice(-100), point];
      setHistory(historyRef.current);
    }

    syncReactState();
    if (d.state !== SimulationState.Finished && d.state !== SimulationState.Stopped) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  const start = () => {
    if (simData.current.state !== SimulationState.Stopped && simData.current.state !== SimulationState.Finished) return;
    const p = paramsRef.current;
    const strokeTime = getStrokeTime(p);

    simData.current = {
      state: SimulationState.InitialRolling,
      time: 0,
      strokeTimelineTime: 0,
      initialRollElapsed: 0,
      distance: 0,
      totalDistance: 0,
      speed: MIN_KICK_SPEED,
      roll: 0,
      heading: 0,
      turnPitch: 0,
      energy: 100,
      yOffset: 0,
      direction: 1,
      turnElapsed: 0,
      turnStartRoll: 0,
      turnStartPitch: 0,
      underwaterDistance: 0,
      pendingExhaustion: false,
      leadArm: "Right",
      rightArmTime: strokeTime,
      leftArmTime: strokeTime,
      rightArmPhase: ArmPhase.ExtendedForward,
      leftArmPhase: ArmPhase.ExtendedForward,
      strokeCount: 0,
      turnCount: 0,
      thrust: 0,
      drag: 0,
    };

    historyRef.current = [];
    setHistory([]);
    setState(SimulationState.InitialRolling);
    setSpeed(MIN_KICK_SPEED);
    setDistance(0);
    setTotalDistance(0);
    setRoll(0);
    setHeading(0);
    setTurnPitch(0);
    setEnergy(100);
    setYOffset(0);
    setTurnCount(0);
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

  useEffect(() => () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, []);

  return {
    params,
    setParams,
    mode,
    setMode,
    strokeTime: params.rollingTime + params.glideHold,
    state,
    time,
    distance,
    totalDistance,
    lengthDistance: simData.current.direction === 1 ? distance : 50 - distance,
    lengthCount: Math.floor(totalDistance / 50) + 1,
    direction: simData.current.direction,
    heading,
    turnPitch,
    speed,
    roll,
    energy,
    yOffset,
    turnCount,
    finishReason,
    comfortActive: mode === "ENDLESS" && isComfortRhythm(params),
    glideRecovery: mode === "ENDLESS" ? getEndlessGlideRecovery(params.glideHold) : params.glideHold,
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
