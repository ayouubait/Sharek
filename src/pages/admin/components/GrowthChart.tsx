import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface GrowthDataPoint {
  date: string;
  users: number;
  resources: number;
}

interface GrowthChartProps {
  data: GrowthDataPoint[];
}

export default function GrowthChart({ data }: GrowthChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Croissance de la plateforme</h3>
        <p className="text-xs text-slate-400 mb-4">Pas encore assez de donn&eacute;es pour afficher le graphique.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
      <h3 className="font-semibold text-slate-800 mb-1">Croissance de la plateforme</h3>
      <p className="text-xs text-slate-400 mb-4">Nouveaux utilisateurs et ressources par jour</p>
      <div className="h-56 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorResources" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelStyle={{ color: '#64748b', fontSize: '12px' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '13px', paddingTop: '8px' }}
            />
            <Area
              type="monotone"
              dataKey="users"
              stroke="#f97316"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorUsers)"
              name="Utilisateurs"
            />
            <Area
              type="monotone"
              dataKey="resources"
              stroke="#14b8a6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorResources)"
              name="Ressources"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}