/* ============================================================
   POST /api/dashboard-login — ouverture de session du tableau de bord
   ------------------------------------------------------------
   Le site est STATIQUE : Vercel sert les fichiers du dépôt tels quels
   et il n'y a pas de middleware. Une page ne peut donc rien protéger
   par elle-même — c'est cette fonction, et elle seule, qui décide.

   Le mot de passe ne quitte jamais le serveur. La page ne reçoit en
   retour qu'un cookie signé : il prouve « quelqu'un a donné le bon
   mot de passe avant telle heure », rien d'autre. Il ne contient
   aucune donnée d'élève et ne sert à lire aucune table.

   Trois défenses, dans cet ordre :
     1. comparaison à temps constant  — contre l'attaque temporelle
     2. cadence par IP                — contre la force brute
     3. cookie signé HMAC             — contre la falsification
   ============================================================ */

'use strict';

const crypto = require('crypto');

const COOKIE      = 'cocon_dashboard';
const DUREE_S     = 8 * 60 * 60;          // 8 heures, en secondes

/* ------------------------------------------------------------
   Cadence par IP — 5 échecs par quart d'heure, le 6e est refusé
   ------------------------------------------------------------
   Mémoire de l'instance, pas une base : une fonction serverless peut
   tourner en plusieurs exemplaires, donc ce garde-fou est un filet,
   pas une serrure. Il casse une boucle automatique, il ne remplace
   pas un mot de passe solide.

   Seuls les ÉCHECS comptent. Une connexion réussie remet le compteur
   à zéro : la directrice qui se trompe deux fois puis y arrive ne
   doit pas rester pénalisée.
   ------------------------------------------------------------ */

const FENETRE_MS = 15 * 60 * 1000;
const MAX_ECHECS = 5;

const echecs = new Map();   // ip -> number[] (horodatages des échecs)

function recents(ip) {
  const maintenant = Date.now();
  const liste = (echecs.get(ip) || []).filter((t) => maintenant - t < FENETRE_MS);
  if (liste.length) echecs.set(ip, liste); else echecs.delete(ip);
  return liste;
}

function noterEchec(ip) {
  const liste = recents(ip);
  liste.push(Date.now());
  echecs.set(ip, liste);

  // Purge : sans elle, la Map grossit tant que l'instance vit.
  if (echecs.size > 500) {
    const maintenant = Date.now();
    for (const [cle, l] of echecs) {
      if (!l.length || maintenant - l[l.length - 1] > FENETRE_MS) echecs.delete(cle);
    }
  }
}

function adresse(req) {
  const suivi = req.headers['x-forwarded-for'];
  if (typeof suivi === 'string' && suivi) return suivi.split(',')[0].trim();
  if (Array.isArray(suivi) && suivi.length) return String(suivi[0]).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'inconnue';
}

/* ------------------------------------------------------------
   Comparaison à temps constant
   ------------------------------------------------------------
   `a === b` s'arrête au premier caractère qui diffère. Le temps de
   réponse trahit alors le nombre de caractères devinés, et le mot de
   passe se retrouve lettre par lettre.

   `timingSafeEqual` compare toujours l'intégralité — mais il exige
   deux tampons de MÊME longueur, sinon il lève. On compare donc les
   empreintes SHA-256, qui font 32 octets quoi qu'on lui donne : la
   longueur du mot de passe saisi ne fuit pas non plus.
   ------------------------------------------------------------ */

function memeSecret(saisi, attendu) {
  const a = crypto.createHash('sha256').update(String(saisi), 'utf8').digest();
  const b = crypto.createHash('sha256').update(String(attendu), 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

/* ------------------------------------------------------------
   Le cookie de session
   ------------------------------------------------------------
   Forme : <charge>.<signature>, toutes deux en base64url.
   La charge dit seulement quand la session expire. La signature est
   un HMAC-SHA256 de cette charge avec DASHBOARD_SECRET : sans le
   secret, on ne peut ni forger une charge, ni en modifier une.

   L'expiration est DANS la charge signée, pas seulement dans
   l'attribut Max-Age : un navigateur peut garder un cookie expiré et
   le renvoyer, le serveur doit pouvoir le refuser tout seul.
   ------------------------------------------------------------ */

function signer(charge, secret) {
  return crypto.createHmac('sha256', secret).update(charge).digest('base64url');
}

function fabriquerCookie(secret) {
  const charge = Buffer
    .from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + DUREE_S }), 'utf8')
    .toString('base64url');
  return charge + '.' + signer(charge, secret);
}

/* ------------------------------------------------------------
   Réponses
   ------------------------------------------------------------ */

function repondre(res, code, charge) {
  res.status(code);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Une réponse d'authentification ne se met en cache nulle part.
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(charge));
}

async function lireCorps(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  if (!req || typeof req[Symbol.asyncIterator] !== 'function') return null;

  const morceaux = [];
  let taille = 0;
  try {
    for await (const bout of req) {
      taille += bout.length;
      if (taille > 8 * 1024) return null;   // un mot de passe ne pèse pas 8 Ko
      morceaux.push(bout);
    }
  } catch {
    return null;
  }
  if (!morceaux.length) return null;
  try { return JSON.parse(Buffer.concat(morceaux).toString('utf8')); } catch { return null; }
}

/* ------------------------------------------------------------
   Le point d'entrée
   ------------------------------------------------------------ */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    return repondre(res, 204, {});
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return repondre(res, 405, { ok: false, message: 'Méthode non autorisée.' });
  }

  const attendu = process.env.DASHBOARD_MOTDEPASSE;
  const secret  = process.env.DASHBOARD_SECRET;
  if (!attendu || !secret) {
    // On ne raconte pas la configuration du serveur à un visiteur.
    console.error('[DASHBOARD] Configuration absente : DASHBOARD_MOTDEPASSE ou DASHBOARD_SECRET.');
    return repondre(res, 500, { ok: false, message: 'Connexion momentanément indisponible.' });
  }

  const ip = adresse(req);

  // La cadence se vérifie AVANT de toucher au mot de passe : une IP
  // bloquée ne doit même pas obtenir un temps de réponse à mesurer.
  if (recents(ip).length >= MAX_ECHECS) {
    res.setHeader('Retry-After', '900');
    return repondre(res, 429, {
      ok: false,
      message: 'Trop de tentatives. Réessayez dans quinze minutes.'
    });
  }

  const corps = await lireCorps(req);
  const saisi = corps && typeof corps.motdepasse === 'string' ? corps.motdepasse : '';

  if (!saisi || !memeSecret(saisi, attendu)) {
    noterEchec(ip);
    // UN SEUL message pour tous les cas : champ vide, mot de passe faux,
    // corps illisible. Rien ne doit indiquer ce qui cloche — sinon on
    // aide celui qui cherche.
    return repondre(res, 401, { ok: false, message: 'Connexion refusée.' });
  }

  // Réussite : le compteur repart de zéro pour cette adresse.
  echecs.delete(ip);

  res.setHeader('Set-Cookie', [
    COOKIE + '=' + fabriquerCookie(secret),
    'Max-Age=' + DUREE_S,
    'Path=/',
    // HttpOnly : illisible par le JavaScript de la page, donc hors de
    // portée d'une injection de script.
    'HttpOnly',
    // Secure : jamais transmis en clair.
    'Secure',
    // Strict : pas envoyé si la requête vient d'un autre site — c'est
    // ce qui ferme la porte au CSRF.
    'SameSite=Strict'
  ].join('; '));

  return repondre(res, 200, { ok: true });
};
