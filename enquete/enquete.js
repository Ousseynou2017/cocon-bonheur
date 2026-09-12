/* ============================================================
   Au Cocon Du Bonheur — enquête de satisfaction
   Validation côté navigateur, envoi, écran de confirmation.

   Trois partis pris :
   1. Le formulaire n'est JAMAIS vidé. Si l'envoi échoue, les réponses
      sont toujours là : un parent qui a écrit trois lignes ne les
      retape pas.
   2. Aucune alert(). Les erreurs s'affichent sous le champ concerné,
      la confirmation est un vrai écran.
   3. `novalidate` sur le <form> : les messages du navigateur sont en
      anglais chez beaucoup d'utilisateurs et ne disent pas QUEL champ
      est en cause quand la page est longue. On les remplace.

   Aucune dépendance, aucun CDN.
   ============================================================ */

(function () {
  'use strict';

  var form  = document.getElementById('eq-form');
  var done  = document.getElementById('eq-done');
  var intro = document.getElementById('eq-intro');
  var alertBox = document.getElementById('eq-alert');
  var sendBtn  = document.getElementById('eq-send');
  var sendLabel = sendBtn ? sendBtn.querySelector('.eq-btn__label') : null;

  if (!form || !done || !sendBtn) return;

  var NOTES = ['note_pedagogie', 'note_communication', 'note_encadrement', 'note_locaux'];

  var CLASSES = [
    'Crèche', 'Toute petite section', 'Petite section', 'Moyenne section',
    'Grande section', 'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'
  ];

  var LIBELLE = {
    note_pedagogie:     'la pédagogie',
    note_communication: 'la communication avec les parents',
    note_encadrement:   "l'encadrement des enfants",
    note_locaux:        'les locaux et le matériel'
  };

  /* ---------- Affichage des erreurs ---------- */

  function montrerErreur(id, message) {
    var p = document.getElementById('err-' + id);
    if (p) {
      p.textContent = message;
      p.hidden = false;
    }
    var champ = document.getElementById(id);
    if (champ) {
      champ.classList.add('is-bad');
      champ.setAttribute('aria-invalid', 'true');
      return champ;
    }
    // Pour les groupes de radios : c'est le <fieldset> qui porte l'état,
    // et le premier bouton du groupe qui reçoit le focus.
    var groupe = form.querySelector('[name="' + id + '"]');
    if (groupe) {
      var bloc = groupe.closest('.eq-rate, .eq-yn');
      if (bloc) bloc.classList.add('is-bad');
      return groupe;
    }
    return null;
  }

  function effacerErreur(id) {
    var p = document.getElementById('err-' + id);
    if (p) { p.textContent = ''; p.hidden = true; }

    var champ = document.getElementById(id);
    if (champ) {
      champ.classList.remove('is-bad');
      champ.removeAttribute('aria-invalid');
    }
    var groupe = form.querySelector('[name="' + id + '"]');
    if (groupe) {
      var bloc = groupe.closest('.eq-rate, .eq-yn');
      if (bloc) bloc.classList.remove('is-bad');
    }
  }

  function effacerTout() {
    effacerErreur('enfant_prenom');
    effacerErreur('classe');
    NOTES.forEach(effacerErreur);
    effacerErreur('recommande');
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  function annoncer(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.focus();
  }

  /* ---------- Lecture des valeurs ---------- */

  function texte(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function radio(nom) {
    var choisi = form.querySelector('[name="' + nom + '"]:checked');
    return choisi ? choisi.value : '';
  }

  /* ---------- Validation ----------
     Renvoie le premier élément fautif, ou null si tout va bien. */

  function valider() {
    var premier = null;

    function fautif(el) { if (!premier && el) premier = el; }

    var prenom = texte('enfant_prenom');
    if (prenom === '') {
      fautif(montrerErreur('enfant_prenom', "Indiquez le prénom de votre enfant."));
    } else if (prenom.length > 60) {
      fautif(montrerErreur('enfant_prenom', "Ce prénom est trop long (60 caractères au maximum)."));
    }

    var classe = texte('classe');
    if (classe === '') {
      fautif(montrerErreur('classe', "Choisissez la classe de votre enfant."));
    } else if (CLASSES.indexOf(classe) === -1) {
      fautif(montrerErreur('classe', "Cette classe n'existe pas dans la liste."));
    }

    NOTES.forEach(function (nom) {
      if (radio(nom) === '') {
        fautif(montrerErreur(nom, 'Donnez une note pour ' + LIBELLE[nom] + '.'));
      }
    });

    if (radio('recommande') === '') {
      fautif(montrerErreur('recommande', "Répondez par oui ou par non."));
    }

    return premier;
  }

  /* ---------- Construction du corps envoyé ---------- */

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
      // Piège à robot : un humain le laisse vide, le serveur rejette s'il est rempli.
      site_web:           texte('eq_site')
    };
  }

  /* ---------- Envoi ---------- */

  function occupe(oui) {
    sendBtn.disabled = oui;
    if (sendLabel) {
      sendLabel.textContent = oui ? 'Envoi en cours…' : 'Envoyer mes réponses';
    }
  }

  function messageEchec(status, corps) {
    // Le serveur renvoie un message lisible quand il peut. On le préfère
    // toujours au nôtre : il est plus précis.
    if (corps && typeof corps.message === 'string' && corps.message) {
      return corps.message;
    }
    if (status === 429) {
      return "Vous avez déjà envoyé plusieurs réponses. Patientez quelques minutes avant de recommencer.";
    }
    if (status === 0) {
      return "L'envoi n'a pas abouti : votre connexion semble coupée. Vos réponses sont toujours là, réessayez dans un instant.";
    }
    return "L'envoi n'a pas abouti. Vos réponses sont toujours là — réessayez dans un instant, ou appelez l'école au 77 884 53 53.";
  }

  function reussite() {
    // On ne vide rien et on ne redirige pas : l'écran de remerciement
    // remplace le formulaire et y reste.
    form.hidden = true;
    if (intro) intro.hidden = true;
    done.hidden = false;
    done.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    effacerTout();

    var fautif = valider();
    if (fautif) {
      annoncer("Quelques réponses manquent. Elles sont signalées ci-dessous.");
      fautif.focus({ preventScroll: true });
      fautif.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  /* ---------- L'erreur s'efface dès que le parent corrige ---------- */

  ['enfant_prenom', 'classe'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  function () { effacerErreur(id); });
    el.addEventListener('change', function () { effacerErreur(id); });
  });

  NOTES.concat(['recommande']).forEach(function (nom) {
    form.querySelectorAll('[name="' + nom + '"]').forEach(function (input) {
      input.addEventListener('change', function () { effacerErreur(nom); });
    });
  });
})();
