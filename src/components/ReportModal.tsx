import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';

interface ReportModalProps {
  resourceId: string;
  resourceTitle: string;
  userId: string;
  onClose: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const REASONS = [
  { value: 'inappropriate', label: 'Contenu inapproprié', icon: 'ri-forbid-line' },
  { value: 'copyright', label: 'Violation de droits d\'auteur', icon: 'ri-copyright-line' },
  { value: 'spam', label: 'Spam ou contenu trompeur', icon: 'ri-spam-line' },
  { value: 'other', label: 'Autre raison', icon: 'ri-more-line' },
];

export default function ReportModal({ resourceId, resourceTitle, userId, onClose, onToast }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      onToast('Veuillez sélectionner un motif', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const selectedLabel = REASONS.find((r) => r.value === reason)?.label || reason;
      const { error } = await withTimeout(
        supabase.from('notifications').insert({
          user_id: userId,
          type: 'report',
          title: `Signalement : ${resourceTitle.slice(0, 80)}`,
          message: `Motif : ${selectedLabel}${details ? ` - Détails : ${details}` : ''}`,
          resource_id: resourceId,
          read: false,
        }),
        10000
      );

      if (error) throw error;

      onToast('Signalement envoyé. Merci pour votre vigilance !', 'success');
      onClose();
    } catch {
      onToast('Erreur lors de l\'envoi du signalement', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-5 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <i className="ri-flag-line text-sm" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Signaler cette ressource</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Vous signalez : <span className="font-medium text-slate-700">{resourceTitle}</span>
        </p>

        {/* Reasons */}
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Motif du signalement</p>
          {REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                reason === r.value
                  ? 'border-rose-300 bg-rose-50/40'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="reportReason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-rose-600"
              />
              <div className="w-4 h-4 flex items-center justify-center text-slate-400">
                <i className={`${r.icon} text-xs`} />
              </div>
              <span className="text-sm text-slate-700">{r.label}</span>
            </label>
          ))}
        </div>

        {/* Details */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Détails complémentaires <span className="text-slate-400 font-normal normal-case">(optionnel)</span>
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Précisez le problème rencontré..."
            className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 resize-none placeholder:text-slate-300"
          />
          <p className="text-[10px] text-slate-400 mt-1 text-right">{details.length}/500</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !reason}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <i className="ri-loader-4-line animate-spin" />}
            Envoyer le signalement
          </button>
        </div>
      </form>
    </div>
  );
}