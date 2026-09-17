-- ============================================================
-- Lignes de test pour le tableau de bord — À LANCER PAR L'UTILISATEUR
-- Supabase → SQL Editor → coller → Run.
-- ============================================================
-- Six réponses choisies pour couvrir les cas qui cassent un tableau
-- de bord :
--   . plusieurs classes, maternelle ET élémentaire, pour le filtre
--   . deux classes avec DEUX réponses (CE1) pour vérifier une moyenne
--     qui ne tombe pas juste
--   . suggestions NULL     (lignes 2 et 6)
--   . points_forts NULL    (lignes 3 et 6)
--   . parent anonyme, nom ET prénom NULL (lignes 2 et 5)
--   . recommande false     (lignes 2 et 5)
-- ============================================================

-- FACULTATIF — supprime la ligne de test restée de la mise au point du
-- mail (Seynabou, Grande section). Décommente si tu veux repartir net ;
-- sinon elle restera dans les totaux, et j'en tiendrai compte.
-- DELETE FROM public.enquetes_parents WHERE enfant_prenom = 'Seynabou';

INSERT INTO public.enquetes_parents
  (parent_prenom, parent_nom, enfant_prenom, classe,
   note_pedagogie, note_communication, note_encadrement, note_locaux,
   recommande, points_forts, suggestions)
VALUES
  ('Fatou', 'Ndiaye', 'Aminata', 'Moyenne section',
   5, 4, 4, 2, true,
   'Les maîtresses sont très patientes avec les petits.',
   'La cour manque d''ombre entre 13h et 15h.'),

  (NULL, NULL, 'Ibrahima', 'CE1',
   3, 3, 5, 2, false,
   'Le suivi scolaire est sérieux.',
   NULL),

  ('Awa', 'Sow', 'Khadija', 'CE1',
   4, 5, 3, 1, true,
   NULL,
   'Prévoir un point cantine une fois par trimestre.'),

  ('Omar', 'Ba', 'Moussa', 'CP',
   5, 5, 4, 3, true,
   'Mon fils a beaucoup progressé en lecture.',
   'Plus de sorties pédagogiques.'),

  (NULL, NULL, 'Fatou', 'Grande section',
   2, 4, 4, 4, false,
   'L''accueil du matin est bien organisé.',
   'La communication sur les devoirs est à revoir.'),

  ('Mame Diarra', 'Fall', 'Cheikh', 'CM2',
   4, 3, 5, 2, true,
   NULL,
   NULL);
