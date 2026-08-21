-- ICC LE MANS — V67 — à exécuter dans Supabase > SQL Editor
-- Table unique de stockage de l'état de l'application (poles, members, programs, solicitations, settings).
-- La colonne "data" est en JSONB : le réagencement de l'accueil / Pilotage (regroupement de
-- Modèles, Checklists, Disponibilités, Recherche, Historique et Archives dans un seul bloc
-- "Outils de pilotage") ne modifie AUCUNE structure de données côté base — ce schéma n'a donc
-- pas besoin de nouvelle colonne pour ce changement.

create table if not exists public.icc_app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.icc_app_state enable row level security;

drop policy if exists "authenticated read" on public.icc_app_state;
drop policy if exists "authenticated write" on public.icc_app_state;
drop policy if exists "authenticated update" on public.icc_app_state;

create policy "authenticated read" on public.icc_app_state
  for select to authenticated using (true);

create policy "authenticated write" on public.icc_app_state
  for insert to authenticated with check (true);

create policy "authenticated update" on public.icc_app_state
  for update to authenticated using (true) with check (true);
