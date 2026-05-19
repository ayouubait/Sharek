interface EngagementMetric {
  label: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
}

interface EngagementCardsProps {
  metrics: EngagementMetric[];
  loading: boolean;
}

export default function EngagementCards({ metrics, loading }: EngagementCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`w-8 h-8 rounded-lg ${metric.bg} ${metric.color} flex items-center justify-center`}>
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={metric.icon}></i>
              </div>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {loading ? (
              <div className="h-8 w-14 bg-slate-100 rounded animate-pulse" />
            ) : (
              metric.value
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{metric.label}</div>
        </div>
      ))}
    </div>
  );
}