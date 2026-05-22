import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MetricPoint } from '../hooks/useSimulation';

interface ThrustChartProps {
  data: MetricPoint[];
}

export function ThrustChart({ data }: ThrustChartProps) {
  return (
    <div className="w-full h-48 bg-gray-900/50 rounded-xl p-2 border border-white/10">
      <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-2 flex justify-between">
        <span>Thrust (N) vs Drag (N)</span>
        <span className="text-gray-500">Real-time Physics</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="time" 
            hide 
          />
          <YAxis 
            stroke="#666" 
            fontSize={10} 
            tickFormatter={(v) => `${v}`}
            domain={[0, 600]}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111', border: 'none', fontSize: '10px' }}
            itemStyle={{ padding: '0' }}
          />
          <Line 
            type="monotone" 
            dataKey="thrust" 
            stroke="#00ff00" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false}
            name="Thrust"
          />
          <Line 
            type="monotone" 
            dataKey="drag" 
            stroke="#ff0000" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false}
            name="Drag"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
