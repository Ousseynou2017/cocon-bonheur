-- ============================================================
-- Au Cocon Du Bonheur — enquête de satisfaction des parents
-- À coller dans Supabase → SQL Editor → New query → Run.
--
-- Ce script est rejouable : le relancer ne casse rien et n'efface
-- aucune réponse déjà enregistrée.
-- ============================================================

create table if not exists public.enquetes_parents (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),

  -- Facultatifs et assumés : un parent peut répondre sans se nommer.
  -- NULL veut dire « anonyme », pas « oublié ».
  parent_nom         text,
  parent_prenom      text,

  enfant_prenom      text not null,

  -- La liste est l'ordre de progression scolaire. Elle est répétée à
  -- l'identique dans api/enquete.js : si les deux divergent un jour,
  -- c'est Postgres qui refuse la ligne. C'est voulu.
  classe             text not null check (classe in (
                       'Crèche',
                       'Toute petite section',
                       'Petite section',
                       'Moyenne section',
                       'Grande section',
                       'CI',
                       'CP',
                       'CE1',
                       'CE2',
                       'CM1',
                       'CM2'
                     )),

  note_pedagogie     int2 not null check (note_pedagogie     between 1 and 5),
  note_communication int2 not null check (note_communication between 1 and 5),
  note_encadrement   int2 not null check (note_encadrement   between 1 and 5),
  note_locaux        int2 not null check (note_locaux        between 1 and 5),

  recommande         bool not null,

  points_forts       text,
  suggestions        text
);

-- Le tableau de bord de la phase 2 listera les réponses de la plus
-- récente à la plus ancienne. L'index lui évite un tri complet.
create index if not exists enquetes_parents_created_at_idx
  on public.enquetes_parents (created_at desc);

-- ============================================================
-- RLS : verrouillé, et AUCUNE policy.
-- ============================================================
-- Sans policy, toute clé « anon » ou « authenticated » lit zéro ligne
-- et n'en écrit aucune — même en connaissant l'URL du projet.
--
-- Seule la clé `service_role` passe : elle contourne RLS par nature.
-- Elle ne vit QUE dans les variables d'environnement Vercel, côté
-- serveur, et n'est jamais envoyée au navigateur.
--
-- C'est le RLS qui protège la table, pas le fait que la page soit
-- discrète. Vérification ci-dessous.

alter table public.enquetes_parents enable row level security;

-- Ceinture et bretelles : on retire explicitement les droits des rôles
-- exposés au navigateur, au cas où un GRANT large traînerait.
revoke all on public.enquetes_parents from anon, authenticated;


-- ============================================================
-- VÉRIFICATION — à lancer après le premier envoi de test
-- ============================================================
-- 1. RLS bien actif (doit renvoyer une ligne avec rowsecurity = true) :
--
--    select relname, relrowsecurity as rowsecurity
--    from pg_class where relname = 'enquetes_parents';
--
-- 2. Aucune policy (doit renvoyer 0 ligne) :
--
--    select policyname from pg_policies
--    where tablename = 'enquetes_parents';
--
-- 3. Lecture anonyme réellement vide — le seul contrôle qui compte.
--    Depuis un terminal, avec la clé PUBLIABLE (jamais la service_role) :
--
--    curl -s "https://<projet>.supabase.co/rest/v1/enquetes_parents?select=id" \
--         -H "apikey: <cle_publiable>"
--
--    Doit renvoyer [] alors que la table contient des lignes.
--    Si elle renvoie des données, RLS n'est pas actif : tout s'arrête là.
