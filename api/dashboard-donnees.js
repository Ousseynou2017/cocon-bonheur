/* ============================================================
   GET /api/dashboard-donnees — le garde de la porte
   ------------------------------------------------------------
   PASSAGE 1 : cette route ne renvoie AUCUNE réponse de parent. Elle
   ne fait que vérifier le cookie de session et répondre {ok:true}.
   C'est volontaire — on met la serrure avant de mettre quoi que ce
   soit derrière la porte.

   PASSAGE 2 : c'est ici, et nulle part ailleurs, que viendra la
   lecture de la table `enquetes_parents` avec la clé de service.
   Elle vient APRÈS la vérification du cookie, jamais avant. Voir le
   repère « POINT D'ACCROCHE PASSAGE 2 » plus bas.

   Pourquoi une route et pas la page : le site est statique. Le
   fichier /dashboard/index.html est servi à qui le demande, sans
   condition. Tout ce qui doit être protégé doit donc être demandé
   à une fonction, après ce contrôle.
   ============================================================ */

'use strict';

const crypto = require('crypto');

const COOKIE = 'cocon_dashboard';

/* ------------------------------------------------------------
   Lecture du cookie
   ------------------------------------------------------------
   L'en-tête `Cookie` est une liste « nom=valeur » séparée par des
   points-virgules. On ne cherche que le nôtre, et on ne suppose ni
   l'ordre ni les espaces.
   ------------------------------------------------------------ */

function lireCookie(req, nom) {
  const brut = req.headers.cookie;
  if (typeof brut !== 'string' || !brut) return null;
  for (const morceau of brut.split(';')) {
    const egal = morceau.indexOf('=');
    if (egal === -1) continue;
    if (morceau.slice(0, egal).trim() === nom) return morceau.slice(egal + 1).trim();
  }
  return null;
}

/* ------------------------------------------------------------
   Vérification de la signature
   ------------------------------------------------------------
   Le cookie vaut <charge>.<signature>. On recalcule la signature de
   la charge reçue et on compare à temps constant : comparer avec
   `===` laisserait deviner la signature octet par octet.

   Puis on relit l'expiration DANS la charge signée. Un navigateur
   peut très bien renvoyer un cookie que son Max-Age aurait dû
   périmer ; c'est au serveur de trancher, pas à lui.
   ------------------------------------------------------------ */

function sessionValide(req) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    console.error('[DASHBOARD] Configuration absente : DASHBOARD_SECRET.');
    return false;
  }

  const valeur = lireCookie(req, COOKIE);
  if (!valeur) return false;

  const point = valeur.lastIndexOf('.');
  if (point <= 0 || point === valeur.length - 1) return false;

  const charge = valeur.slice(0, point);
  const signee = valeur.slice(point + 1);

  const attendue = crypto.createHmac('sha256', secret).update(charge).digest('base64url');

  // timingSafeEqual lève si les longueurs diffèrent : on le devance,
  // une longueur qui ne colle pas est de toute façon un refus.
  const a = Buffer.from(signee, 'utf8');
  const b = Buffer.from(attendue, 'utf8');
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;

  let contenu;
  try {
    contenu = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  if (!contenu || typeof contenu.exp !== 'number') return false;

  return contenu.exp > Math.floor(Date.now() / 1000);
}

/* ------------------------------------------------------------
   Les référentiels
   ------------------------------------------------------------
   Même liste, même ordre que la contrainte CHECK de la table et que
   la route d'enquête : c'est l'ordre de progression scolaire, et il
   sert aussi à valider le filtre reçu du navigateur.
   ------------------------------------------------------------ */

const CLASSES = [
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
];

const AXES = [
  ['pedagogie',     'note_pedagogie',     'Pédagogie'],
  ['communication', 'note_communication', 'Communication'],
  ['encadrement',   'note_encadrement',   'Encadrement'],
  ['locaux',        'note_locaux',        'Locaux']
];

// Une école de ce format n'atteindra pas ce chiffre. Il est là pour
// qu'une requête ne parte jamais sans borne, pas pour limiter l'usage.
const PLAFOND_LIGNES = 5000;

