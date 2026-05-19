import { useState } from 'react';

interface ShareModalProps {
  title: string;
  description: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export default function ShareModal({ title, description, onClose, onToast }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description?.slice(0, 200) || '');

  const shareLinks = [
    {
      name: 'Facebook',
      icon: 'ri-facebook-fill',
      color: 'bg-[#1877F2] hover:bg-[#166fe5]',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'Twitter / X',
      icon: 'ri-twitter-x-fill',
      color: 'bg-black hover:bg-slate-800',
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      name: 'LinkedIn',
      icon: 'ri-linkedin-fill',
      color: 'bg-[#0A66C2] hover:bg-[#0958a8]',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: 'WhatsApp',
      icon: 'ri-whatsapp-fill',
      color: 'bg-[#25D366] hover:bg-[#1fb955]',
      url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      name: 'Email',
      icon: 'ri-mail-fill',
      color: 'bg-slate-600 hover:bg-slate-700',
      url: `mailto:?subject=${encodedTitle}&body=${encodedDesc}%0A%0A${encodedUrl}`,
    },
  ];

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onToast('Lien copié dans le presse-papiers !');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast('Impossible de copier le lien');
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
        onClose();
      } catch {
        // User cancelled share
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm p-5 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-ocean-50 text-ocean-600">
              <i className="ri-share-line text-sm" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Partager cette ressource</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* Native share (mobile) */}
        {navigator.share && (
          <button
            onClick={handleNativeShare}
            className="w-full mb-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-ocean-600 hover:bg-ocean-700 rounded-lg transition-colors"
          >
            <i className="ri-share-forward-line" />
            Partager via mon appareil
          </button>
        )}

        {/* Social grid */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {shareLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 group"
              title={link.name}
            >
              <div
                className={`w-11 h-11 flex items-center justify-center rounded-xl text-white transition-transform group-hover:scale-105 ${link.color}`}
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className={`${link.icon} text-lg`} />
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                {link.name}
              </span>
            </a>
          ))}
        </div>

        {/* Copy link */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 overflow-hidden">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-slate-400">
              <i className="ri-link" />
            </div>
            <span className="truncate">{shareUrl}</span>
          </div>
          <button
            onClick={handleCopyLink}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            <div className="w-3.5 h-3.5 flex items-center justify-center">
              <i className={copied ? 'ri-check-line' : 'ri-file-copy-line'} />
            </div>
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
      </div>
    </div>
  );
}