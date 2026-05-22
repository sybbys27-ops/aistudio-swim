export enum ArmPhase {
  Idle = "Idle",
  Catch = "Catch",
  Pull = "Pull",
  Push = "Push",
  Recovery = "Recovery",
  ExtendedForward = "ExtendedForward",
}

export enum SimulationState {
  Stopped = "Stopped",
  InitialRolling = "Initial Rolling",
  GlideHold = "Glide Hold",
  Running = "Running",
  Finished = "Finished",
  Sinking = "Sinking",
}

export interface SimulationParams {
  rollingAngle: number;
  strokeInterval: number;
  glideHold: number;
  bodyPitch: number;
}

export interface SimulationMetrics {
  thrust: number;
  drag: number;
  efficiency: number;
  strokeRate: number;
}

export interface SimulationResults {
  totalTime: number;
  finalSpeed: number;
  averageSpeed: number;
  finalEnergy: number;
  strokeCount: number;
  bestEfficiency: number;
}

export type CameraView = "SIDE" | "TOP" | "FOLLOW" | "FRONT";
