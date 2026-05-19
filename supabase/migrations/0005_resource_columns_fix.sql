-- =====================================================================
-- ShareK — Migration 0005
-- Ajoute les colonnes optionnelles que le front utilise mais qui peuvent
-- manquer dans le schéma initial.
-- =====================================================================

-- Cover image (utilisée par /mes-favoris, /ressources/modifier, /ressources/ajouter)
alter table public.resources
  add column if not exists cover_image_url text;

-- Embed YouTube / external iframe (utilisé par DocumentViewer)
alter table public.resources
  add column if not exists youtube_url text,
  add column if not exists embed_url text,
  add column if not exists embed_title text;

-- file_name (référencé par ressource-modifier)
alter table public.resources
  add column if not exists file_name text;

-- description (référencé par ressource-detail)
alter table public.resources
  add column if not exists description text;

-- Vérification : afficher la liste des colonnes
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'resources'
  and column_name in ('cover_image_url', 'youtube_url', 'embed_url', 'embed_title', 'file_name', 'description');
