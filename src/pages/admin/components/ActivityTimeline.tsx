interface ActivityEvent {
  id: string;
  type: 'user' | 'resource' | 'comment' | 'review' | 'message' | 'recommendation';
  description: string;
  time: string;
}

const EVENT_ICONS: Record<ActivityEvent['type'], string> = {
  user: 'ri-user-add-line',
  resource: 'ri-file-add-line',
  comment: 'ri-message-3-line',
  review: 'ri-team-line',
  message: 'ri-mail-send-line',
  recommendation: 'ri-check-double-line',
};

const EVENT_COLORS: Record<ActivityEvent['type'], string> = {
  user: 'bg-orange-50 text-orange-600',
  resource: 'bg-teal-50 text-teal-600',
  comment: 'bg-amber-50 text-amber-600',
  review: 'bg-emerald-50 text-emerald-600',
  message: 'bg-slate-100 text-slate-600',
  recommendation: 'bg-green-50 text-green-600',
};

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

export default function ActivityTimeline({ events }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Activit&eacute; r&eacute;cente</h3>
        <p className="text-xs text-slate-400 mb-4">Derniers &eacute;v&eacute;nements sur la plateforme</p>
        <p className="text-sm text-slate-400 py-8 text-center">Aucune activit&eacute; r&eacute;cente.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-800 mb-1">Activit&eacute; r&eacute;cente</h3>
      <p className="text-xs text-slate-400 mb-4">Derniers &eacute;v&eacute;nements sur la plateforme</p>
      <div className="space-y-0">
        {events.map((event, index) => (
          <div key={event.id} className="flex gap-3 pb-5 relative last:pb-0">
            {index < events.length - 1 && (
              <div className="absolute left-4 top-8 bottom-0 w-px bg-slate-200" />
            )}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${EVENT_COLORS[event.type]}`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={EVENT_ICONS[event.type]}></i>
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm text-slate-700">{event.description}</p>
              <p className="text-xs text-slate-400 mt-0.5">{event.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}