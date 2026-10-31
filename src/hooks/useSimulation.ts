import { useState, useCallback, useRef, useEffect } from "react";
import { ArmPhase, SimulationParams, SimulationState, SimulationMetrics } from "../types";

export interface MetricPoint {
  time: number;
  thrust: number;
  drag: number;
  speed: number;
}

export function useSimulation() {
  const [params, setParams] = useState<SimulationParams>({
    rollingAngle: 30,
    strokeInterval: 4.0,
    glideHold: 2.0,
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
  const [metrics, setMetrics] = useState<SimulationMetrics>({ thrust: 0, drag: 0, efficiency: 0, strokeRate: 0 });
  const [history, setHistory] = useState<MetricPoint[]>([]);

  const [rightArmPhase, setRightArmPhase] = useState<ArmPhase>(ArmPhase.Idle);
  const [leftArmPhase, setLeftArmPhase] = useState<ArmPhase>(ArmPhase.Idle);
  const [rightArmTime, setRightArmTime] = useState(0);
  const [leftArmTime, setLeftArmTime] = useState(0);

  const [activeArm, setActiveArm] = useState<"Right" | "Left" | "Both" | "None">("None");
  const [glideHoldRemaining, setGlideHoldRemaining] = useState(0);

  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);
  const historyRef = useRef<MetricPoint[]>([]);
  
  const simData = useRef({
    state: SimulationState.Stopped,
    time: 0,
    distance: 0,
    speed: 0,
    roll: 0,
    energy: 100,
    yOffset: 0,
    rollDirection: 1,
    rightArmTime: 0,
    leftArmTime: 0,
    rightArmPhase: ArmPhase.Idle,
    leftArmPhase: ArmPhase.Idle,
    glideHoldRemaining: 0,
    lastStrokeStartTime: -999,
    nextStrokeArm: "Right" as "Right" | "Left",
    firstStrokeStarted: false,
    strokeCount: 0,
    thrust: 0,
    drag: 0,
  });

  const updateArmPhase = (armTime: number): ArmPhase => {
    if (armTime < 0) return ArmPhase.Idle;
    if (armTime < 0.5) return ArmPhase.Catch;
    if (armTime < 1.0) return ArmPhase.Pull;
    if (armTime < 2.0) return ArmPhase.Push;
    if (armTime < 4.0) return ArmPhase.Recovery;
    return ArmPhase.ExtendedForward;
  };

  const calculateThrust = (phase: ArmPhase, time: number, roll: number) => {
    // Thrust is highest during Pull and Push phases
    // It's also affected by how deep the arm is (roll)
    let baseThrust = 0;
    if (phase === ArmPhase.Pull) {
      const progress = (time - 0.5) / 0.5;
      baseThrust = 300 + Math.sin(progress * Math.PI) * 100;
    } else if (phase === ArmPhase.Push) {
      const progress = (time - 1.0) / 1.0;
      baseThrust = 400 + Math.sin(progress * Math.PI) * 150;
    }

    // Roll factor: deeper arm (negative roll for left, positive for right) gives more thrust
    // But let's simplify: the more tilted the body, the more efficient the pull
    const rollFactor = 1 + (Math.abs(roll) / 90) * 0.5;
    
    // Reduce overall thrust by 50% as requested to slow down speed increase
    return baseThrust * rollFactor * 0.5;
  };

  const calculateDrag = (speed: number, pitch: number) => {
    // Drag = 0.5 * rho * v^2 * Cd * A
    // Simplified: base drag + pitch penalty
    const baseDrag = 50 * speed * speed;
    const pitchPenalty = Math.abs(pitch) * 20 * speed;
    return baseDrag + pitchPenalty;
  };

  const animate = (t: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = t;
    const dt = Math.min(0.1, (t - lastTimeRef.current) / 1000);
    lastTimeRef.current = t;

    const d = simData.current;
    const p = paramsRef.current;
    // Calculate required rolling speed to complete the swing (2 * angle) within the available time (interval - glideHold)
    const rollingSpeed = (2 * p.rollingAngle) / Math.max(0.1, p.strokeInterval - p.glideHold);

    if (d.state === SimulationState.Sinking) {
      d.yOffset -= dt * 0.5; // Sink at 0.5m/s
      d.speed *= 0.95; // Rapidly slow down
      d.roll *= 0.95; // Flatten out
      d.thrust = 0;
      if (d.yOffset < -2) { // Stop sinking at 2m depth
        d.yOffset = -2;
        d.state = SimulationState.Finished;
        setState(SimulationState.Finished);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return;
      }
    }

    if (d.energy <= 0 && d.state !== SimulationState.Finished && d.state !== SimulationState.Sinking) {
      d.energy = 0;
      d.state = SimulationState.Sinking;
      setState(SimulationState.Sinking);
      d.thrust = 0;
      d.rightArmPhase = ArmPhase.Idle;
      d.leftArmPhase = ArmPhase.Idle;
      setActiveArm("None");
      setRightArmPhase(ArmPhase.Idle);
      setLeftArmPhase(ArmPhase.Idle);
    }

    // Update arm times for all active movement states
    if (d.state === SimulationState.InitialRolling || 
        d.state === SimulationState.GlideHold || 
        d.state === SimulationState.Running) {
      d.rightArmTime += dt;
      d.leftArmTime += dt;
      d.rightArmPhase = updateArmPhase(d.rightArmTime);
      d.leftArmPhase = updateArmPhase(d.leftArmTime);
    }

    if (d.state === SimulationState.InitialRolling) {
      d.roll += d.rollDirection * rollingSpeed * dt;
      if (Math.abs(d.roll) >= p.rollingAngle) {
        d.roll = d.rollDirection * p.rollingAngle;
        d.glideHoldRemaining = p.glideHold;
        d.state = SimulationState.GlideHold;
        setState(SimulationState.GlideHold);
      }
    } else if (d.state === SimulationState.GlideHold) {
      d.glideHoldRemaining -= dt;
      d.energy = Math.min(100, d.energy + dt * 1.0);
      
      if (d.glideHoldRemaining <= 0) {
        d.glideHoldRemaining = 0;
        if (!d.firstStrokeStarted) {
          d.firstStrokeStarted = true;
          d.lastStrokeStartTime = d.time;
          d.rightArmTime = 0;
          d.rightArmPhase = ArmPhase.Catch;
          d.leftArmTime = 4.0; 
          d.leftArmPhase = ArmPhase.ExtendedForward;
          d.nextStrokeArm = "Left";
          d.energy = Math.max(0, d.energy - 8);
          d.strokeCount++;
          d.rollDirection = -1; // Start rolling to opposite side when stroke starts
          d.state = SimulationState.Running;
          setState(SimulationState.Running);
        } else {
          // Trigger next stroke
          d.lastStrokeStartTime = d.time;
          d.strokeCount++;
          d.energy = Math.max(0, d.energy - 8);
          d.rollDirection *= -1; // Reverse roll direction for new stroke
          
          if (d.nextStrokeArm === "Right") {
            d.rightArmTime = 0;
            d.rightArmPhase = ArmPhase.Catch;
            d.nextStrokeArm = "Left";
          } else {
            d.leftArmTime = 0;
            d.leftArmPhase = ArmPhase.Catch;
            d.nextStrokeArm = "Right";
          }
          d.state = SimulationState.Running;
          setState(SimulationState.Running);
        }
      }
    } else if (d.state === SimulationState.Running) {
      // Rolling logic: Move towards target angle at calculated speed
      const targetRoll = d.rollDirection * p.rollingAngle;
      const rollDiff = targetRoll - d.roll;
      if (Math.abs(rollDiff) > 0.1) {
        const step = Math.sign(rollDiff) * rollingSpeed * dt;
        if (Math.abs(step) > Math.abs(rollDiff)) {
          d.roll = targetRoll;
        } else {
          d.roll += step;
        }
      } else {
        // Target reached, maintain target angle
        d.roll = targetRoll;
      }

      const timeSinceLastStroke = d.time - d.lastStrokeStartTime;
      if (timeSinceLastStroke >= p.strokeInterval) {
        d.glideHoldRemaining = p.glideHold;
        d.state = SimulationState.GlideHold;
        setState(SimulationState.GlideHold);
      }
    }

    // Physics Calculation
    const leftThrust = calculateThrust(d.rightArmPhase, d.rightArmTime, d.roll);
    const rightThrust = calculateThrust(d.leftArmPhase, d.leftArmTime, d.roll);
    d.thrust = leftThrust + rightThrust;
    d.drag = calculateDrag(d.speed, p.bodyPitch);

    // F = ma -> a = F/m. Assume m = 80kg
    const acceleration = (d.thrust - d.drag) / 80;
    d.speed = Math.max(0, d.speed + acceleration * dt);

    if (d.state !== SimulationState.Stopped && d.state !== SimulationState.Finished) {
      d.time += dt;
      d.distance += d.speed * dt;
      
      if (d.distance >= 49.5) { // Stop slightly before the wall (50m) to avoid head clipping
        d.distance = 49.5;
        d.speed = 0;
        d.thrust = 0;
        d.roll = 0; // Reset roll to neutral position
        d.state = SimulationState.Finished;
        setState(SimulationState.Finished);
        setActiveArm("None");
        setRightArmPhase(ArmPhase.ExtendedForward);
        setLeftArmPhase(ArmPhase.ExtendedForward);
        d.rightArmTime = 4.0;
        d.leftArmTime = 4.0;
        setRightArmTime(4.0);
        setLeftArmTime(4.0);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      } else {
        requestRef.current = requestAnimationFrame(animate);
      }
    }

    // History update (every 0.1s)
    if (Math.floor(d.time * 10) > Math.floor((d.time - dt) * 10)) {
      const point = { time: d.time, thrust: d.thrust, drag: d.drag, speed: d.speed };
      historyRef.current = [...historyRef.current.slice(-100), point];
      setHistory(historyRef.current);
    }

    setTime(d.time);
    setDistance(d.distance);
    setSpeed(d.speed);
    setRoll(d.roll);
    setEnergy(d.energy);
    setYOffset(d.yOffset);
    setMetrics({
      thrust: d.thrust,
      drag: d.drag,
      efficiency: d.thrust > 0 ? (d.speed / d.thrust) * 1000 : 0,
      strokeRate: d.strokeCount > 0 ? (d.strokeCount / d.time) * 60 : 0
    });
    setRightArmPhase(d.rightArmPhase);
    setLeftArmPhase(d.leftArmPhase);
    setRightArmTime(d.rightArmTime);
    setLeftArmTime(d.leftArmTime);
    setGlideHoldRemaining(d.glideHoldRemaining);
    
    const isLeftActive = d.rightArmPhase !== ArmPhase.Idle && d.rightArmPhase !== ArmPhase.ExtendedForward;
    const isRightActive = d.leftArmPhase !== ArmPhase.Idle && d.leftArmPhase !== ArmPhase.ExtendedForward;
    if (isLeftActive && isRightActive) setActiveArm("Both");
    else if (isLeftActive) setActiveArm("Right");
    else if (isRightActive) setActiveArm("Left");
    else setActiveArm("None");
  };

  const start = () => {
    if (simData.current.state !== SimulationState.Stopped && simData.current.state !== SimulationState.Finished) return;
    
    simData.current = {
      state: SimulationState.InitialRolling,
      time: 0,
      distance: 0,
      speed: 0,
      roll: 0,
      energy: 100,
      yOffset: 0,
      rollDirection: 1, // Start by rolling right shoulder up
      rightArmTime: 4.0, // Start with arms extended
      leftArmTime: 4.0,
      rightArmPhase: ArmPhase.ExtendedForward,
      leftArmPhase: ArmPhase.ExtendedForward,
      glideHoldRemaining: 0,
      lastStrokeStartTime: -999,
      nextStrokeArm: "Right",
      firstStrokeStarted: false,
      strokeCount: 0,
      thrust: 0,
      drag: 0,
    };
    
    historyRef.current = [];
    setHistory([]);
    setState(SimulationState.InitialRolling);
    lastTimeRef.current = 0;
    requestRef.current = requestAnimationFrame(animate);
  };

  const stop = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    simData.current.state = SimulationState.Stopped;
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
    state,
    time,
    distance,
    speed,
    roll,
    energy,
    yOffset,
    metrics,
    history,
    rightArmPhase,
    leftArmPhase,
    rightArmTime,
    leftArmTime,
    activeArm,
    glideHoldRemaining,
    start,
    stop,
    strokeCount: simData.current.strokeCount,
  };
}
