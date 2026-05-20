import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/useCategories';
import { getTypeConfig } from '@/lib/typeConfig';
import { resizeAndCropImage } from '@/lib/imageUtils';

interface FormData {
  title: string;
  school_level: string;
  unit: string;
  type: string;
  objectives: string;
  competencies: string;
  duration: string;
  file_name: string;
  youtube_url: string;
  embed_url: string;
  embed_title: string;
}


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

// Helper: get accessible URL from Supabase Storage.
// Prefer public URL (serves inline, no download disposition).
// Fall back to signed URL only if public is not available.
async function getAccessibleStorageUrl(bucket: string, path: string): Promise<string | null> {
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  if (publicData?.publicUrl) return publicData.publicUrl;
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    // ignore
  }
  return null;
}

export default function ResourceAdd() {
  const { user } = useAuth();
  const currentUserId = user?.id || 't1';
  const { levels, types, unitsByParentSlug, typeLabelMap, loading: categoriesLoading } = useCategories();

  const [formData, setFormData] = useState<FormData>({
    title: '',
    school_level: '',
    unit: '',
    type: '',
    objectives: '',
    competencies: '',
    duration: '',
    file_name: '',
    youtube_url: '',
    embed_url: '',
    embed_title: '',
  });

  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string>('');
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE_MB = 50;

  const currentLevelSlug = levels.find((l) => l.name === formData.school_level)?.slug || '';
  const availableUnits = unitsByParentSlug(currentLevelSlug);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim() || formData.title.length < 5) {
      newErrors.title = 'Le titre doit contenir au moins 5 caractères.';
    }
    if (!formData.school_level) {
      newErrors.school_level = 'Veuillez sélectionner un niveau scolaire.';
    }
    if (!formData.unit) {
      newErrors.unit = "Veuillez sélectionner une unité d'apprentissage.";
    }
    if (!formData.type) {
      newErrors.type = 'Veuillez sélectionner un type de ressource.';
    }
    if (!formData.objectives.trim() || formData.objectives.length < 20) {
      newErrors.objectives = 'Les objectifs doivent contenir au moins 20 caractères.';
    }
    if (!formData.competencies.trim() || formData.competencies.length < 10) {
      newErrors.competencies = 'Veuillez décrire les compétences visées.';
    }
    if (!formData.duration) {
      newErrors.duration = 'Veuillez sélectionner une durée estimée.';
    }
    const hasContent = !!selectedFile || extractYouTubeId(formData.youtube_url) || formData.embed_url.trim();
    if (!hasContent) {
      newErrors.file = 'Veuillez ajouter un fichier, une vidéo YouTube ou une ressource externe.';
    }
    if (formData.youtube_url.trim() && !extractYouTubeId(formData.youtube_url)) {
      newErrors.youtube_url = "L'URL YouTube semble invalide.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, selectedFile]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'school_level') {
        next.unit = '';
      }
      return next;
    });
    if (errors?.[field]) {
      setErrors((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    setSubmitError(null);
  };

  // ... existing code ... (handleAddKeyword, handleKeywordKeyDown, removeKeyword, file handlers)

  const handleAddKeyword = () => {
    const raw = keywordInput.trim().toLowerCase();
    if (!raw) return;
    const parts = raw.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
    const newKeywords = parts.filter((p) => !keywords.includes(p));
    if (newKeywords.length > 0) {
      setKeywords((prev) => [...prev, ...newKeywords].slice(0, 15));
    }
    setKeywordInput('');
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCoverImageSelect = () => coverInputRef.current?.click();

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSubmitError('Veuillez sélectionner une image (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('L\'image de couverture ne doit pas dépasser 5 Mo.');
      return;
    }
    setCoverImage(file);
    setCoverImagePreview(URL.createObjectURL(file));
    setSubmitError(null);
  };

  const handleRemoveCoverImage = () => {
    setCoverImage(null);
    setCoverImagePreview('');
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setSubmitError(`Le fichier dépasse la limite de ${MAX_FILE_SIZE_MB} Mo.`);
        return;
      }
      setFileSelected(true);
      setSelectedFile(file);
      setFormData((prev) => ({ ...prev, file_name: file.name }));
      setErrors((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        delete next.file;
        return next;
      });
      setSubmitError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setSubmitError(`Le fichier dépasse la limite de ${MAX_FILE_SIZE_MB} Mo.`);
        return;
      }
      setFileSelected(true);
      setSelectedFile(file);
      setFormData((prev) => ({ ...prev, file_name: file.name }));
      setErrors((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        delete next.file;
        return next;
      });
      setSubmitError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      const firstError = document.querySelector('[data-error="true"]');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    setSubmitError(null);

    let fileUrl = '';
    let fileType = formData.file_name.split('.').pop()?.toLowerCase() || 'pdf';

    let coverImageUrl = '';

    // ── Resize & upload cover image ──
    if (coverImage) {
      try {
        setUploadProgress(5);
        const { blob: resizedBlob, mimeType } = await resizeAndCropImage(coverImage, 16 / 9, 1200, 0.85);
        const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
        const safeCoverName = `cover_${Date.now()}.${ext}`;
        const coverPath = `${currentUserId}/covers/${safeCoverName}`;

        const { error: coverUploadError } = await supabase.storage
          .from('resources')
          .upload(coverPath, resizedBlob, {
            cacheControl: '3600',
            upsert: false,
            contentType: mimeType,
          });

        if (coverUploadError) {
          throw new Error(coverUploadError.message || "Échec de l'upload de l'image");
        }

        const accessibleUrl = await getAccessibleStorageUrl('resources', coverPath);
        if (!accessibleUrl) {
          throw new Error("Impossible de récupérer l'URL publique de l'image. Le bucket 'resources' est probablement privé - applique la migration 0006.");
        }
        coverImageUrl = accessibleUrl;
      } catch (err) {
        // Surface the error visibly instead of swallowing it. Most common
        // cause is missing storage bucket or RLS policy.
        const msg = err instanceof Error ? err.message : String(err);
        setSubmitError(
          `Échec de l'upload de l'image de couverture : ${msg}. ` +
          `Vérifie que le bucket "resources" existe et accepte tes uploads (migration 0006).`
        );
        setIsSubmitting(false);
        setUploadProgress(0);
        return;
      }
    }

    // ── Upload file to Supabase Storage ──
    if (selectedFile) {
      try {
        setUploadProgress(20);
        const safeName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = `${currentUserId}/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('resources')
          .upload(path, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message || "Échec de l'upload du fichier");
        }

        setUploadProgress(60);

        // Get signed URL (works even if bucket is private)
        const accessibleUrl = await getAccessibleStorageUrl('resources', path);
        if (accessibleUrl) {
          fileUrl = accessibleUrl;
        }
        setUploadProgress(80);
      } catch (err) {
        setIsSubmitting(false);
        setUploadProgress(0);
        setSubmitError(
          err instanceof Error
            ? `Erreur lors de l'upload : ${err.message}`
            : "Erreur lors de l'upload du fichier."
        );
        return;
      }
    }

    try {
      const { error } = await supabase.from('resources').insert({
        title: formData.title.trim(),
        school_level: formData.school_level,
        unit: formData.unit,
        type: formData.type,
        type_label: typeLabelMap[formData.type] || formData.type,
        subject: user?.specialty || null,
        objectives: formData.objectives.trim(),
        competencies: formData.competencies.trim(),
        duration: formData.duration,
        keywords,
        file_name: formData.file_name,
        file_url: fileUrl,
        file_type: fileType,
        youtube_url: formData.youtube_url.trim() || null,
        embed_url: formData.embed_url.trim() || null,
        embed_title: formData.embed_title.trim() || null,
        cover_image_url: coverImageUrl || null,
        status: 'not_evaluated',
        status_label: 'Non évalué',
        author_id: currentUserId,
        views: 0,
        downloads: 0,
        comments_count: 0,
      });

      if (error) {
        if (
          error.code === '42501' ||
          error.message?.toLowerCase().includes('policy') ||
          error.message?.toLowerCase().includes('permission')
        ) {
          throw new Error(
            'Authentification requise pour publier une ressource. Reconnecte-toi et réessaye.'
          );
        }
        throw error;
      }

      setUploadProgress(100);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Une erreur est survenue lors de l'enregistrement."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: '',
      school_level: '',
      unit: '',
      type: '',
      objectives: '',
      competencies: '',
      duration: '',
      file_name: '',
      youtube_url: '',
      embed_url: '',
      embed_title: '',
    });
    setKeywords([]);
    setKeywordInput('');
    setErrors(undefined);
    setSubmitted(false);
    setSubmitError(null);
    setFileSelected(false);
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (submitted) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-xl border border-slate-200 p-8 md:p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
              <div className="w-10 h-10 flex items-center justify-center">
                <i className="ri-check-line text-3xl text-emerald-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-3">Ressource soumise avec succès</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-2">
              Votre ressource <strong className="text-slate-700 dark:text-slate-200">"{formData.title}"</strong> a été publiée avec succès.
            </p>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-8">
              Elle est maintenant en attente d'attribution de reviewers pour le processus de peer reviewing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/ressources"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-sharek-600 text-white rounded-lg font-medium text-sm hover:bg-sharek-700 transition-colors whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-folder-line" />
                </div>
                Voir mes ressources
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-add-line" />
                </div>
                Ajouter une autre ressource
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link to="/" className="text-slate-400 hover:text-sharek-600 transition-colors">
            Tableau de bord
          </Link>
          <div className="w-4 h-4 flex items-center justify-center text-slate-300">
            <i className="ri-arrow-right-s-line" />
          </div>
          <Link to="/ressources" className="text-slate-400 hover:text-sharek-600 transition-colors">
            Ressources
          </Link>
          <div className="w-4 h-4 flex items-center justify-center text-slate-300">
            <i className="ri-arrow-right-s-line" />
          </div>
          <span className="text-slate-600 font-medium">Ajouter une ressource</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Ajouter une ressource</h1>
          <p className="text-slate-500">
            Partagez votre ressource pédagogique avec la communauté ShareK. Elle sera soumise au processus de peer
            reviewing avant publication.
          </p>
        </div>

        {submitError && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center text-rose-500 mt-0.5">
              <i className="ri-error-warning-line" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-rose-700">Erreur d'enregistrement</p>
              <p className="text-sm text-rose-600 mt-0.5">{submitError}</p>
            </div>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="w-6 h-6 flex items-center justify-center text-rose-400 hover:text-rose-600"
            >
              <i className="ri-close-line" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Informations générales */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sharek-50 flex items-center justify-center">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-information-line text-sharek-600" />
                </div>
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Informations générales</h2>
                <p className="text-xs text-slate-400">Titre, niveau, unité et type de la ressource</p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Titre de la ressource <span className="text-rose-500">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Ex: Cours complet sur la photosynthèse"
                  maxLength={200}
                  data-error={!!errors?.title}
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-white placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-sharek-500/20 ${
                    errors?.title
                      ? 'border-rose-300 focus:border-rose-400'
                      : 'border-slate-200 focus:border-sharek-400'
                  }`}
                />
                <div className="flex items-center justify-between mt-1">
                  {errors?.title ? <span className="text-xs text-rose-500">{errors.title}</span> : <span />}
                  <span className="text-xs text-slate-400">{formData.title.length}/200</span>
                </div>
              </div>

              {/* School Level + Unit row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="school_level" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Niveau scolaire <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="school_level"
                      name="school_level"
                      value={formData.school_level}
                      onChange={(e) => handleChange('school_level', e.target.value)}
                      disabled={categoriesLoading}
                      data-error={!!errors?.school_level}
                      className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-white appearance-none transition-colors focus:outline-none focus:ring-2 focus:ring-sharek-500/20 ${
                        errors?.school_level
                          ? 'border-rose-300 focus:border-rose-400'
                          : 'border-slate-200 focus:border-sharek-400'
                      }`}
                    >
                      <option value="">Sélectionner un niveau</option>
                      {levels.map((level) => (
                        <option key={level.slug} value={level.name}>
                          {level.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none text-slate-400">
                      <i className="ri-arrow-down-s-line" />
                    </div>
                  </div>
                  {errors?.school_level && (
                    <span className="text-xs text-rose-500 mt-1 block">{errors.school_level}</span>
                  )}
                </div>

                <div>
                  <label htmlFor="unit" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Unité d'apprentissage <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="unit"
                      name="unit"
                      value={formData.unit}
                      onChange={(e) => handleChange('unit', e.target.value)}
                      disabled={!formData.school_level || categoriesLoading}
                      data-error={!!errors?.unit}
                      className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-white appearance-none transition-colors focus:outline-none focus:ring-2 focus:ring-sharek-500/20 ${
                        !formData.school_level
                          ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200'
                          : errors?.unit
                            ? 'border-rose-300 focus:border-rose-400'
                            : 'border-slate-200 focus:border-sharek-400'
                      }`}
                    >
                      <option value="">
                        {!formData.school_level ? "Choisir d'abord un niveau" : 'Sélectionner une unité'}
                      </option>
                      {availableUnits.map((unit) => (
                        <option key={unit.slug} value={unit.name}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none text-slate-400">
                      <i className="ri-arrow-down-s-line" />
                    </div>
                  </div>
                  {errors?.unit && <span className="text-xs text-rose-500 mt-1 block">{errors.unit}</span>}
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type <span className="text-rose-500">*</span></label>
                {errors?.type && <span className="text-xs text-rose-500 mb-2 block" data-error="true">{errors.type}</span>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {types.map((rt) => {
                    const selected = formData.type === rt.slug;
                    const config = getTypeConfig(rt.slug, rt.name);
                    return (
                      <button
                        key={rt.slug} type="button"
                        onClick={() => handleChange('type', rt.slug)}
                        title={config.label}
                        className={`flex items-center gap-2 md:gap-2.5 px-2.5 md:px-3 py-2.5 md:py-3 rounded-lg border text-sm font-medium transition-all text-left overflow-hidden ${selected ? `ring-2 ring-sharek-400 ring-offset-1 ${config.bg} ${config.text} ${config.border}` : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center flex-shrink-0 ${selected ? 'bg-white/60' : 'bg-slate-100'}`}>
                          <div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center"><i className={`${config.icon} ${selected ? 'text-current' : 'text-slate-500'}`} /></div>
                        </div>
                        <span className="leading-tight min-w-0 flex-1 truncate">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
                <input type="hidden" name="type" value={formData.type} />
              </div>
            </div>
          </div>

          {/* Section 1.5: Image de couverture */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-image-line text-pink-600" /></div>
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Image de couverture</h2>
                <p className="text-xs text-slate-400">Visuel illustrant votre ressource (optionnel)</p>
              </div>
            </div>
            <div className="p-6">
              {coverImagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 mb-3">
                  <img
                    src={coverImagePreview}
                    alt="Aperçu de la couverture"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveCoverImage}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                    title="Supprimer l'image"
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>
              ) : null}
              <div
                onClick={handleCoverImageSelect}
                className="relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
              >
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCoverImageChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <div className="w-5 h-5 flex items-center justify-center"><i className="ri-image-add-line text-lg text-slate-400" /></div>
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-0.5">{coverImagePreview ? 'Changer l\'image' : 'Ajouter une image de couverture'}</p>
                  <p className="text-xs text-slate-400">Recadrage automatique 16:9 - JPG, PNG, WEBP - Max 5 Mo</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Document */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-file-upload-line text-amber-600" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-slate-800">Document</h2>
                <p className="text-xs text-slate-400">Fichier PDF, Diaporama, Simulation ou autre (optionnel si vous ajoutez une vidéo ou un embed)</p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                Uncollectable
              </span>
            </div>
            <div className="p-6">
              <div
                onClick={handleFileSelect}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                data-error={!!errors?.file}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-sharek-400 bg-sharek-50/50'
                    : errors?.file
                      ? 'border-rose-300 bg-rose-50/30'
                      : fileSelected
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.pptx,.ppt,.html,.zip,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {fileSelected ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <i className="ri-file-check-line text-xl text-emerald-600" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-700 mb-1">{formData.file_name}</p>
                    <p className="text-xs text-slate-400">
                      {selectedFile ? `(${(selectedFile.size / 1024 / 1024).toFixed(2)} Mo)` : ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Cliquez pour changer de fichier</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <i className="ri-upload-cloud-2-line text-xl text-slate-400" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Glissez-déposez votre fichier ici</p>
                    <p className="text-xs text-slate-400 mb-2">ou cliquez pour parcourir</p>
                    <p className="text-[11px] text-slate-400">PDF, PPTX, HTML, ZIP - Max 50 Mo</p>
                  </div>
                )}
              </div>
              {errors?.file && <span className="text-xs text-rose-500 mt-2 block">{errors.file}</span>}
              <input type="hidden" name="file_name" value={formData.file_name} />
            </div>
          </div>

          {/* Section 2.5: Contenu multimédia */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-movie-line text-rose-600" /></div>
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Contenu multimédia</h2>
                <p className="text-xs text-slate-400">Vidéo YouTube ou ressource externe intégrée</p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* YouTube */}
              <div>
                <label htmlFor="youtube_url" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Vidéo YouTube
                </label>
                <input
                  id="youtube_url"
                  name="youtube_url"
                  type="url"
                  value={formData.youtube_url}
                  onChange={(e) => handleChange('youtube_url', e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                  data-error={!!errors?.youtube_url}
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-white placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-sharek-500/20 ${
                    errors?.youtube_url
                      ? 'border-rose-300 focus:border-rose-400'
                      : 'border-slate-200 focus:border-sharek-400'
                  }`}
                />
                {errors?.youtube_url ? (
                  <span className="text-xs text-rose-500 mt-1 block">{errors.youtube_url}</span>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">
                    Collez l&apos;URL de partage de la vidéo YouTube. Elle sera intégrée sans branding visible.
                  </p>
                )}
              </div>

              {/* Embed */}
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label htmlFor="embed_url" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Ressource externe (iframe)
                  </label>
                  <input
                    id="embed_url"
                    name="embed_url"
                    type="url"
                    value={formData.embed_url}
                    onChange={(e) => handleChange('embed_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm bg-white placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-sharek-500/20 focus:border-sharek-400"
                  />
                  <p className="text-xs text-slate-400 mt-1">URL d&apos;une ressource à intégrer directement (Genially, Padlet, H5P...)</p>
                </div>
                {formData.embed_url.trim() && (
                  <div>
                    <label htmlFor="embed_title" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Titre de la ressource externe
                    </label>
                    <input
                      id="embed_title"
                      name="embed_title"
                      type="text"
                      value={formData.embed_title}
                      onChange={(e) => handleChange('embed_title', e.target.value)}
                      placeholder="Ex: Activité interactive sur la photosynthèse"
                      maxLength={120}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm bg-white placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-sharek-500/20 focus:border-sharek-400"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Contenu pédagogique */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-book-line text-violet-600" />
                </div>
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Contenu pédagogique</h2>
                <p className="text-xs text-slate-400">Objectifs, compétences et durée</p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Objectives */}
              <div>
                <label htmlFor="objectives" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Objectifs d'apprentissage <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="objectives"
                  name="objectives"
                  value={formData.objectives}
                  onChange={(e) => handleChange('objectives', e.target.value)}
                  placeholder="Décrivez ce que les élèves devront savoir faire après avoir utilisé cette ressource..."
                  rows={4}
                  maxLength={1000}
                  data-error={!!errors?.objectives}
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-white placeholder-slate-400 transition-colors resize-none focus:outline-none focus:ring-2 focus:ring-sharek-500/20 ${
                    errors?.objectives
                      ? 'border-rose-300 focus:border-rose-400'
                      : 'border-slate-200 focus:border-sharek-400'
                  }`}
                />
                <div className="flex items-center justify-between mt-1">
                  {errors?.objectives ? (
                    <span className="text-xs text-rose-500">{errors.objectives}</span>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-slate-400">{formData.objectives.length}/1000</span>
                </div>
              </div>

              {/* Competencies */}
              <div>
                <label htmlFor="competencies" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Compétences visées <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="competencies"
                  name="competencies"
                  value={formData.competencies}
                  onChange={(e) => handleChange('competencies', e.target.value)}
                  placeholder="Ex: Raisonnement scientifique, analyse de documents, manipulation en laboratoire..."
                  rows={3}
                  maxLength={500}
                  data-error={!!errors?.competencies}
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-white placeholder-slate-400 transition-colors resize-none focus:outline-none focus:ring-2 focus:ring-sharek-500/20 ${
                    errors?.competencies
                      ? 'border-rose-300 focus:border-rose-400'
                      : 'border-slate-200 focus:border-sharek-400'
                  }`}
                />
                <div className="flex items-center justify-between mt-1">
                  {errors?.competencies ? (
                    <span className="text-xs text-rose-500">{errors.competencies}</span>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-slate-400">{formData.competencies.length}/500</span>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Durée estimée <span className="text-rose-500">*</span>
                </label>
                <input
                  id="duration"
                  name="duration"
                  type="text"
                  value={formData.duration}
                  onChange={(e) => handleChange('duration', e.target.value)}
                  placeholder="Ex: 1 heure 30, 2 séances de 50 min, séquence complète..."
                  data-error={!!errors?.duration}
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-sharek-500/20 ${
                    errors?.duration
                      ? 'border-rose-300 focus:border-rose-400'
                      : 'border-slate-200 focus:border-sharek-400'
                  }`}
                />
                {errors?.duration && (
                  <span className="text-xs text-rose-500 mt-1 block">{errors.duration}</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Mots-clés */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-hashtag text-pink-600" />
                </div>
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Mots-clés</h2>
                <p className="text-xs text-slate-400">Facilitez la découverte de votre ressource</p>
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-2 mb-3">
                {keywords.map((kw, idx) => (
                  <span
                    key={`${kw}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sharek-50 text-sharek-700 text-sm font-medium border border-sharek-100"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(idx)}
                      className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-sharek-100 transition-colors"
                    >
                      <i className="ri-close-line text-xs" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  placeholder="Ajouter un mot-clé (Entrée ou virgule)"
                  maxLength={30}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm bg-white placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-sharek-500/20 focus:border-sharek-400"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  disabled={!keywordInput.trim() || keywords.length >= 15}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  Ajouter
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {keywords.length}/15 mots-clés - Ex: photosynthèse, cellule, génétique...
              </p>
            </div>
          </div>

          {/* Progress bar during upload */}
          {isSubmitting && uploadProgress > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Envoi en cours...</span>
                <span className="text-xs text-slate-500">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sharek-500 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 pb-10">
            <p className="text-xs text-slate-400">
              <span className="text-rose-500">*</span> Champs obligatoires
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Réinitialiser
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-sharek-600 text-white text-sm font-medium hover:bg-sharek-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 flex items-center justify-center animate-spin">
                      <i className="ri-loader-4-line" />
                    </div>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-check-line" />
                    </div>
                    Soumettre la ressource
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}