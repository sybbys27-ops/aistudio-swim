import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei/core/PerspectiveCamera";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { Sky } from "@react-three/drei/core/Sky";
import { useSimulation } from "./hooks/useSimulation";
import { ControlPanel } from "./components/ControlPanel";
import { ThrustChart } from "./components/ThrustChart";
import { SpeedChart } from "./components/SpeedChart";
import { SwimmerModel } from "./components/SwimmerModel";
import { Pool } from "./components/Pool";
import { SimulationState, CameraView } from "./types";
import { useState, useMemo } from "react";
import { Vector3 } from "three";
import { Play, RotateCcw, Camera, Activity, Settings, Info, ChevronRight, ChevronLeft } from "lucide-react";

function SwimmerAnnotationTracker({
  distance,
  onUpdate,
}: {
  distance: number;
  onUpdate: (position: { x: number; y: number }) => void;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);

  useFrame(() => {
    // Swimmer moves along +Z. Legs trail toward -Z, so place the label
    // 1.15m behind the swimmer's body center.
    point.set(0, 0.55, distance - 1.15);
    point.project(camera);

    onUpdate({
      x: (point.x * 0.5 + 0.5) * size.width,
      y: (-point.y * 0.5 + 0.5) * size.height,
    });
  });

  return null;
}

