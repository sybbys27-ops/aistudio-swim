import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MetricPoint } from '../hooks/useSimulation';

interface SpeedChartProps {
  data: MetricPoint[];
}

export function SpeedChart({ data }: SpeedChartProps) {
  return (
    <div className="w-full h-32 bg-gray-900/50 rounded-xl p-2 border border-white/10">
      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex justify-between">
        <span>Velocity Profile (m/s)</span>
        <span className="text-gray-500">Acceleration</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ffff" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#00ffff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="time" hide />
          <YAxis stroke="#666" fontSize={10} domain={[0, 3]} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111', border: 'none', fontSize: '10px' }}
            itemStyle={{ padding: '0' }}
          />
          <Area 
            type="monotone" 
            dataKey="speed" 
            stroke="#00ffff" 
            fillOpacity={1} 
            fill="url(#colorSpeed)" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
