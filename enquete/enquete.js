/* ============================================================
   Au Cocon Du Bonheur — enquête de satisfaction
   Découpage en étapes, validation, envoi, remerciement.

   ------------------------------------------------------------
   LE PRINCIPE, À LIRE AVANT DE MODIFIER
   ------------------------------------------------------------
   Le HTML livré est un formulaire COMPLET et CLASSIQUE : les neuf
   questions se suivent, avec method="post" et un bouton d'envoi.
   Sans ce script, un parent voit tout et envoie : ça marche.

   Ce fichier TRANSFORME ce formulaire en parcours d'étapes. Il pose
   `eq-js` sur <html>, et c'est cette classe — jamais le HTML — qui
   déclenche le mode étape dans la feuille de style.

   La règle qui en découle : rien d'indispensable ne doit exister
   uniquement ici. Si ce fichier ne charge pas, on perd le confort,
   jamais la possibilité de répondre.

   ------------------------------------------------------------
   Trois partis pris
   ------------------------------------------------------------
   1. Le formulaire n'est JAMAIS vidé. Un envoi qui échoue laisse les
      réponses en place : un parent qui a écrit trois lignes ne les
      retape pas.
   2. Aucune alert(). Les erreurs s'affichent sous le champ concerné.
   3. `novalidate` sur le <form> : les messages du navigateur sont en
      anglais chez beaucoup de monde et ne disent pas QUEL champ est en
      cause. On les remplace.

   Aucune dépendance, aucun CDN.
   ============================================================ */

