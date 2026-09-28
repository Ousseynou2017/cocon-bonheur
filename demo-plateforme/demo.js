/* ============================================================
   MAQUETTE — socle commun aux 5 pages.
   - l'état de la démo (paiements cochés, annonces écrites…) vit dans
     sessionStorage : il suit l'onglet d'une page à l'autre et
     s'efface quand on ferme l'onglet. Rien ne part sur un serveur.
   - bandeau « MAQUETTE », bouton « Un avis sur cette page ? », onglets.
   ============================================================ */
(function () {
  "use strict";
  var D = window.DEMO;
  var CLE = "cocon-demo-v1";

  // ---------- État ----------
  function copie(o) { return JSON.parse(JSON.stringify(o)); }
  var etat;
  try { etat = JSON.parse(sessionStorage.getItem(CLE)); } catch (e) { etat = null; }
  if (!etat) etat = copie(D.depart);
  function sauver() { try { sessionStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* navigation privée : la démo marche quand même */ } }
  function remettreAZero() { try { sessionStorage.removeItem(CLE); } catch (e) {} location.reload(); }

  // ---------- Petits outils ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fcfa(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F CFA"; }
  function note(n) { return n === null || n === undefined || n === "" ? "—" : String(n).replace(".", ","); }
  function dateFr(iso) {
    var j = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    var m = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    var d = new Date(iso + "T12:00:00");
    return j[d.getDay()] + " " + d.getDate() + " " + m[d.getMonth()];
  }
  function lienWa(numero, texte) {
    return "https://wa.me/" + numero.replace(/\D/g, "") + "?text=" + encodeURIComponent(texte);
  }
  function classe(id) { return D.CLASSES.filter(function (c) { return c.id === id; })[0]; }
  function eleve(id) { return etat.eleves.filter(function (e) { return e.id === id; })[0]; }
  function parentDe(e) { return etat.parents.filter(function (p) { return p.id === e.parent; })[0]; }
  function prof(id) { return etat.comptes.filter(function (p) { return p.id === id; })[0]; }
  function elevesDe(cid) { return etat.eleves.filter(function (e) { return e.classe === cid; }); }
  function moyenne(liste) {
    var v = liste.filter(function (x) { return typeof x === "number" && !isNaN(x); });
    if (!v.length) return null;
    return Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 10) / 10;
  }
  function moyenneEleve(eid) {
    var n = etat.notes[eid];
    return n ? moyenne(D.MATIERES.map(function (m) { return n.parMatiere[m]; })) : null;
  }
  // Une famille est à jour si TOUS ses enfants ont payé le mois.
  function familleAJour(pid, mois) {
    var p = etat.parents.filter(function (x) { return x.id === pid; })[0];
    return p.enfants.every(function (eid) { return etat.paiements[eid][mois]; });
  }

  // ---------- Bandeau, en-tête, bouton d'avis ----------
  var nomPage = document.body.getAttribute("data-page") || "Accueil";
  var sousPage = "";

  function monter() {
    var bandeau = document.createElement("div");
    bandeau.className = "dp-bandeau";
    bandeau.setAttribute("role", "note");
    bandeau.innerHTML = "<strong>MAQUETTE</strong> — données fictives — rien n'est enregistré";
    document.body.insertBefore(bandeau, document.body.firstChild);

    var avis = document.createElement("a");
    avis.className = "dp-avis";
    avis.target = "_blank";
    avis.rel = "noopener";
    avis.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3C7 3 3 6.6 3 11c0 2.4 1.2 4.6 3.1 6L5.5 21l4.1-2.3c.8.2 1.6.3 2.4.3 5 0 9-3.6 9-8s-4-8-9-8Z"/></svg><span>Un avis sur cette page&nbsp;?</span>';
    function majAvis() {
      var ou = nomPage + (sousPage ? " › " + sousPage : "");
      avis.href = lienWa(D.WHATSAPP_ECOLE, "Maquette plateforme — page : " + ou + "\n\nMon avis : ");
    }
    majAvis();
    document.body.appendChild(avis);
    window.DEMO_UI.majAvis = majAvis;

    var raz = document.querySelectorAll("[data-raz]");
    for (var i = 0; i < raz.length; i++) raz[i].addEventListener("click", remettreAZero);
  }

  // ---------- Onglets ----------
  // <div class="dp-onglets" role="tablist"> <button role="tab" aria-controls="p-x"> …
  // Le nom de l'onglet ouvert part avec l'avis WhatsApp.
  function onglets(racine, auChangement) {
    var tabs = racine.querySelectorAll('[role="tab"]');
    function ouvrir(t, focus) {
      for (var i = 0; i < tabs.length; i++) {
        var actif = tabs[i] === t;
        tabs[i].setAttribute("aria-selected", actif ? "true" : "false");
        tabs[i].tabIndex = actif ? 0 : -1;
        document.getElementById(tabs[i].getAttribute("aria-controls")).hidden = !actif;
      }
      if (focus) t.focus();
      sousPage = t.textContent.trim();
      if (window.DEMO_UI.majAvis) window.DEMO_UI.majAvis();
      try { sessionStorage.setItem("onglet-" + nomPage, t.id); } catch (e) {}
      if (auChangement) auChangement(t.getAttribute("aria-controls"));
    }
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", function () { ouvrir(this); });
      tabs[i].addEventListener("keydown", function (ev) {
        var idx = Array.prototype.indexOf.call(tabs, this);
        if (ev.key === "ArrowRight") { ev.preventDefault(); ouvrir(tabs[(idx + 1) % tabs.length], true); }
        if (ev.key === "ArrowLeft")  { ev.preventDefault(); ouvrir(tabs[(idx - 1 + tabs.length) % tabs.length], true); }
      });
    }
    var memo = null;
    try { memo = document.getElementById(sessionStorage.getItem("onglet-" + nomPage)); } catch (e) {}
    ouvrir(memo && racine.contains(memo) ? memo : tabs[0]);
    return { ouvrir: function (id) { ouvrir(document.getElementById(id)); } };
  }

  // Petit message de confirmation en bas d'écran.
  var toastEl, toastT;
  function toast(txt) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "dp-toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = txt;
    toastEl.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2600);
  }

  // Remplit un <select> de classes.
  function optionsClasses(sel, avecToutes) {
    sel.innerHTML = (avecToutes ? '<option value="">Toutes les classes</option>' : "") +
      D.CLASSES.map(function (c) { return '<option value="' + c.id + '">' + c.id + "</option>"; }).join("");
  }

  // Arabe détecté → droite à gauche. Le reste garde le sens du français.
  function sens(s) { return /[؀-ۿ]/.test(s || "") ? "rtl" : "ltr"; }

  // Carte d'un exercice : même rendu chez l'enseignant et chez le parent.
  function carteExo(x) {
    var p = prof(x.prof);
    var pj = "";
    if (x.pdf) pj += '<button type="button" class="dp-pj" data-pj="Le PDF « ' + esc(x.pdf) + ' » s\'ouvrirait ici">📄 ' + esc(x.pdf) + "</button>";
    if (x.audio) pj += '<button type="button" class="dp-pj" data-pj="L\'audio « ' + esc(x.audio) + ' » se lirait ici">🔊 ' + esc(x.audio) + "</button>";
    return '<article class="dp-exo">' +
      '<div class="dp-exo__meta"><span class="dp-pas dp-pas--neutre">' + esc(x.matiere) + "</span><span>" + x.classe + " · " + dateFr(x.date) + (p ? " · " + esc(p.nom) : "") + "</span></div>" +
      '<h3 class="dp-exo__titre" dir="' + sens(x.titre) + '">' + esc(x.titre) + "</h3>" +
      '<p class="dp-exo__texte" dir="' + sens(x.texte) + '">' + esc(x.texte) + "</p>" +
      (pj ? '<div class="dp-exo__pj">' + pj + "</div>" : "") + "</article>";
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-pj]");
    if (b) toast("Maquette : " + b.getAttribute("data-pj"));
  });

  window.DEMO_UI = {
    sens: sens, carteExo: carteExo,
    etat: function () { return etat; },
    sauver: sauver,
    esc: esc, fcfa: fcfa, note: note, dateFr: dateFr, lienWa: lienWa,
    classe: classe, eleve: eleve, parentDe: parentDe, prof: prof, elevesDe: elevesDe,
    moyenne: moyenne, moyenneEleve: moyenneEleve, familleAJour: familleAJour,
    onglets: onglets, toast: toast, optionsClasses: optionsClasses
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", monter);
  else monter();
})();
