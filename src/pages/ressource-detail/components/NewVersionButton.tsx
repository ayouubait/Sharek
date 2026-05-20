import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface Props {
  resourceId: string;
  currentRound: number;
}

export default function NewVersionButton({ resourceId, currentRound }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async () => {
    if (!file || !user) return;
    setLoading(true);
    setMessage(null);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${user.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await withTimeout(
        supabase.storage.from('resources').upload(path, file, { upsert: false }),
        60000
      );
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('resources').getPublicUrl(path);
      const fileUrl = pub?.publicUrl;
      if (!fileUrl) throw new Error('URL publique introuvable');

      // Call the SQL function that swaps the file and increments the round
      const { error: rpcErr } = await withTimeout(
        supabase.rpc('submit_new_version', {
          rid: resourceId,
          new_file_url: fileUrl,
          new_file_name: file.name,
        }),
        15000
      );
      if (rpcErr) throw rpcErr;

      setMessage({ type: 'success', text: `Nouvelle version soumise. Round ${currentRound + 1} démarré, les reviewers vont relire.` });
      setFile(null);
      // Reload the page after a short delay so the new state (status, file_url, round) is everywhere
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      logger.error('submit new version failed', err);
      setMessage({ type: 'error', text: 'Erreur lors de la soumission. Réessayez.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-amber-800">Nouveau fichier (PDF, PPTX, DOC…)</label>
      <input
        type="file"
        accept=".pdf,.pptx,.ppt,.doc,.docx,.zip,.html"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200"
      />
      {file && (
        <p className="text-[11px] text-slate-600 truncate">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={!file || loading}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 rounded-md transition-colors"
      >
        {loading ? (
          <><i className="ri-loader-4-line animate-spin"></i> Envoi...</>
        ) : (
          <><i className="ri-upload-2-line"></i> Soumettre la version revue (round {currentRound + 1})</>
        )}
      </button>
      {message && (
        <p className={`text-[11px] ${message.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>
      )}
    </div>
  );
}
