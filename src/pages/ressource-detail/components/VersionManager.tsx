import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import type { ResourceVersion } from '@/mocks/data';
import { supabase } from '@/lib/supabase';
import { fetchProfilesMap, getDisplayProfile } from '@/lib/profiles';

interface VersionManagerProps {
  resourceId: string;
  resourceAuthorId: string;
  currentVersion: number;
  versionCount: number;
  onVersionChange: (version: ResourceVersion | null) => void;
}

interface ActivityEvent {
  id: string;
  type: 'version' | 'review' | 'comment' | 'status_change';
  label: string;
  description: string;
  date: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

export default function VersionManager({
  resourceId,
  resourceAuthorId,
  currentVersion,
  versionCount,
  onVersionChange,
}: VersionManagerProps) {
  const { user } = useAuth();
  const isAuthor = user?.id === resourceAuthorId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [versions, setVersions] = useState<ResourceVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion || 1);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, import('@/lib/profiles').ProfileInfo>>();

  const loadVersions = useCallback(async () => {
    setLoading(true);
    let allVersions: ResourceVersion[] = [];

    try {
      const { data, error } = await supabase
        .from('resource_versions')
        .select('*')
        .eq('resource_id', resourceId)
        .order('version_number', { ascending: true });

      if (!error && data) {
        allVersions = data.map((v) => ({
          id: v.id,
          resource_id: v.resource_id,
          version_number: v.version_number,
          file_url: v.file_url,
          file_type: v.file_type,
          notes: v.notes || '',
          created_by: v.created_by,
          created_at: v.created_at,
          status: v.status,
          round: v.round || 1,
        })) as ResourceVersion[];
      }
    } catch {
      // Silencieux
    }

    allVersions.sort((a, b) => a.version_number - b.version_number);
    setVersions(allVersions);

    const active = allVersions.find((v) => v.version_number === (currentVersion || 1)) ||
      allVersions[allVersions.length - 1] || null;
    if (active) {
      setSelectedVersion(active.version_number);
      onVersionChange(active);
    }

    // Fetch profiles for version creators
    const creatorIds = [...new Set(allVersions.map((v) => v.created_by).filter(Boolean))];
    if (creatorIds.length > 0) {
      const profiles = await fetchProfilesMap(creatorIds);
      setProfilesMap(profiles);
    }

    setLoading(false);
  }, [resourceId, currentVersion, onVersionChange]);

