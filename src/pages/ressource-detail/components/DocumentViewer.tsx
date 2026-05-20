import { useState, useEffect } from 'react';
import type { Resource } from '@/mocks/data';

interface DocumentViewerProps {
  resource: Resource;
  activeFileUrl?: string;
  resourceAuthorId?: string;
}

/* ─── Helper: extract YouTube ID ─── */
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/* ─── YouTube Viewer (clean, minimal branding) ─── */
function YouTubeViewer({ url, title }: { url: string; title: string }) {
  const videoId = extractYouTubeId(url);
  const [isPlaying, setIsPlaying] = useState(false);

  if (!videoId) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-3">
          <i className="ri-error-warning-line text-xl text-rose-500" />
        </div>
        <p className="text-sm font-medium text-slate-700">URL YouTube invalide</p>
        <p className="text-xs text-slate-400 mt-1">L&apos;URL fournie ne correspond pas à une vidéo YouTube.</p>
      </div>
    );
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3&fs=1&controls=1&playsinline=1`;
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 flex items-center justify-center rounded bg-rose-50 text-rose-500">
            <i className="ri-movie-line text-xs" />
          </div>
          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px] sm:max-w-[200px] md:max-w-sm">{title}</span>
        </div>
        <span className="text-[11px] text-slate-400">Vidéo</span>
      </div>

      {/* Video player */}
      <div className="relative bg-black overflow-hidden" style={{ paddingTop: '56.25%' }}>
        {!isPlaying ? (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 w-full h-full group cursor-pointer"
          >
            <img
              src={thumbnailUrl}
              alt="Aperçu de la vidéo"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
            {/* Custom play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/90 group-hover:bg-white group-hover:scale-105 transition-all flex items-center justify-center shadow-lg">
                <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center text-rose-600 ml-1">
                  <i className="ri-play-fill text-2xl md:text-3xl" />
                </div>
              </div>
            </div>
          </button>
        ) : (
          <iframe
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        )}
      </div>
    </div>
  );
}

/* ─── External Embed Viewer ─── */
function EmbedViewer({ url, title }: { url: string; title?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 flex items-center justify-center rounded bg-violet-50 text-violet-500">
            <i className="ri-window-2-line text-xs" />
          </div>
          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px] sm:max-w-[200px] md:max-w-sm">
            {title || 'Ressource externe'}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Intégré</span>
      </div>

      {/* Iframe */}
      <div className="relative bg-slate-50 overflow-hidden" style={{ paddingTop: '56.25%' }}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-50">
            <div className="w-8 h-8 flex items-center justify-center animate-spin mb-2">
              <i className="ri-loader-4-line text-sharek-500 text-2xl" />
            </div>
            <p className="text-xs text-slate-500">Chargement...</p>
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-6">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-400 mb-3">
              <i className="ri-error-warning-line text-2xl" />
            </div>
            <p className="text-sm font-medium text-slate-700">Impossible d&apos;afficher la ressource</p>
            <p className="text-xs text-slate-400 mt-1 text-center max-w-sm">Le site externe ne permet pas l&apos;intégration.</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-sharek-600 hover:bg-sharek-700 text-white text-xs font-medium rounded-md transition-colors"
            >
              <i className="ri-external-link-line" />
              Ouvrir dans un nouvel onglet
            </a>
          </div>
        ) : (
          <iframe
            src={url}
            title={title || 'Ressource externe'}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            className="absolute inset-0 w-full h-full border-0"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Inline Simulated Pages (scrollable, no overlay) ─── */
function InlineSimulatedPages({ resource }: { resource: Resource }) {
  const [page, setPage] = useState(0);

  const pages = [
    {
      title: resource.title,
      subtitle: `${resource.type_label} - ${resource.school_level}`,
      body: [
        `Niveau : ${resource.school_level}`,
        `Unité : ${resource.unit}`,
        `Date de publication : ${new Date(resource.created_at).toLocaleDateString('fr-FR')}`,
        `Durée estimée : ${resource.duration}`,
        ``,
        `Mots-clés : ${resource.keywords.join(', ')}`,
      ],
      footer: '1 / 4',
    },
    {
      title: "Objectifs d'apprentissage",
      subtitle: '',
      body: resource.objectives.split('. ').filter(Boolean),
      footer: '2 / 4',
    },
    {
      title: 'Compétences visées',
      subtitle: '',
      body: resource.competencies.split('. ').filter(Boolean),
      footer: '3 / 4',
    },
    {
      title: 'Résumé et utilisation pédagogique',
      subtitle: '',
      body: [
        `Cette ressource de type « ${resource.type_label} » a été conçue pour le niveau ${resource.school_level}.`,
        `Elle s'intègre dans l'unité « ${resource.unit} » et peut être utilisée en classe ou en autonomie.`,
        ``,
        `Nombre de vues : ${resource.views || 0}`,
        `Nombre de téléchargements : ${resource.downloads || 0}`,
        `Commentaires : ${resource.comments_count || 0}`,
        ``,
        `Statut : ${resource.status_label}`,
      ],
      footer: '4 / 4',
    },
  ];

  const totalPages = pages.length;
  const current = pages[page];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
      {/* Compact toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 flex items-center justify-center rounded bg-red-50 text-red-500">
            <i className="ri-file-pdf-2-line text-xs" />
          </div>
          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px] sm:max-w-[200px] md:max-w-sm">{resource.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 transition-colors"
          >
            <i className="ri-arrow-left-s-line text-xs" />
          </button>
          <span className="text-[11px] text-slate-600 font-medium w-8 text-center">{page + 1}/{totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 transition-colors"
          >
            <i className="ri-arrow-right-s-line text-xs" />
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="overflow-auto bg-slate-100 h-[50vh] sm:h-[640px]">
        <div className="py-6 px-3 sm:px-4 flex justify-center">
          <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg min-h-[400px] sm:min-h-[600px] flex flex-col">
            <div className="px-8 pt-10 pb-4 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">{current.title}</h2>
              {current.subtitle && <p className="text-sm text-slate-500 mt-1">{current.subtitle}</p>}
            </div>
            <div className="flex-1 px-8 py-6">
              {current.body.map((line, i) =>
                line.trim() === '' ? (
                  <div key={i} className="h-4" />
                ) : (
                  <p key={i} className="text-sm text-slate-700 leading-relaxed mb-3">
                    {line}
                  </p>
                )
              )}
            </div>
            <div className="px-8 pt-2 pb-3 border-t border-slate-100 text-center">
              <span className="text-[10px] text-slate-300 font-medium tracking-widest uppercase">{current.footer}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Real PDF Viewer - inline embed via Google Docs Viewer ─── */
function RealPdfViewer({ url, title }: { url: string; title: string }) {
  // Google Docs Viewer renders the PDF inside an embed regardless of
  // Content-Disposition header on the source. Works for any public PDF URL.
  // The fragment-style native iframe (`url#toolbar=1`) is unreliable because
  // some Supabase configs serve PDFs with `Content-Disposition: attachment`,
  // which triggers an immediate download instead of inline display.
  const gviewUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
      {/* Compact toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 flex items-center justify-center rounded bg-red-50 dark:bg-red-900/30 text-red-500">
            <i className="ri-file-pdf-2-line text-xs" />
          </div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate max-w-[120px] sm:max-w-[200px] md:max-w-sm">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            title="Ouvrir dans un nouvel onglet"
          >
            <i className="ri-external-link-line text-[12px]" />
            <span className="hidden sm:inline">Ouvrir</span>
          </a>
          <a
            href={url}
            download
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            title="Télécharger"
          >
            <i className="ri-download-line text-[12px]" />
            <span className="hidden sm:inline">Télécharger</span>
          </a>
        </div>
      </div>

      {/* Desktop: inline PDF via Google Docs viewer. Mobile: explicit open/download buttons
          because Google Docs Viewer routinely fails to render inside mobile webviews. */}
      <div className="bg-slate-100 dark:bg-slate-900 h-[70vh] sm:h-[800px] hidden sm:block">
        <iframe
          src={gviewUrl}
          title={title}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
      <div className="bg-slate-50 dark:bg-slate-900 p-6 flex flex-col items-center justify-center text-center sm:hidden">
        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-3">
          <i className="ri-file-pdf-2-line text-2xl" />
        </div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">Aperçu PDF indisponible sur mobile</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Ouvre le document dans un nouvel onglet ou télécharge-le pour le lire.</p>
        <div className="flex gap-2 w-full max-w-xs">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-sharek-600 hover:bg-sharek-700 rounded-lg transition-colors"
          >
            <i className="ri-external-link-line" />
            Ouvrir
          </a>
          <a
            href={url}
            download
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <i className="ri-download-line" />
            Télécharger
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline Slides Viewer ─── */
function InlineSlidesViewer({ resource }: { resource: Resource }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const totalSlides = 8;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
      {/* Compact toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 flex items-center justify-center rounded bg-amber-50 text-amber-500">
            <i className="ri-slideshow-line text-xs" />
          </div>
          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px] sm:max-w-[200px] md:max-w-sm">{resource.title}</span>
        </div>
        <span className="text-[11px] text-slate-500">{slideIndex + 1} / {totalSlides}</span>
      </div>
      <div className="bg-slate-100 p-4 overflow-auto h-[50vh] sm:h-[560px]">
        <div className="h-full flex flex-col max-w-3xl mx-auto">
          <div className="flex-1 bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-white">
              <div className="text-center">
                <div className="w-16 h-16 flex items-center justify-center rounded-full bg-amber-50 text-amber-500 mx-auto mb-3">
                  <i className="ri-slideshow-2-line text-3xl" />
                </div>
                <h3 className="text-base font-semibold text-slate-700 mb-1">
                  {slideIndex + 1} / {totalSlides}
                </h3>
                <p className="text-xs text-slate-400 max-w-md">{resource.title}</p>
                <p className="text-[11px] text-slate-400 mt-1">{resource.objectives}</p>
              </div>
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{resource.school_level} &middot; {resource.unit}</span>
              <span className="text-[11px] text-slate-400">{resource.duration}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <button
              onClick={() => setSlideIndex((s) => Math.max(0, s - 1))}
              disabled={slideIndex === 0}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-slate-200"
            >
              <i className="ri-arrow-left-s-line text-sm" />
            </button>
            {Array.from({ length: totalSlides }, (_, i) => (
              <button
                key={i}
                onClick={() => setSlideIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === slideIndex ? 'bg-ocean-500' : 'bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
            <button
              onClick={() => setSlideIndex((s) => Math.min(totalSlides - 1, s + 1))}
              disabled={slideIndex === totalSlides - 1}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-slate-200"
            >
              <i className="ri-arrow-right-s-line text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline Simulation Viewer ─── */
function InlineSimulationViewer({ resource, hasRealFile }: { resource: Resource; hasRealFile: boolean }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
      {/* Compact toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 flex items-center justify-center rounded bg-ocean-50 text-ocean-500">
            <i className="ri-computer-line text-xs" />
          </div>
          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px] sm:max-w-[200px] md:max-w-sm">{resource.title}</span>
        </div>
        <span className="text-[11px] text-slate-400">Simulation</span>
      </div>
      <div className="relative bg-slate-50 overflow-auto h-[50vh] sm:h-[560px]">
        {hasRealFile ? (
          <iframe
            src={resource.file_url || ''}
            title={resource.title}
            className="w-full h-full"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 h-full">
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-ocean-50 text-ocean-400 mb-3">
              <i className="ri-computer-line text-2xl" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-0.5 text-center">Simulation interactive</p>
            <p className="text-xs text-slate-400 text-center max-w-sm">
              Cette ressource est une simulation interactive. Le contenu s&apos;affichera ici lorsque le fichier sera disponible.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main DocumentViewer component ─── */
export default function DocumentViewer({ resource, activeFileUrl }: DocumentViewerProps) {
  // The file URL to use: active version overrides resource default
  const effectiveFileUrl = activeFileUrl || resource.file_url;

  // Check if this is a real uploaded file (not a mock placeholder)
  const hasRealFile = effectiveFileUrl && effectiveFileUrl.startsWith('http') && !effectiveFileUrl.includes('example.com');

  const hasYouTube = !!extractYouTubeId(resource.youtube_url || '');
  const hasEmbed = !!resource.embed_url?.trim();

  // Content priority: file > youtube > embed > simulated
  const contentTypes: { type: 'file' | 'youtube' | 'embed'; key: string }[] = [];
  if (hasRealFile || resource.file_type) contentTypes.push({ type: 'file', key: 'file' });
  if (hasYouTube) contentTypes.push({ type: 'youtube', key: 'youtube' });
  if (hasEmbed) contentTypes.push({ type: 'embed', key: 'embed' });

  // ── If no content at all, show fallback ──
  if (contentTypes.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 mx-auto mb-4">
          <i className="ri-file-text-line text-3xl" />
        </div>
        <p className="text-base font-medium text-slate-700 mb-1">Aucun contenu disponible</p>
        <p className="text-sm text-slate-400 mb-4">{resource.title}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {contentTypes.map(({ type }) => {
        if (type === 'youtube' && resource.youtube_url) {
          return (
            <YouTubeViewer
              key="youtube"
              url={resource.youtube_url}
              title={resource.title}
            />
          );
        }
        if (type === 'embed' && resource.embed_url) {
          return (
            <EmbedViewer
              key="embed"
              url={resource.embed_url}
              title={resource.embed_title}
            />
          );
        }
        if (type === 'file') {
          // ── PDF viewer ──
          if (resource.file_type === 'pdf') {
            if (hasRealFile) {
              return <RealPdfViewer key="file" url={effectiveFileUrl} title={resource.title} />;
            }
            return <InlineSimulatedPages key="file" resource={resource} />;
          }

          // ── Slides viewer ──
          if (resource.file_type === 'slides') {
            return <InlineSlidesViewer key="file" resource={resource} />;
          }

          // ── Simulation viewer ──
          if (resource.file_type === 'simulation') {
            return <InlineSimulationViewer key="file" resource={resource} hasRealFile={hasRealFile} />;
          }

          // ── Generic fallback ──
          return (
            <div key="file" className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
              <div className="w-16 h-16 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 mx-auto mb-4">
                <i className="ri-file-text-line text-3xl" />
              </div>
              <p className="text-base font-medium text-slate-700 mb-1">Document</p>
              <p className="text-sm text-slate-400 mb-4">{resource.title}</p>
              {hasRealFile && (
                <a
                  href={effectiveFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <i className="ri-external-link-line" />
                  Ouvrir le fichier
                </a>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}