/* ------------------------------------------------------------
   Les calculs — ils se font ICI, jamais dans le navigateur
   ------------------------------------------------------------
   Deux règles tenues partout :

   1. Un champ vide n'est pas un zéro. Une note absente ou illisible
      sort de la moyenne, numérateur ET dénominateur. Sinon une seule
      valeur manquante tire toute la moyenne vers le bas et on croit
      à un problème qui n'existe pas.

   2. Une moyenne sans réponse n'existe pas. Zéro réponse renvoie
      `null`, pas `0` : afficher « 0,0 / 5 » sur une table vide, ce
      serait annoncer la pire note possible alors qu'on ne sait rien.
      La page rend un tiret. Le COMPTE, lui, vaut bien 0.
   ------------------------------------------------------------ */

// `Number(null)` vaut 0, et 0 est un nombre fini : passer par Number()
// seul ferait entrer chaque note absente dans les moyennes comme un zéro.
// C'est le piège exact contre lequel on se prémunit — d'où ce passage
// obligé, qui rend NaN pour tout ce qui n'est pas une valeur écrite.
function nombre(v) {
  if (v === null || v === undefined || v === '') return NaN;
  return Number(v);
}

function moyenne(valeurs) {
  const bonnes = valeurs.filter((v) => Number.isFinite(v));
  if (!bonnes.length) return null;
  const somme = bonnes.reduce((a, b) => a + b, 0);
  // Une décimale : au-delà, on affiche une précision qu'on n'a pas.
  return Math.round((somme / bonnes.length) * 10) / 10;
}

function resumer(lignes) {
  const total = lignes.length;

  const axes = AXES.map(([cle, colonne, libelle]) => ({
    cle,
    libelle,
    moyenne: moyenne(lignes.map((r) => nombre(r[colonne])))
  }));

  // La moyenne globale porte sur les quatre notes de chaque réponse,
  // pas sur la moyenne des quatre moyennes : avec des valeurs
  // manquantes, les deux ne donnent pas le même résultat.
  const toutesLesNotes = [];
  for (const r of lignes) {
    for (const [, colonne] of AXES) toutesLesNotes.push(nombre(r[colonne]));
  }

  // Seules les lignes où `recommande` est bien un booléen comptent, au
  // numérateur comme au dénominateur.
  const avis = lignes.map((r) => r.recommande).filter((v) => typeof v === 'boolean');
  const pourRecommande = avis.length
    ? Math.round((avis.filter(Boolean).length / avis.length) * 100)
    : null;

  // L'axe le plus faible est le seul chiffre qui dit quoi corriger.
  // En cas d'égalité, le premier dans l'ordre de la liste.
  const notes = axes.map((a) => a.moyenne).filter((v) => v !== null);
  const plusFaible = notes.length
    ? (axes.find((a) => a.moyenne === Math.min.apply(null, notes)) || {}).cle
    : null;

  return {
    total,
    moyenneGlobale: moyenne(toutesLesNotes),
    pourcentageRecommande: pourRecommande,
    nombreRecommande: avis.filter(Boolean).length,
    axes,
    axeLePlusFaible: plusFaible
  };
}

/* Une réponse telle qu'elle part vers la page. Les champs facultatifs
   restent à `null` — on ne les remplace pas par une chaîne vide, qui
   ne se distinguerait plus d'une vraie réponse vide. C'est la page qui
   écrit « non renseigné », au même endroit pour l'affichage et pour
   l'export. Les textes partent ENTIERS, jamais coupés. */
function presenter(r) {
  const vide = (v) => (typeof v === 'string' && v.trim() ? v : null);
  return {
    id:            r.id || null,
    date:          r.created_at || null,
    parent_nom:    vide(r.parent_nom),
    parent_prenom: vide(r.parent_prenom),
    enfant_prenom: vide(r.enfant_prenom),
    classe:        vide(r.classe),
    notes: {
      pedagogie:     Number.isFinite(nombre(r.note_pedagogie))     ? nombre(r.note_pedagogie)     : null,
      communication: Number.isFinite(nombre(r.note_communication)) ? nombre(r.note_communication) : null,
      encadrement:   Number.isFinite(nombre(r.note_encadrement))   ? nombre(r.note_encadrement)   : null,
      locaux:        Number.isFinite(nombre(r.note_locaux))        ? nombre(r.note_locaux)        : null
    },
    recommande:   typeof r.recommande === 'boolean' ? r.recommande : null,
    points_forts: vide(r.points_forts),
    suggestions:  vide(r.suggestions)
  };
}

