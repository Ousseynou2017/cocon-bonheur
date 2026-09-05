/* ============================================================
   Au Cocon Du Bonheur — comportements de défilement
   Aucune dépendance, aucun CDN, aucune requête réseau.
   Le site reste entièrement lisible et utilisable si ce fichier ne charge pas :
   sans la classe `js`, les styles retombent sur les entrées CSS d'origine.
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* La classe est posée AVANT tout le reste : c'est elle qui bascule le CSS
     des révélations. Si le script échoue plus bas, on l'aura quand même. */
  root.classList.add('js');

  var entete = document.querySelector('.site-header');
  var compact = false;

  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var maxScroll = function () {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  };

  /* ----------------------------------------------------------
     1. Révélations — pilotées par le TEMPS
     Le défaut que la cliente signalait : `animation-timeline: view()` fait
     avancer l'animation à la vitesse du DOIGT. Un défilement rapide la
     traverse en deux frames, donc le mouvement n'existe plus.
     Ici l'élément déclenche une transition qui dure toujours --m-reveal,
     quelle que soit la vitesse.
     ---------------------------------------------------------- */

  var cibles = document.querySelectorAll('.enter, .enter--pop, .enter--draw');

  function toutRevealer() {
    for (var i = 0; i < cibles.length; i++) cibles[i].classList.add('is-in');
  }

  if (reduce.matches || !('IntersectionObserver' in window)) {
    /* Animations réduites, ou navigateur sans observateur : tout est visible
       immédiatement. Ne jamais laisser du contenu masqué en attente. */
    toutRevealer();
  } else {
    /* Décalage en cascade : les éléments qui apparaissent ENSEMBLE ne partent
       pas tous au même instant. Calculé par rapport aux frères et sœurs, donc
       il suit la mise en page au lieu d'être écrit en dur dans le HTML. */
    var groupes = new Map();
    for (var j = 0; j < cibles.length; j++) {
      var el = cibles[j];
      var parent = el.parentNode;
      var n = groupes.get(parent) || 0;
      groupes.set(parent, n + 1);
      if (n > 0) el.style.setProperty('--d', Math.min(n, 4) * 90 + 'ms');
    }

    var obs = new IntersectionObserver(function (entrees) {
      for (var k = 0; k < entrees.length; k++) {
        var e = entrees[k];
        /* L'entrée REJOUE à chaque passage, dans les deux sens. Avec un
           `unobserve` après le premier passage, redescendre puis remonter
           affichait tout d'un bloc, sans transition — c'est exactement ce que
           la cliente décrivait par « ça s'affiche en rude ».
           On retire donc la classe quand l'élément sort : au retour, il
           rejoue sa course complète. */
        if (e.isIntersecting) e.target.classList.add('is-in');
        else e.target.classList.remove('is-in');
      }
    }, {
      /* Marges HAUTE et BASSE : l'élément se révèle quand il est franchement
         entré dans l'écran, et se réarme seulement quand il en est vraiment
         sorti. Sans la marge du haut, remonter le réarmait au ras du bord et
         la course était déjà finie quand on le voyait. */
      rootMargin: '-6% 0px -10% 0px',
      threshold: 0
    });
    for (var m = 0; m < cibles.length; m++) obs.observe(cibles[m]);

    /* Filet de sécurité : si quoi que ce soit empêche l'observateur de tirer
       (onglet en arrière-plan au chargement, page restaurée depuis le cache),
       rien ne doit rester invisible. */
    window.addEventListener('load', function () {
      setTimeout(function () {
        for (var i = 0; i < cibles.length; i++) {
          var r = cibles[i].getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) cibles[i].classList.add('is-in');
        }
      }, 200);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) toutRevealer(); });
  }

  /* ----------------------------------------------------------
     2. Défilement adouci à la molette
     On ne remplace PAS le défilement natif : on continue d'appeler
     window.scrollTo, donc la barre de défilement, `position: sticky`,
     la recherche dans la page et le clavier fonctionnent normalement.
     Uniquement à la souris : sur mobile le défilement tactile a déjà sa
     propre inertie, et la doubler donne une sensation de flottement.
     ---------------------------------------------------------- */

  var souris = window.matchMedia('(pointer: fine)').matches;
  var cible = window.scrollY;
  var courant = window.scrollY;
  var enCours = false;
  var pilote = false;              /* vrai = c'est NOUS qui déplaçons la page */

  /* 0.075 : à chaque frame on comble 7,5% de la distance restante. Plus la
     valeur est basse, plus la course est longue. Mesuré à 60 fps, un cran de
     molette met ~420ms à se poser — c'est la longue fin de course qui donne la
     sensation « premium », pas la distance parcourue. */
  var LISSAGE = 0.075;
  var FORCE = 0.9;                 /* un cran de molette avance un peu moins loin */

  function frame() {
    var reste = cible - courant;
    if (Math.abs(reste) < 0.35) {
      courant = cible;
      enCours = false;
      pilote = true; window.scrollTo(0, courant); pilote = false;
      return;
    }
    courant += reste * LISSAGE;
    pilote = true; window.scrollTo(0, courant); pilote = false;
    requestAnimationFrame(frame);
  }

  function molette(e) {
    if (e.ctrlKey) return;                       /* zoom navigateur : on ne touche pas */
    if (e.deltaY === 0) return;                  /* défilement horizontal */
    e.preventDefault();
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;              /* delta en lignes */
    else if (e.deltaMode === 2) d *= window.innerHeight;   /* en pages */
    cible = clamp(cible + d * FORCE, 0, maxScroll());
    if (!enCours) { enCours = true; requestAnimationFrame(frame); }
  }

  if (souris && !reduce.matches) {
    window.addEventListener('wheel', molette, { passive: false });
    /* Barre de défilement, clavier, ancre native : on se resynchronise, sinon
       la prochaine molette repartirait d'une position périmée et sauterait. */
    window.addEventListener('scroll', function () {
      if (!pilote && !enCours) { cible = courant = window.scrollY; }
    }, { passive: true });
    window.addEventListener('resize', function () {
      cible = courant = window.scrollY; enCours = false;
    });
  }

  /* ----------------------------------------------------------
     3. Liens d'ancre — trajet mesuré, pas figé
     `scroll-padding-top` en CSS fige un décalage ; or l'en-tête se COMPACTE
     pendant le trajet. On lit donc sa hauteur réelle au moment du clic.
     ---------------------------------------------------------- */

  /* L'en-tête est `sticky` : il occupe une place dans le flux du document.
     Quand il se compacte pendant le trajet, il perd ~58px et TOUT le document
     remonte d'autant — la cible finissait 58px trop haut, donc cachée sous la
     bande. Mesuré : cible à 52,6px pour un bas d'en-tête à 94,4px.
     Le remède : compacter AVANT de mesurer, et forcer le recalcul de mise en
     page pour que la mesure porte sur l'état final, pas sur l'état affiché. */
  function compacterMaintenant() {
    if (!entete || compact) return;
    entete.classList.add('is-compact');
    compact = true;
    void entete.offsetHeight;          /* force le recalcul, ne pas retirer */
  }

  /* easeInOutCubic : part doucement, accélère, se pose doucement. */
  function adoucir(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function allerVers(y, duree) {
    var depart = window.scrollY;
    var delta = clamp(y, 0, maxScroll()) - depart;
    if (Math.abs(delta) < 2) return;
    var t0 = performance.now();
    enCours = false;                     /* la molette rend la main */
    function pas(t) {
      var p = clamp((t - t0) / duree, 0, 1);
      var y2 = depart + delta * adoucir(p);
      pilote = true; window.scrollTo(0, y2); pilote = false;
      courant = cible = y2;
      if (p < 1) requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute('href');
    if (!id || id === '#') return;
    var t = document.querySelector(id);
    if (!t) return;
    e.preventDefault();

    if (reduce.matches) {
      t.scrollIntoView();
    } else {
      compacterMaintenant();
      var y = t.getBoundingClientRect().top + window.scrollY - entete.offsetHeight - 18;
      /* Durée liée à la distance, plafonnée : un saut de 6000px ne doit pas
         durer six secondes. */
      var dist = Math.abs(y - window.scrollY);
      allerVers(y, clamp(420 + dist * 0.28, 500, 1200));
    }
    /* L'URL suit, mais sans provoquer le saut natif du navigateur. */
    if (history.replaceState) history.replaceState(null, '', id);
    /* Accessibilité : le clavier doit suivre le regard. */
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  });

  /* ----------------------------------------------------------
     4. En-tête compact
     Plein en haut de page — le logo est le premier point d'accroche —
     puis réduit dès qu'on lit, pour ne pas manger l'écran.
     Seuil différent à la montée et à la descente : sans cette marge,
     l'en-tête clignote quand on s'arrête pile sur le seuil.
     ---------------------------------------------------------- */

  if (entete) {
    var attend = false;
    function majEntete() {
      var y = window.scrollY;
      if (!compact && y > 70) { compact = true; entete.classList.add('is-compact'); }
      else if (compact && y < 30) { compact = false; entete.classList.remove('is-compact'); }
      attend = false;
    }
    window.addEventListener('scroll', function () {
      if (attend) return;
      attend = true;
      requestAnimationFrame(majEntete);
    }, { passive: true });
    majEntete();
  }
})();
