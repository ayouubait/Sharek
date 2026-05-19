import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const TYPE_COLORS = ['#f97316', '#14b8a6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

interface DistributionItem {
  name: string;
  value: number;
}

interface ResourceDistributionProps {
  typeData: DistributionItem[];
  statusData: DistributionItem[];
}

export default function ResourceDistribution({ typeData, statusData }: ResourceDistributionProps) {
  const hasTypeData = typeData.length > 0;
  const hasStatusData = statusData.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Resource Types Pie Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Types de ressources</h3>
        <p className="text-xs text-slate-400 mb-4">R&eacute;partition par cat&eacute;gorie</p>
        {hasTypeData ? (
          <>
            <div className="h-44 md:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {typeData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={TYPE_COLORS[index % TYPE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                    }}
                    formatter={(value: number, name: string) => [`${value} ressource${value > 1 ? 's' : ''}`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {typeData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[index % TYPE_COLORS.length] }}
                  />
                  {entry.name} ({entry.value})
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 py-12 text-center">Aucune ressource pour le moment.</p>
        )}
      </div>

      {/* Resource Status Bar Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Statut des ressources</h3>
        <p className="text-xs text-slate-400 mb-4">R&eacute;partition par &eacute;tat de validation</p>
        {hasStatusData ? (
          <div className="h-48 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                  }}
                  formatter={(value: number) => [`${value} ressource${value > 1 ? 's' : ''}`, 'Total']}
                />
                <Bar dataKey="value" fill="#14b8a6" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">Aucune donn&eacute;e disponible.</p>
        )}
      </div>
    </div>
  );
}