export default function App() {
  const sim = useSimulation();
  const [cameraView, setCameraView] = useState<CameraView>("FOLLOW");
  const [showControls, setShowControls] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [annotationPos, setAnnotationPos] = useState({ x: 0, y: 0 });

  const isRunning = sim.state !== SimulationState.Stopped && sim.state !== SimulationState.Finished;

  const cameraPosition = useMemo(() => {
    switch (cameraView) {
      case "TOP": return [0, 20, 25] as [number, number, number];
      case "FOLLOW": return [3, 2, sim.distance + 5] as [number, number, number];
      case "FRONT": return [0, 1, sim.distance + 3] as [number, number, number];
      default: return [15, 5, 25] as [number, number, number];
    }
  }, [cameraView, sim.distance]);

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] text-white overflow-hidden font-sans selection:bg-blue-500/30">
      {/* 3D Simulation Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows gl={{ antialias: true }}>
          <PerspectiveCamera makeDefault position={cameraPosition} fov={45} />
          <OrbitControls 
            target={[0, 0, cameraView === "FOLLOW" || cameraView === "FRONT" ? sim.distance : 25]} 
            enableDamping 
            dampingFactor={0.05}
          />
          
          <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
          <ambientLight intensity={0.8} />
          <pointLight position={[10, 10, 10]} intensity={0.5} castShadow />
          <spotLight position={[0, 15, 25]} angle={0.4} penumbra={1} intensity={1} castShadow />
          

                    <SwimmerModel
            rollAngle={sim.roll}
            pitchAngle={sim.params.bodyPitch}
            strokeTime={sim.strokeTime}
            rightArmPhase={sim.rightArmPhase}
            leftArmPhase={sim.leftArmPhase}
            rightArmTime={sim.rightArmTime}
            leftArmTime={sim.leftArmTime}
            distance={sim.distance}
            yOffset={sim.yOffset}
            state={sim.state}
          />
          <SwimmerAnnotationTracker
            distance={sim.distance}
            onUpdate={setAnnotationPos}
          />
          <Pool />
        </Canvas>
      </div>

      {/* Glass Morphism UI Overlays */}
      
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md border-b border-white/5 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black italic serif uppercase tracking-tighter leading-none">AeroSwim Pro</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Advanced Fluid Dynamics Simulator</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
            {(["SIDE", "TOP", "FOLLOW", "FRONT"] as CameraView[]).map((view) => (
              <button
                key={view}
                onClick={() => setCameraView(view)}
                className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                  cameraView === view ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                }`}
              >
                {view}
              </button>
            ))}
          </div>
          <div className="h-8 w-px bg-white/10" />
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Top Energy Progress Bar */}
      {isRunning && (
        <div className="absolute top-[142px] left-1/2 -translate-x-1/2 z-30 w-[42%] min-w-[360px] max-w-[680px]">
          <div className="relative h-5 border-2 border-yellow-300 bg-black/70 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-orange-400 transition-[width] duration-200"
              style={{ width: `${Math.max(0, Math.min(100, sim.energy))}%` }}
            />
            <div className={`absolute inset-0 flex items-center justify-center text-sm font-black ${sim.energy < 50 ? "text-orange-400" : "text-black"}`}>
              {sim.energy.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Left Parameter Controls */}
      <div className={`absolute left-6 top-24 bottom-6 w-80 flex flex-col gap-4 transition-all duration-500 ${showControls ? "translate-x-0" : "-translate-x-[calc(100%+24px)]"}`}>
        <div className="flex-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col gap-6 shadow-2xl overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Parameter Controls</h2>
            <Settings className="w-4 h-4 text-gray-500" />
          </div>
          
          <ControlPanel 
            params={sim.params} 
            setParams={(p) => sim.setParams(prev => ({ ...prev, ...p }))} 
            onStart={sim.start} 
            onStop={sim.stop} 
            isRunning={isRunning}
          />

          <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-3">
            <button
              onClick={isRunning ? sim.stop : sim.start}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest transition-all active:scale-95 ${
                isRunning 
                  ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30" 
                  : "bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700"
              }`}
            >
              {isRunning ? <RotateCcw className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              {isRunning ? "Stop Session" : "Start Simulation"}
            </button>
            <button 
              onClick={() => sim.setParams({ rollingAngle: 50, rollingTime: 3, strokeInterval: 3.5, glideHold: 1, bodyPitch: -1 })}
              className="w-full py-3 rounded-2xl bg-white/5 text-gray-400 text-[10px] font-black uppercase tracking-widest border border-white/5 hover:bg-white/10 transition-all"
            >
              Reset to Optimal
            </button>
          </div>
        </div>
      </div>

      {/* Toggle Controls Button */}
      <button 
        onClick={() => setShowControls(!showControls)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 w-8 h-20 bg-black/60 backdrop-blur-xl border border-white/10 rounded-r-xl flex items-center justify-center text-gray-400 hover:text-white transition-all ${showControls ? "left-[320px]" : "left-0"}`}
      >
        {showControls ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {/* Right Analytics Dashboard */}
      <div className={`absolute right-6 top-24 bottom-6 w-96 flex flex-col gap-4 transition-all duration-500 ${showAnalytics ? "translate-x-0" : "translate-x-[calc(100%+24px)]"}`}>
        {/* Real-time Metrics Card */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Real-time Analytics</h2>
            <div className="flex gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${isRunning ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-[9px] font-bold text-gray-500 uppercase">{sim.state}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Current Speed</p>
              <p className="text-2xl font-black italic serif tracking-tighter text-white">{sim.speed.toFixed(2)} <span className="text-xs font-normal not-italic text-gray-400 ml-1">m/s</span></p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Distance</p>
              <p className="text-2xl font-black italic serif tracking-tighter text-white">{sim.distance.toFixed(1)} <span className="text-xs font-normal not-italic text-gray-400 ml-1">/ 50.0m</span></p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className="text-gray-500">Active Arm</span>
              <span className={`px-2 py-0.5 rounded ${sim.activeArm !== "None" ? "bg-blue-500/20 text-blue-400" : "text-gray-600"}`}>{sim.activeArm}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className="text-gray-500">Efficiency</span>
              <span className="text-white">{sim.metrics.efficiency.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className="text-gray-500">Stroke Rate</span>
              <span className="text-white">{sim.metrics.strokeRate.toFixed(1)} SPM</span>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
            <ThrustChart data={sim.history} />
            <SpeedChart data={sim.history} />
          </div>
        </div>

        {/* Status Badges */}
        <div className="mt-auto flex gap-2">
          <div className="flex-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-gray-500 uppercase">Energy</p>
              <p className="text-xs font-black text-white">{sim.energy.toFixed(1)}%</p>
            </div>
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Info className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-gray-500 uppercase">Elapsed</p>
              <p className="text-xs font-black text-white">{sim.time.toFixed(1)}s</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Analytics Button */}
      <button
        onClick={() => setShowAnalytics(!showAnalytics)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 w-8 h-20 bg-black/60 backdrop-blur-xl border border-white/10 rounded-l-xl flex items-center justify-center text-gray-400 hover:text-white transition-all ${showAnalytics ? "right-[384px]" : "right-0"}`}
      >
        {showAnalytics ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>

      {/* Swimmer annotation anchored to the projected 3D point behind the legs */}
      {isRunning && (
        <div
          className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: annotationPos.x, top: annotationPos.y }}
        >
          <div className="px-4 py-2 bg-black/80 backdrop-blur-md border border-blue-500/50 rounded-xl shadow-2xl flex items-center gap-3 whitespace-nowrap">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,1)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
              Roll: <span className="text-cyan-400">{sim.roll.toFixed(1)}°</span>
              <span className="mx-2 text-gray-500">|</span>
              Elapsed: <span className="text-yellow-400">{sim.time.toFixed(1)}s</span>
            </span>
          </div>
        </div>
      )}

      {/* Finish Overlay */}
      {sim.state === SimulationState.Finished && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-gray-900 rounded-[40px] border border-white/10 p-12 text-center shadow-2xl">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/40">
              <Activity className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-5xl font-black italic serif uppercase tracking-tighter mb-2">Session Complete</h2>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-12">50m Olympic Pool Performance Data</p>
            
            <div className="grid grid-cols-2 gap-6 mb-12">
              <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Total Time</p>
                <p className="text-3xl font-black italic serif text-white">{sim.time.toFixed(2)}s</p>
              </div>
              <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Avg Speed</p>
                <p className="text-3xl font-black italic serif text-white">{(50 / sim.time).toFixed(2)}m/s</p>
              </div>
            </div>

            <button
              onClick={sim.stop}
              className="w-full py-5 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/20 transition-all active:scale-95"
            >
              Analyze New Parameters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
