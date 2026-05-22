import { SimulationParams } from "../types";
import { Sliders, Wind, Zap, Move, RotateCw } from "lucide-react";

interface ControlPanelProps {
  params: SimulationParams;
  setParams: (params: Partial<SimulationParams>) => void;
  onStart: () => void;
  onStop: () => void;
  isRunning: boolean;
}

export function ControlPanel({ params, setParams }: ControlPanelProps) {
  const controls = [
    {
      label: "Rolling Angle",
      icon: <RotateCw className="w-4 h-4" />,
      value: params.rollingAngle,
      min: 0,
      max: 90,
      step: 5,
      unit: "°",
      key: "rollingAngle" as const,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Stroke Interval",
      icon: <Zap className="w-4 h-4" />,
      value: params.strokeInterval,
      min: 1,
      max: 10,
      step: 0.5,
      unit: "s",
      key: "strokeInterval" as const,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
    {
      label: "Glide Duration",
      icon: <Wind className="w-4 h-4" />,
      value: params.glideHold,
      min: 0,
      max: 2,
      step: 0.1,
      unit: "s",
      key: "glideHold" as const,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Body Pitch",
      icon: <Move className="w-4 h-4" />,
      value: params.bodyPitch,
      min: -10,
      max: 10,
      step: 1,
      unit: "°",
      key: "bodyPitch" as const,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      {controls.map((control) => (
        <div key={control.key} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${control.bg} flex items-center justify-center ${control.color}`}>
                {control.icon}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{control.label}</span>
            </div>
            <span className={`text-sm font-black italic serif ${control.color}`}>
              {control.value}{control.unit}
            </span>
          </div>
          
          <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden group">
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={control.value}
              onChange={(e) => setParams({ [control.key]: parseFloat(e.target.value) })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div 
              className={`absolute top-0 left-0 h-full transition-all duration-300 ${control.bg.replace('/10', '/40')}`}
              style={{ width: `${((control.value - control.min) / (control.max - control.min)) * 100}%` }}
            />
            <div 
              className={`absolute top-0 h-full w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-300`}
              style={{ left: `${((control.value - control.min) / (control.max - control.min)) * 100}%` }}
            />
          </div>
          
          <div className="flex justify-between text-[8px] font-bold text-gray-600 uppercase tracking-tighter">
            <span>Min: {control.min}{control.unit}</span>
            <span>Max: {control.max}{control.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
