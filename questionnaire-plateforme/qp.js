/* ============================================================
   Au Cocon Du Bonheur — questionnaire plateforme (direction)
   Une section par écran, « Autre », classement, brouillon, envoi.

   Même principe que /enquete : le HTML livré est un formulaire
   complet qui part tout seul chez Web3Forms. Ce fichier ne fait que
   l'enrichir ; s'il ne charge pas, on perd le confort, jamais la
   possibilité de répondre.

   Même envoi que l'ancien questionnaire (outils/archives/
   questionnaire-ecole) : JSON vers api.web3forms.com, un champ par
   question, libellé = intitulé de la question.

   Aucune dépendance, aucun CDN.
   ============================================================ */

(function () {
  'use strict';

  var form  = document.getElementById('qp-form');
  var done  = document.getElementById('qp-done');
  var intro = document.getElementById('qp-intro');
  var alertBox  = document.getElementById('qp-alert');
  var sendBtn   = document.getElementById('qp-send');
  var sendLabel = sendBtn ? sendBtn.querySelector('.eq-btn__label') : null;
  var nom       = document.getElementById('qp-nom');

  if (!form || !done || !sendBtn || !nom) return;

  var etapes = [].slice.call(form.querySelectorAll('.qp-etape'));
  var questions = [].slice.call(form.querySelectorAll('.qp-q'));
  if (!etapes.length) return;

  var ENDPOINT   = 'https://api.web3forms.com/submit';
  var ACCESS_KEY = form.querySelector('[name="access_key"]').value;
  var CLE_STOCK  = 'questionnaire-plateforme-v1';

  var iCourant = 0;

  /* ------------------------------------------------------------
     Le décor : barre de progression et navigation, construites ici.
     ------------------------------------------------------------ */

  var prog = document.createElement('div');
  prog.className = 'eq-prog';
  prog.innerHTML =
    '<div class="eq-prog__rail"><span class="eq-prog__fill" id="qp-prog-fill"></span></div>' +
    '<p class="eq-prog__texte" id="qp-prog-texte" aria-live="polite"></p>';
  form.insertBefore(prog, form.firstChild);
  var progFill  = document.getElementById('qp-prog-fill');
  var progTexte = document.getElementById('qp-prog-texte');

  var nav = document.createElement('div');
  nav.className = 'eq-nav';
  nav.innerHTML =
    '<button type="button" class="eq-nav__btn eq-nav__retour" id="qp-retour">Retour</button>' +
    '<button type="button" class="eq-nav__btn eq-nav__suivant" id="qp-suivant">Suivant</button>';
  form.appendChild(nav);
  var btnRetour  = document.getElementById('qp-retour');
  var btnSuivant = document.getElementById('qp-suivant');

  // À partir d'ici, les règles « mode étapes » de enquete.css s'appliquent.
  document.documentElement.classList.add('eq-js');
  var header = document.querySelector('.site-header');
  if (header) header.classList.add('is-compact');

  /* ------------------------------------------------------------
     « Autre » : le champ texte n'apparaît qu'une fois coché.
     ------------------------------------------------------------ */

  function champAutre(q) { return q.querySelector('.qp-autre'); }
  function caseAutre(q)  { return q.querySelector('input[data-autre]'); }

  function majAutre(q, focus) {
    var c = caseAutre(q), t = champAutre(q);
    if (!c || !t) return;
    t.hidden = !c.checked;
    if (c.checked && focus) t.focus({ preventScroll: false });
  }

  questions.forEach(function (q) {
    if (!caseAutre(q)) return;
    q.addEventListener('change', function (e) {
      if (e.target.type === 'radio' || e.target.hasAttribute('data-autre')) {
        majAutre(q, e.target.hasAttribute('data-autre') && e.target.checked);
      }
    });
  });

  /* ------------------------------------------------------------
     Classement (question 21) : l'ordre des appuis fait le rang.
     ------------------------------------------------------------ */

  var qRang = form.querySelector('.qp-q[data-rang]');
  var ordre = [];   // valeurs, dans l'ordre où elles ont été touchées

  function majRang() {
    if (!qRang) return;
    qRang.querySelectorAll('input[type="checkbox"]').forEach(function (c) {
      var box = c.nextElementSibling;
      var r = ordre.indexOf(c.value);
      if (r === -1) box.removeAttribute('data-rang');
      else box.setAttribute('data-rang', String(r + 1));
    });
  }

  if (qRang) {
    qRang.addEventListener('change', function (e) {
      var v = e.target.value;
      var i = ordre.indexOf(v);
      if (e.target.checked && i === -1) ordre.push(v);
      if (!e.target.checked && i !== -1) ordre.splice(i, 1);
      majRang();
    });
  }

  /* ------------------------------------------------------------
     Brouillon : gardé sur cet appareil, comme l'ancien questionnaire.
     Un stockage bloqué (navigation privée) ne casse rien.
     ------------------------------------------------------------ */

  function champs() {
    return [].slice.call(form.querySelectorAll(
      '.qp-q input[type="text"], .qp-q input[type="number"], .qp-q textarea, ' +
      '.qp-q input[type="checkbox"], .qp-q input[type="radio"]'
    ));
  }
  function ref(el) {
    return (el.type === 'checkbox' || el.type === 'radio') ? el.name + '|' + el.value : el.name;
  }

  function sauver() {
    var d = { __ordre: ordre };
    champs().forEach(function (el) {
      d[ref(el)] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
    try { localStorage.setItem(CLE_STOCK, JSON.stringify(d)); } catch (e) {}
  }

  function restaurer() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(CLE_STOCK) || 'null'); } catch (e) {}
    if (!d) return;
    champs().forEach(function (el) {
      var k = ref(el);
      if (!(k in d)) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!d[k];
      else el.value = d[k];
    });
    if (Array.isArray(d.__ordre)) ordre = d.__ordre.slice();
  }

  var tSauve;
  form.addEventListener('input', function () { clearTimeout(tSauve); tSauve = setTimeout(sauver, 500); });
  form.addEventListener('change', sauver);

  restaurer();
  questions.forEach(function (q) { majAutre(q, false); });
  if (qRang) {
    // L'ordre sauvé ne garde que ce qui est encore coché.
    ordre = ordre.filter(function (v) {
      return !!qRang.querySelector('input[value="' + v.replace(/"/g, '\\"') + '"]:checked');
    });
    qRang.querySelectorAll('input:checked').forEach(function (c) {
      if (ordre.indexOf(c.value) === -1) ordre.push(c.value);
    });
    majRang();
  }

  /* ------------------------------------------------------------
     Validation : seul le nom est obligatoire.
     ------------------------------------------------------------ */

  var errNom = document.getElementById('err-qp-nom');

  function nomOk() {
    if (nom.value.trim()) {
      errNom.hidden = true; errNom.textContent = '';
      nom.classList.remove('is-bad'); nom.removeAttribute('aria-invalid');
      return true;
    }
    errNom.textContent = 'Indiquez votre nom pour continuer.';
    errNom.hidden = false;
    nom.classList.add('is-bad'); nom.setAttribute('aria-invalid', 'true');
    return false;
  }
  nom.addEventListener('input', function () { if (nom.value.trim()) nomOk(); });

  function annoncer(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.focus();
  }
  function taireAlerte() { alertBox.hidden = true; alertBox.textContent = ''; }

  /* ------------------------------------------------------------
     Affichage d'une section
     ------------------------------------------------------------ */

  function afficher(i, sens) {
    if (i < 0 || i >= etapes.length) return;
    etapes.forEach(function (e) {
      e.hidden = true;
      e.classList.remove('eq-q--entre-droite', 'eq-q--entre-gauche');
    });
    iCourant = i;
    var ecran = etapes[i];
    ecran.hidden = false;
    if (sens) ecran.classList.add(sens > 0 ? 'eq-q--entre-droite' : 'eq-q--entre-gauche');

    var dernier = (i === etapes.length - 1);
    btnRetour.hidden  = (i === 0);
    btnSuivant.hidden = dernier;          // à la fin, c'est le bouton d'envoi
    if (intro) intro.hidden = (i !== 0);

    var titre = ecran.querySelector('.eq-q__titre');
    progTexte.textContent = 'Section ' + (i + 1) + ' sur ' + etapes.length +
      (titre ? ' — ' + titre.textContent : '');
    progFill.style.width = ((i + 1) / etapes.length * 100) + '%';

    if (sens && titre) {
      titre.setAttribute('tabindex', '-1');
      titre.focus({ preventScroll: true });
    }
    if (sens && prog.getBoundingClientRect().top < 0) {
      prog.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function avancer() {
    if (iCourant === 0 && !nomOk()) { nom.focus(); return; }
    taireAlerte();
    afficher(Math.min(iCourant + 1, etapes.length - 1), +1);
  }
  function reculer() {
    taireAlerte();
    afficher(Math.max(iCourant - 1, 0), -1);
  }

  btnSuivant.addEventListener('click', avancer);
  btnRetour.addEventListener('click', reculer);

  // Entrée = Suivant, sauf dans la zone de texte libre et sur le bouton d'envoi.
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA' || e.target === sendBtn) return;
    e.preventDefault();
    if (iCourant < etapes.length - 1) avancer();
  });

  /* ------------------------------------------------------------
     Envoi
     ------------------------------------------------------------ */

  var VIDE = '(pas de réponse)';

  function intitule(q) {
    var lab = q.querySelector('.qp-q__lab');
    return lab.textContent.replace(/ /g, ' ').replace(/\s*\*\s*$/, '').trim();
  }

  function reponse(q) {
    if (q === qRang) {
      return ordre.map(function (v, i) { return (i + 1) + '. ' + v; }).join(' / ');
    }
    var parts = [];
    q.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked').forEach(function (c) {
      if (c.hasAttribute('data-autre')) {
        var t = champAutre(q) ? champAutre(q).value.trim() : '';
        parts.push(t ? 'Autre : ' + t : 'Autre');
      } else {
        parts.push(c.value);
      }
    });
    q.querySelectorAll('input[type="text"]:not(.qp-autre), input[type="number"], textarea').forEach(function (f) {
      var v = f.value.trim();
      if (v) parts.push(v);
    });
    return parts.join(', ');
  }

  function charge() {
    var qui = nom.value.trim();
    var out = {
      access_key: ACCESS_KEY,
      subject: 'Questionnaire plateforme — ' + qui,
      from_name: 'Questionnaire Au Cocon',
      botcheck: document.getElementById('qp-botcheck').checked,
      'Rempli le': new Date().toLocaleString('fr-FR')
    };
    var remplies = 0;
    var reps = {};
    questions.forEach(function (q) {
      var r = reponse(q);
      if (r) remplies++;
      reps[intitule(q)] = r || VIDE;
    });
    out['Questions répondues'] = remplies + ' sur ' + questions.length;
    for (var k in reps) out[k] = reps[k];
    return out;
  }

  function occupe(oui) {
    sendBtn.disabled = oui;
    if (sendLabel) sendLabel.textContent = oui ? 'Envoi en cours…' : 'Envoyer mes réponses';
  }

  function reussite() {
    try { localStorage.removeItem(CLE_STOCK); } catch (e) {}
    form.hidden = true;
    if (intro) intro.hidden = true;
    done.hidden = false;
    done.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    taireAlerte();

    if (!nomOk()) {
      afficher(0, -1);
      nom.focus();
      annoncer('Il manque votre nom, tout en haut de la première section.');
      return;
    }

    occupe(true);
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(charge())
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (data) {
        if (data && data.success) { reussite(); return; }
        throw new Error('refus');
      })
      .catch(function () {
        occupe(false);
        annoncer("L'envoi n'a pas marché. Vérifiez la connexion et réessayez : vos réponses sont gardées sur ce téléphone.");
      });
  });

  afficher(0, 0);
})();