function repondre(res, code, charge) {
  res.status(code);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Les réponses des parents ne doivent jamais être mises en cache,
  // ni par le navigateur ni par un intermédiaire.
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(charge));
}

/* ------------------------------------------------------------
   Le point d'entrée
   ------------------------------------------------------------ */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET');
    return repondre(res, 204, {});
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return repondre(res, 405, { ok: false, message: 'Méthode non autorisée.' });
  }

  if (!sessionValide(req)) {
    // Message générique : cookie absent, signature fausse ou session
    // expirée se répondent tous pareil.
    return repondre(res, 401, { ok: false, message: 'Session invalide ou expirée.' });
  }

  /* ---------- PASSAGE 2 : la lecture ----------
     La session est vérifiée, et SEULEMENT maintenant on va chercher les
     réponses. SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY ne sortent
     jamais de ce fichier : la page, elle, ne reçoit que des nombres et
     du texte déjà calculés.
     --------------------------------------------- */

  const url = process.env.SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    console.error('[DASHBOARD] Configuration absente : SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.');
    return repondre(res, 500, { ok: false, message: 'Lecture momentanément indisponible.' });
  }

  // Le filtre de classe est appliqué EN MÉMOIRE, pas dans la requête :
  // aucune valeur venue du navigateur ne se retrouve dans l'URL envoyée à
  // PostgREST. Et de toute façon les chiffres globaux ont besoin de
  // toutes les lignes, filtre ou pas.
  const demandee = typeof req.query?.classe === 'string' ? req.query.classe : '';
  const classe   = CLASSES.includes(demandee) ? demandee : null;

  let reponse;
  try {
    reponse = await fetch(
      url.replace(/\/+$/, '') +
      '/rest/v1/enquetes_parents?select=*&order=created_at.desc&limit=' + PLAFOND_LIGNES,
      {
        headers: {
          apikey: cle,
          Authorization: 'Bearer ' + cle,
          // count=exact fait renvoyer le total réel dans Content-Range :
          // c'est le seul moyen de savoir si le plafond a coupé quelque
          // chose, et donc si les moyennes portent sur tout.
          Prefer: 'count=exact'
        },
        signal: AbortSignal.timeout(8000)
      }
    );
  } catch (e) {
    console.error('[DASHBOARD] Supabase injoignable :', e && e.name, e && e.message);
    return repondre(res, 502, { ok: false, message: 'La lecture des réponses a échoué.' });
  }

  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => '');
    console.error('[DASHBOARD] Lecture refusée', reponse.status, detail.slice(0, 300));
    return repondre(res, 502, { ok: false, message: 'La lecture des réponses a échoué.' });
  }

  const lignes = await reponse.json().catch(() => []);
  const toutes = Array.isArray(lignes) ? lignes : [];

  // Content-Range vaut « 0-23/24 ». Si le total dépasse ce qu'on a reçu,
  // les moyennes seraient fausses sans qu'on le voie : on le journalise.
  const plage = reponse.headers.get('content-range') || '';
  const total = Number((plage.split('/')[1] || '').trim());
  if (Number.isFinite(total) && total > toutes.length) {
    console.error('[DASHBOARD] Plafond atteint :', toutes.length, 'lignes lues sur', total,
                  '— les moyennes ne portent pas sur tout.');
  }

  const filtrees = classe ? toutes.filter((r) => r.classe === classe) : toutes;

  return repondre(res, 200, {
    ok: true,
    classes: CLASSES,
    global: resumer(toutes),
    filtre: Object.assign({ classe }, resumer(filtrees)),
    reponses: filtrees.map(presenter)
  });
};