  const buildActivities = useCallback(() => {
    const events: ActivityEvent[] = [];

    versions.forEach((v) => {
      const profile = getDisplayProfile(v.created_by, profilesMap);
      events.push({
        id: `v-${v.id}`,
        type: 'version',
        label: `Version ${v.version_number} soumise`,
        description: v.notes || `Fichier version ${v.version_number}`,
        date: v.created_at,
        authorName: profile.name,
        authorInitials: profile.initials,
        authorColor: profile.color,
        icon: 'ri-file-upload-line',
        iconBg: 'bg-ocean-50',
        iconColor: 'text-ocean-500',
      });
    });

    // Ajouter des événements de review basés sur les versions
    versions.forEach((v) => {
      if (v.status === 'peer_reviewed' || v.status === 'needs_revision') {
        events.push({
          id: `r-${v.id}`,
          type: 'review',
          label: v.status === 'peer_reviewed' ? `Peer review validé (V${v.version_number})` : `Révision demandée (V${v.version_number})`,
          description: v.status === 'peer_reviewed'
            ? 'Les reviewers ont validé cette version avec des modifications mineures.'
            : 'Les reviewers ont demandé des corrections avant validation.',
          date: v.created_at,
          authorName: 'Système',
          authorInitials: 'SY',
          authorColor: '#64748b',
          icon: v.status === 'peer_reviewed' ? 'ri-shield-check-line' : 'ri-refresh-line',
          iconBg: v.status === 'peer_reviewed' ? 'bg-green-50' : 'bg-amber-50',
          iconColor: v.status === 'peer_reviewed' ? 'text-green-500' : 'text-amber-500',
        });
      }
    });

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setActivities(events);
  }, [versions, profilesMap]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    buildActivities();
  }, [buildActivities]);

  const handleSelectVersion = (v: ResourceVersion) => {
    setSelectedVersion(v.version_number);
    onVersionChange(v);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setUploadFile(f);
  };

  const handleUpload = async () => {
    if (!uploadFile || !user) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const nextVersion = (versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) : 0) + 1;
    const nextRound = (versions.length > 0 ? Math.max(...versions.map((v) => v.round)) : 0) + 1;
    const filePath = `${user.id}/${resourceId}_v${nextVersion}_${uploadFile.name}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('resources')
        .upload(filePath, uploadFile, {
          upsert: true,
        });

      if (uploadError) {
        logger.error('Storage upload error:', uploadError);
        throw new Error(`Upload échoué : ${uploadError.message}`);
      }

      setUploadProgress(60);

      const { data: urlData } = supabase.storage
        .from('resources')
        .getPublicUrl(filePath);

      setUploadProgress(80);

      const { error: insertError } = await supabase.from('resource_versions').insert({
        resource_id: resourceId,
        version_number: nextVersion,
        file_url: urlData.publicUrl,
        file_type: uploadFile.name.endsWith('.pdf') ? 'pdf' : 'slides',
        notes: uploadNotes || `Version ${nextVersion}`,
        created_by: user.id,
        status: 'draft',
        round: nextRound,
      });

      if (insertError) {
        logger.error('DB insert error:', insertError);
        throw new Error(`Sauvegarde en base échouée : ${insertError.message}`);
      }

      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setShowUploadForm(false);
        setUploadFile(null);
        setUploadNotes('');
        setUploadError(null);
        loadVersions();
      }, 500);
    } catch (err: any) {
      logger.error('Upload version error:', err);
      setUploadError(err?.message || 'Une erreur inattendue est survenue lors de la sauvegarde.');
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { text: string; bg: string; color: string }> = {
      draft: { text: 'Brouillon', bg: 'bg-slate-100', color: 'text-slate-600' },
      under_review: { text: 'En review', bg: 'bg-amber-50', color: 'text-amber-700' },
      needs_revision: { text: 'À réviser', bg: 'bg-red-50', color: 'text-red-700' },
      peer_reviewed: { text: 'Validé', bg: 'bg-green-50', color: 'text-green-700' },
      published: { text: 'Publié', bg: 'bg-teal-50', color: 'text-teal-700' },
    };
    const c = map[status] || map.draft;
    return (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.bg} ${c.color}`}>
        {c.text}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const latestVersion = versions.length > 0
    ? versions.reduce((max, v) => (v.version_number > max.version_number ? v : max), versions[0])
    : null;

  useEffect(() => {
    if (!isAuthor && latestVersion && latestVersion.version_number !== selectedVersion) {
      setSelectedVersion(latestVersion.version_number);
      onVersionChange(latestVersion);
    }
  }, [isAuthor, latestVersion, selectedVersion, onVersionChange]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-loader-4-line animate-spin" />
          </div>
          Chargement des versions...
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {/* AUTEUR - full version manager */}
      {isAuthor && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 flex items-center justify-center rounded ${versions.length === 0 ? 'bg-slate-50 text-slate-400' : 'bg-ocean-50 text-ocean-500'}`}>
                <i className="ri-stack-line text-lg" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Versions du document</p>
                <p className="text-xs text-slate-400">
                  {versions.length === 0
                    ? 'Aucune version historisée'
                    : `${versions.length} version${versions.length > 1 ? 's' : ''} · Round actuel : ${Math.max(...versions.map((v) => v.round))}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors"
              >
                <i className={showHistory ? 'ri-arrow-up-s-line' : 'ri-history-line'} />
                {showHistory ? 'Masquer' : 'Historique'}
              </button>
              <button
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ocean-600 rounded-md hover:bg-ocean-700 transition-colors"
              >
                <i className={showUploadForm ? 'ri-subtract-line' : 'ri-add-line'} />
                {showUploadForm ? 'Fermer' : 'Nouvelle version'}
              </button>
            </div>
          </div>

          {/* Version pills - seulement si des versions existent */}
          {versions.length > 0 && (
            <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
              {versions.map((v) => {
                const isActive = v.version_number === selectedVersion;
                return (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVersion(v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                      isActive
                        ? 'bg-ocean-600 text-white border-ocean-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 flex items-center justify-center ${isActive ? 'text-white' : 'text-slate-400'}`}>
                      <i className="ri-file-line text-sm" />
                    </div>
                    <span>V{v.version_number}</span>
                    {getStatusBadge(v.status)}
                    {v.round > 0 && (
                      <span className={`text-[10px] ${isActive ? 'text-ocean-100' : 'text-slate-400'}`}>
                        R{v.round}
                      </span>
                    )}
                  </button>
                );
              })}
              <span className="text-xs text-slate-400 ml-1">
                (V{selectedVersion} affichée)
              </span>
            </div>
          )}

          {/* Selected version notes */}
          {(() => {
            const active = versions.find((v) => v.version_number === selectedVersion);
            if (!active || !active.notes) return null;
            return (
              <div className="px-4 pb-3">
                <div className="bg-slate-50 rounded-md px-3 py-2 text-xs text-slate-600 leading-relaxed border border-slate-100">
                  <span className="font-semibold text-slate-700">Notes V{active.version_number} :</span>{' '}
                  {active.notes}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* NON-AUTEUR - version courante uniquement */}
      {!isAuthor && latestVersion && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2.5 border-b border-slate-100">
            <div className="w-8 h-8 flex items-center justify-center rounded bg-green-50 text-green-500">
              <i className="ri-file-list-3-line text-lg" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Document actuel</p>
              <p className="text-xs text-slate-400">
                Version {latestVersion.version_number} · {getStatusBadge(latestVersion.status)}
                {latestVersion.round > 0 && (
                  <span className="ml-1.5 text-slate-400">Round {latestVersion.round}</span>
                )}
              </p>
            </div>
          </div>
          {latestVersion.notes && (
            <div className="px-4 py-3">
              <div className="bg-slate-50 rounded-md px-3 py-2 text-xs text-slate-600 leading-relaxed border border-slate-100">
                <span className="font-semibold text-slate-700">Notes :</span>{' '}
                {latestVersion.notes}
              </div>
            </div>
          )}
        </div>
      )}

      {!isAuthor && !latestVersion && versions.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-400 text-center">Aucune version disponible pour cette ressource.</p>
        </div>
      )}

      {/* Upload new version form - AUTEUR uniquement */}
      {showUploadForm && isAuthor && (
        <div className="mt-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 flex items-center justify-center rounded bg-ocean-50 text-ocean-500">
              <i className="ri-upload-cloud-2-line text-sm" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">Soumettre une nouvelle version</h4>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fichier du document</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.pptx,.ppt,.docx,.doc,.html"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-4 h-4 flex items-center justify-center text-slate-400">
                    <i className="ri-attachment-line" />
                  </div>
                  <span className="truncate">
                    {uploadFile ? uploadFile.name : 'Choisir un fichier (PDF, PPTX, DOCX...)'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes de version (changements apportés)</label>
              <textarea
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Décrivez les corrections et améliorations apportées dans cette version..."
                className="w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-ocean-200 focus:border-ocean-300 resize-none"
              />
              <div className="text-right text-[10px] text-slate-400 mt-0.5">{uploadNotes.length}/500</div>
            </div>

            {uploading && (
              <div className="space-y-1">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ocean-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">Upload en cours... {uploadProgress}%</p>
              </div>
            )}

            {uploadError && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-error-warning-line" />
                </div>
                <span className="leading-relaxed">{uploadError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setShowUploadForm(false);
                  setUploadFile(null);
                  setUploadNotes('');
                  setUploadError(null);
                }}
                disabled={uploading}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-ocean-600 hover:bg-ocean-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-md transition-colors"
              >
                {uploading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <i className="ri-upload-cloud-2-line" />
                    Soumettre la version
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History / Timeline - AUTEUR uniquement */}
      {showHistory && isAuthor && (
        <div className="mt-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <i className="ri-time-line text-slate-400" />
              Historique des activités
            </h4>
          </div>
          <div className="px-4 py-3">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Aucune activité enregistrée.</p>
            ) : (
              <div className="space-y-0">
                {activities.map((event, idx) => (
                  <div key={event.id} className="flex gap-3 relative">
                    {/* Timeline line */}
                    {idx < activities.length - 1 && (
                      <div className="absolute left-[15px] top-8 bottom-[-8px] w-px bg-slate-100" />
                    )}
                    {/* Icon */}
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full ${event.iconBg} ${event.iconColor} flex-shrink-0 z-10`}>
                      <i className={`${event.icon} text-sm`} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-4 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">{event.label}</p>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">{formatDate(event.date)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{event.description}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: event.authorColor }}
                        >
                          {event.authorInitials}
                        </div>
                        <span className="text-[11px] text-slate-400">{event.authorName}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}