(function () {
  'use strict';

  var form  = document.getElementById('eq-form');
  var done  = document.getElementById('eq-done');
  var intro = document.getElementById('eq-intro');
  var alertBox = document.getElementById('eq-alert');
  var zoneEnvoi = document.getElementById('eq-submit');
  var sendBtn   = document.getElementById('eq-send');
  var sendLabel = sendBtn ? sendBtn.querySelector('.eq-btn__label') : null;

  if (!form || !done || !sendBtn || !zoneEnvoi) return;

  var etapes = [].slice.call(form.querySelectorAll('.eq-q'));
  if (!etapes.length) return;   // HTML inattendu : on laisse le formulaire long.

  var NOTES = ['note_pedagogie', 'note_communication', 'note_encadrement', 'note_locaux'];

  var CLASSES = [
    'Crèche', 'Toute petite section', 'Petite section', 'Moyenne section',
    'Grande section', 'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'
  ];

  /* Ce qu'on dit au parent quand il n'a pas répondu. Une phrase par
     question : « ce champ est obligatoire » ne dit pas quoi faire. */
  var MANQUE = {
    enfant_prenom:      "Indiquez le prénom de votre enfant pour continuer.",
    classe:             "Choisissez la classe de votre enfant pour continuer.",
    note_pedagogie:     'Touchez une note de 1 à 5 pour continuer.',
    note_communication: 'Touchez une note de 1 à 5 pour continuer.',
    note_encadrement:   'Touchez une note de 1 à 5 pour continuer.',
    note_locaux:        'Touchez une note de 1 à 5 pour continuer.',
    recommande:         'Répondez par oui ou par non pour continuer.'
  };

  /* Intitulés courts pour le récapitulatif. */
  var TITRE_RECAP = {
    enfant_prenom:      "Prénom de l'enfant",
    classe:             'Classe',
    note_pedagogie:     'Pédagogie',
    note_communication: 'Communication avec les parents',
    note_encadrement:   'Encadrement des enfants',
    note_locaux:        'Locaux et matériel',
    recommande:         "Recommanderiez-vous l'école",
    points_forts:       'Ce qui vous plaît le plus',
    suggestions:        'Ce qui pourrait être amélioré'
  };

  var DUREE_AUTO = 250;   // le temps de voir son choix se colorer avant de partir

  var iCourant = 0;
  var iRecap   = etapes.length;   // le récapitulatif vient après la dernière question
  var enTransition = false;

  /* ------------------------------------------------------------
     Lecture des réponses
     ------------------------------------------------------------ */

  function texte(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function radio(nom) {
    var choisi = form.querySelector('[name="' + nom + '"]:checked');
    return choisi ? choisi.value : '';
  }

  function valeurDe(cle) {
    if (NOTES.indexOf(cle) !== -1 || cle === 'recommande') return radio(cle);
    return texte(cle);
  }

  /* ------------------------------------------------------------
     Erreurs
     ------------------------------------------------------------ */

  function montrerErreur(cle, message) {
    var p = document.getElementById('err-' + cle);
    if (p) { p.textContent = message; p.hidden = false; }

    var champ = document.getElementById(cle);
    if (champ) {
      champ.classList.add('is-bad');
      champ.setAttribute('aria-invalid', 'true');
      return champ;
    }
    // Groupe de boutons : c'est le premier bouton qui reçoit le focus.
    var premier = form.querySelector('[name="' + cle + '"]');
    if (premier) {
      var groupe = premier.closest('[role="radiogroup"]');
      if (groupe) groupe.classList.add('is-bad');
      return premier;
    }
    return null;
  }

  function effacerErreur(cle) {
    var p = document.getElementById('err-' + cle);
    if (p) { p.textContent = ''; p.hidden = true; }

    var champ = document.getElementById(cle);
    if (champ) {
      champ.classList.remove('is-bad');
      champ.removeAttribute('aria-invalid');
    }
    var premier = form.querySelector('[name="' + cle + '"]');
    if (premier) {
      var groupe = premier.closest('[role="radiogroup"]');
      if (groupe) groupe.classList.remove('is-bad');
    }
  }

  function annoncer(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.focus();
  }

  function taireAlerte() {
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  /* ------------------------------------------------------------
     Validation
     ------------------------------------------------------------ */

  /* Une étape. Renvoie true si on peut avancer. */
  function validerEtape(i) {
    var etape = etapes[i];
    if (!etape || etape.dataset.requis !== '1') return true;

    var cle = etape.dataset.cle;
    var v = valeurDe(cle);

    if (v === '') {
      var fautif = montrerErreur(cle, MANQUE[cle] || 'Cette réponse est nécessaire pour continuer.');
      if (fautif) fautif.focus({ preventScroll: true });
      return false;
    }
    if (cle === 'classe' && CLASSES.indexOf(v) === -1) {
      montrerErreur(cle, "Cette classe ne fait pas partie de la liste.");
      return false;
    }
    effacerErreur(cle);
    return true;
  }

  /* Tout le formulaire, avant l'envoi. Renvoie l'index de la première
     étape fautive, ou -1 si tout est bon. On ne fait jamais confiance au
     seul passage étape par étape : le parent a pu revenir en arrière et
     vider un champ. */
  function premiereEtapeFautive() {
    for (var i = 0; i < etapes.length; i++) {
      var etape = etapes[i];
      if (etape.dataset.requis !== '1') continue;
      var cle = etape.dataset.cle;
      var v = valeurDe(cle);
      if (v === '' || (cle === 'classe' && CLASSES.indexOf(v) === -1)) return i;
    }
    return -1;
  }

  /* ------------------------------------------------------------
     Le décor : barre de progression, navigation, récapitulatif.
     Tout est construit ici, donc absent du HTML livré.
     ------------------------------------------------------------ */

  var prog  = document.createElement('div');
  prog.className = 'eq-prog';
  prog.innerHTML =
    '<div class="eq-prog__rail"><span class="eq-prog__fill" id="eq-prog-fill"></span></div>' +
    '<p class="eq-prog__texte" id="eq-prog-texte" aria-live="polite"></p>';
  form.insertBefore(prog, form.firstChild);

  var progFill  = document.getElementById('eq-prog-fill');
  var progTexte = document.getElementById('eq-prog-texte');

  var recap = document.createElement('section');
  recap.className = 'eq-q eq-recap';
  recap.innerHTML =
    '<h2 class="eq-q__titre">Vérifiez vos réponses</h2>' +
    '<p class="eq-q__aide">Touchez « Corriger » pour changer une réponse.</p>' +
    '<dl class="eq-recap__liste" id="eq-recap-liste"></dl>';
  etapes[etapes.length - 1].insertAdjacentElement('afterend', recap);
  var recapListe = document.getElementById('eq-recap-liste');

  var nav = document.createElement('div');
  nav.className = 'eq-nav';
  nav.innerHTML =
    '<button type="button" class="eq-nav__btn eq-nav__retour" id="eq-retour">Retour</button>' +
    '<button type="button" class="eq-nav__btn eq-nav__suivant" id="eq-suivant">Suivant</button>';
  recap.insertAdjacentElement('afterend', nav);

  var btnRetour  = document.getElementById('eq-retour');
  var btnSuivant = document.getElementById('eq-suivant');

  // Le bouton d'envoi rejoint le récapitulatif : il ne doit apparaître
  // qu'une fois les réponses relues.
  recap.appendChild(zoneEnvoi);

  // À partir d'ici seulement, le mode étape s'applique.
  document.documentElement.classList.add('eq-js');

  /* Gagner de la hauteur pour que le bouton Suivant reste visible quand le
     clavier du téléphone est ouvert. Mesuré à 390×440 (un iPhone dont le
     clavier occupe 400px) : sans ces deux gestes, il fallait faire défiler.

     1. L'en-tête passe en version compacte tout de suite. La classe vient
        de styles.css, elle n'est pas inventée ici : sur la page d'accueil
        c'est app.js qui la pose au défilement. Sur un formulaire, le logo
        en pleine taille ne sert à rien.
     2. L'introduction disparaît dès qu'on quitte la première question :
        elle a été lue, elle ne coûte plus que de la place. */
  var header = document.querySelector('.site-header');
  if (header) header.classList.add('is-compact');

  /* ------------------------------------------------------------
     Affichage d'une étape
     ------------------------------------------------------------ */

  function ecrans() { return etapes.concat([recap]); }

  function majProgression() {
    var total = etapes.length;
    if (iCourant >= iRecap) {
      progTexte.textContent = 'Vérifiez vos réponses';
      progFill.style.width = '100%';
    } else {
      progTexte.textContent = 'Question ' + (iCourant + 1) + ' sur ' + total;
      progFill.style.width = ((iCourant + 1) / total * 100) + '%';
    }
  }

  /* Le focus après un changement d'étape.
     Sur un champ de saisie, on met le focus DANS le champ : le clavier
     s'ouvre tout seul et le parent économise un appui. C'est permis
     parce qu'on est dans la foulée d'un geste de sa part.
     Sur les autres écrans, le focus va au titre : le lecteur d'écran
     annonce la question, et aucun clavier ne s'ouvre pour rien. */
  function poserFocus(ecran) {
    var type = ecran.dataset ? ecran.dataset.type : '';
    if (type === 'texte' || type === 'texte-long') {
      var champ = ecran.querySelector('input[type="text"], textarea');
      if (champ) { champ.focus({ preventScroll: true }); return; }
    }
    var titre = ecran.querySelector('.eq-q__titre');
    if (titre) {
      titre.setAttribute('tabindex', '-1');
      titre.focus({ preventScroll: true });
    }
  }

  function afficher(i, sens) {
    var tous = ecrans();
    if (i < 0 || i >= tous.length) return;

    tous.forEach(function (e) {
      e.hidden = true;
      e.classList.remove('eq-q--entre-droite', 'eq-q--entre-gauche');
    });

    iCourant = i;
    var ecran = tous[i];
    ecran.hidden = false;

    // Glissement : transform et opacity seulement, jamais de flou.
    if (sens) {
      ecran.classList.add(sens > 0 ? 'eq-q--entre-droite' : 'eq-q--entre-gauche');
    }

    btnRetour.hidden  = (i === 0);
    btnSuivant.hidden = (i >= iRecap);   // au récapitulatif, c'est le bouton d'envoi

    // L'introduction n'accompagne que la première question.
    if (intro) intro.hidden = (i !== 0);

    if (i >= iRecap) construireRecap();

    majProgression();
    poserFocus(ecran);

    // Le haut de la question doit être visible : on remonte, sinon une
    // étape courte laisse la page à la position de la précédente.
    if (prog.getBoundingClientRect().top < 0) {
      prog.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function avancer() {
    if (enTransition) return;
    if (iCourant < iRecap && !validerEtape(iCourant)) return;
    taireAlerte();
    afficher(Math.min(iCourant + 1, iRecap), +1);
  }

  function reculer() {
    if (enTransition) return;
    taireAlerte();
    afficher(Math.max(iCourant - 1, 0), -1);
  }

  /* ------------------------------------------------------------
     Récapitulatif
     ------------------------------------------------------------ */

  function lisible(cle) {
    var v = valeurDe(cle);
    if (v === '') return null;
    if (NOTES.indexOf(cle) !== -1) return v + ' sur 5';
    if (cle === 'recommande') return v === 'oui' ? 'Oui' : 'Non';
    return v;
  }

  function construireRecap() {
    recapListe.textContent = '';

    etapes.forEach(function (etape, i) {
      var cle = etape.dataset.cle;
      var val = lisible(cle);

      // Une question facultative laissée vide n'encombre pas la relecture.
      if (val === null && etape.dataset.requis !== '1') return;

      var ligne = document.createElement('div');
      ligne.className = 'eq-recap__ligne';

      var dt = document.createElement('dt');
      dt.className = 'eq-recap__cle';
      dt.textContent = TITRE_RECAP[cle] || cle;

      var dd = document.createElement('dd');
      dd.className = 'eq-recap__val';
      dd.textContent = val === null ? '—' : val;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eq-recap__corriger';
      btn.textContent = 'Corriger';
      btn.setAttribute('aria-label', 'Corriger : ' + (TITRE_RECAP[cle] || cle));
      btn.addEventListener('click', function () { afficher(i, -1); });

      ligne.appendChild(dt);
      ligne.appendChild(dd);
      ligne.appendChild(btn);
      recapListe.appendChild(ligne);
    });

    // Le parent n'est pas une étape à lui seul : on l'ajoute ici pour que
    // la relecture soit complète.
    var qui = [texte('parent_prenom'), texte('parent_nom')].filter(Boolean).join(' ');
    var ligneQui = document.createElement('div');
    ligneQui.className = 'eq-recap__ligne';
    var dtQui = document.createElement('dt');
    dtQui.className = 'eq-recap__cle';
    dtQui.textContent = 'Votre nom';
    var ddQui = document.createElement('dd');
    ddQui.className = 'eq-recap__val';
    ddQui.textContent = qui || 'Réponse anonyme';
    if (!qui) ddQui.classList.add('eq-recap__val--vide');
    var btnQui = document.createElement('button');
    btnQui.type = 'button';
    btnQui.className = 'eq-recap__corriger';
    btnQui.textContent = 'Corriger';
    btnQui.setAttribute('aria-label', 'Corriger : votre nom');
    btnQui.addEventListener('click', function () {
      afficher(etapes.length - 1, -1);
      var p = document.getElementById('parent_prenom');
      if (p) p.focus({ preventScroll: true });
    });
    ligneQui.appendChild(dtQui);
    ligneQui.appendChild(ddQui);
    ligneQui.appendChild(btnQui);
    recapListe.appendChild(ligneQui);
  }

  /* ------------------------------------------------------------
     Interactions
     ------------------------------------------------------------ */

  btnSuivant.addEventListener('click', avancer);
  btnRetour.addEventListener('click', reculer);

  /* Choix unique : un appui suffit, le parcours avance tout seul.
     C'est l'intérêt du format — un appui au lieu de deux. Le petit délai
     laisse voir le choix se colorer avant de changer d'écran. */
  etapes.forEach(function (etape, i) {
    if (etape.dataset.auto !== '1') return;
    var cle = etape.dataset.cle;

    etape.querySelectorAll('input[type="radio"]').forEach(function (input) {
      input.addEventListener('change', function () {
        effacerErreur(cle);
        if (i !== iCourant) return;          // corrigé depuis un autre écran
        enTransition = true;
        setTimeout(function () {
          enTransition = false;
          if (i === iCourant) avancer();
        }, DUREE_AUTO);
      });
    });
  });

  /* L'erreur s'efface dès que le parent corrige. */
  etapes.forEach(function (etape) {
    var cle = etape.dataset.cle;
    var champ = document.getElementById(cle);
    if (champ) {
      champ.addEventListener('input',  function () { effacerErreur(cle); });
      champ.addEventListener('change', function () { effacerErreur(cle); });
    }
  });

  /* Entrée = Suivant.
     Dans une zone de texte libre, Entrée reste un retour à la ligne : un
     parent qui écrit un paragraphe ne doit pas être expédié à l'écran
     suivant au premier passage à la ligne.
     Échap n'est pas intercepté : il ne ferme rien et ne perd rien. */
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.target === sendBtn) return;                 // laisser l'envoi se faire
    e.preventDefault();
    if (iCourant < iRecap) avancer();
  });

  /* ------------------------------------------------------------
     Envoi
     ------------------------------------------------------------ */

  function charge() {
    return {
      enfant_prenom:      texte('enfant_prenom'),
      classe:             texte('classe'),
      note_pedagogie:     Number(radio('note_pedagogie')),
      note_communication: Number(radio('note_communication')),
      note_encadrement:   Number(radio('note_encadrement')),
      note_locaux:        Number(radio('note_locaux')),
      recommande:         radio('recommande') === 'oui',
      points_forts:       texte('points_forts'),
      suggestions:        texte('suggestions'),
      parent_prenom:      texte('parent_prenom'),
      parent_nom:         texte('parent_nom'),
      site_web:           texte('eq_site')
    };
  }

  function occupe(oui) {
    sendBtn.disabled = oui;
    if (sendLabel) {
      sendLabel.textContent = oui ? 'Envoi en cours…' : 'Envoyer mes réponses';
    }
  }

  function messageEchec(status, corps) {
    if (corps && typeof corps.message === 'string' && corps.message) return corps.message;
    if (status === 429) {
      return "Vous avez déjà envoyé plusieurs réponses. Patientez quelques minutes avant de recommencer.";
    }
    if (status === 0) {
      return "L'envoi n'a pas abouti : votre connexion semble coupée. Vos réponses sont toujours là, réessayez dans un instant.";
    }
    return "L'envoi n'a pas abouti. Vos réponses sont toujours là — réessayez dans un instant, ou appelez l'école au 77 884 53 53.";
  }

  function reussite() {
    form.hidden = true;
    if (intro) intro.hidden = true;
    done.hidden = false;
    done.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    taireAlerte();

    var fautive = premiereEtapeFautive();
    if (fautive !== -1) {
      afficher(fautive, -1);
      validerEtape(fautive);
      annoncer('Il manque une réponse à cette question.');
      return;
    }

    occupe(true);

    fetch('/api/enquete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(charge())
    })
      .then(function (r) {
        return r.json()
          .catch(function () { return null; })
          .then(function (corps) { return { ok: r.ok, status: r.status, corps: corps }; });
      })
      .then(function (res) {
        if (res.ok) {
          reussite();
        } else {
          occupe(false);
          annoncer(messageEchec(res.status, res.corps));
        }
      })
      .catch(function () {
        occupe(false);
        annoncer(messageEchec(0, null));
      });
  });

  /* ------------------------------------------------------------
     Départ
     ------------------------------------------------------------ */

  afficher(0, 0);
})();
