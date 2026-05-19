import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';

interface TopAuthor {
  name: string;
  count: number;
}

interface TopResource {
  id: string;
  title: string;
  authorName: string;
  commentCount: number;
}

interface TopPerformersProps {
  topAuthors: TopAuthor[];
  topResources: TopResource[];
}

export default function TopPerformers({ topAuthors, topResources }: TopPerformersProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Authors */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Auteurs les plus actifs</h3>
        <p className="text-xs text-slate-400 mb-4">Top enseignants par nombre de ressources publi&eacute;es</p>
        {topAuthors.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topAuthors}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                  }}
                  formatter={(value: number) => [`${value} ressource${value > 1 ? 's' : ''}`, 'Publiées']}
                />
                <Bar dataKey="count" fill="#f97316" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-12 text-center">Aucun auteur pour le moment.</p>
        )}
      </div>

      {/* Top Resources by Engagement */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Ressources les plus engag&eacute;es</h3>
        <p className="text-xs text-slate-400 mb-4">Top ressources par nombre de commentaires</p>
        {topResources.length > 0 ? (
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {topResources.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-sharek-100 text-sharek-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/ressources/${r.id}`}
                    className="text-sm font-medium text-slate-800 truncate hover:text-sharek-600 block"
                  >
                    {r.title}
                  </Link>
                  <p className="text-xs text-slate-400 mt-0.5">Par {r.authorName}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0 bg-white px-2 py-1 rounded-full border border-slate-200">
                  <div className="w-3.5 h-3.5 flex items-center justify-center">
                    <i className="ri-message-3-line"></i>
                  </div>
                  {r.commentCount}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-12 text-center">Aucune ressource comment&eacute;e pour le moment.</p>
        )}
      </div>
    </div>
  );
}