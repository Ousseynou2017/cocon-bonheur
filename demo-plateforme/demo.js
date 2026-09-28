/* ============================================================
   MAQUETTE — socle commun.
   - État de la démo dans sessionStorage : il suit l'onglet d'un
     espace à l'autre et s'efface à la fermeture. Rien ne part ailleurs.
   - Icônes : un seul style, trait fin, injectées une fois en <symbol>.
   - Écrans : <section data-vue="x">, choisis par l'ancre (#x) de l'URL,
     pour que le bouton « retour » du téléphone marche.
   ============================================================ */
(function () {
  "use strict";
  var D = window.DEMO;
  var CLE = "cocon-demo-v2";
  var WA_ECOLE = "221778845353";   // TOUS les liens WhatsApp vont à l'école

  // ---------- État ----------
  var etat;
  try { etat = JSON.parse(sessionStorage.getItem(CLE)); } catch (e) { etat = null; }
  if (!etat) etat = JSON.parse(JSON.stringify(D.depart));
  function sauver() { try { sessionStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* navigation privée : la démo marche quand même */ } }
  function memo(cle, val) {
    try {
      if (val === undefined) return sessionStorage.getItem("cocon-" + cle);
      sessionStorage.setItem("cocon-" + cle, val);
    } catch (e) { return null; }
  }

  // ---------- Outils ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function nombre(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function fcfa(n) { return nombre(n) + " F CFA"; }
  function note(n) { return n === null || n === undefined || n === "" ? "—" : String(n).replace(".", ","); }
  function dateFr(iso) {
    var j = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    var m = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    var d = new Date(iso + "T12:00:00");
    return j[d.getDay()] + " " + d.getDate() + " " + m[d.getMonth()];
  }
  function wa(texte) { return "https://wa.me/" + WA_ECOLE + "?text=" + encodeURIComponent(texte); }
  function classe(id) { return D.CLASSES.filter(function (c) { return c.id === id; })[0]; }
  function eleve(id) { return etat.eleves.filter(function (e) { return e.id === id; })[0]; }
  function parentDe(e) { return etat.parents.filter(function (p) { return p.id === e.parent; })[0]; }
  function prof(id) { return etat.comptes.filter(function (p) { return p.id === id; })[0]; }
  function elevesDe(cid) { return etat.eleves.filter(function (e) { return e.classe === cid; }); }
  function moyenne(l) {
    var v = l.filter(function (x) { return typeof x === "number" && !isNaN(x); });
    return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 10) / 10 : null;
  }
  function familleAJour(p, mois) { return p.enfants.every(function (id) { return etat.paiements[id][mois]; }); }
  // Arabe détecté → droite à gauche.
  function sens(s) { return /[؀-ۿ]/.test(s || "") ? "rtl" : "ltr"; }

  // ---------- Icônes (trait 1,6, bouts arrondis) ----------
  var ICONES = {
    direction: '<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>',
    secretariat: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 3.5h6v3H9zM9 11h6M9 15h4"/>',
    enseignant: '<path d="M3 5.5h5.5A3.5 3.5 0 0 1 12 9v11a2.5 2.5 0 0 0-2.5-2.5H3zM21 5.5h-5.5A3.5 3.5 0 0 0 12 9v11a2.5 2.5 0 0 1 2.5-2.5H21z"/>',
    parent: '<path d="M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5h4v5"/>',
    message: '<path d="M4.5 19.5 5.8 16A7.8 7.8 0 1 1 8.4 18.6z"/>',
    imprimer: '<path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z"/>',
    telecharger: '<path d="M12 4v11M8 11l4 4 4-4M5 20h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    espaces: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    cloche: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
    paiement: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M15.5 14.5h2"/>',
    notes: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    jour: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    trombone: '<path d="m8.5 12.5 6-6a3 3 0 0 1 4.2 4.2l-8 8a5 5 0 0 1-7-7l7-7"/>',
    fleche: '<path d="m9 6 6 6-6 6"/>',
    retour: '<path d="m15 6-6 6 6 6"/>'
  };
  function monterIcones() {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>';
    for (var k in ICONES) s += '<symbol id="i-' + k + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICONES[k] + "</symbol>";
    document.body.insertAdjacentHTML("afterbegin", s + "</defs></svg>");
  }
  function ico(nom, cls) { return '<svg class="ico' + (cls ? " " + cls : "") + '" aria-hidden="true" focusable="false"><use href="#i-' + nom + '"/></svg>'; }

  // ---------- Écrans ----------
  // opts.defaut === false : aucun écran tant que l'ancre n'en désigne pas un.
  function ecrans(opts) {
    opts = opts || {};
    var vues = [].slice.call(document.querySelectorAll("[data-vue]"));
    function montrer(premier) {
      var h = location.hash.slice(1);
      var ok = vues.some(function (v) { return v.getAttribute("data-vue") === h; });
      var cible = ok ? h : (opts.defaut === false ? "" : vues[0].getAttribute("data-vue"));
      vues.forEach(function (v) { v.hidden = v.getAttribute("data-vue") !== cible; });
      [].forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
        var actif = a.getAttribute("href") === "#" + cible || (!ok && a.hasAttribute("data-defaut") && opts.defaut !== false);
        if (actif) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      });
      if (!premier) window.scrollTo(0, 0);
      if (opts.change) opts.change(cible);
    }
    window.addEventListener("hashchange", function () { montrer(false); });
    montrer(true);
  }

  // ---------- Message bref en bas d'écran ----------
  var toastEl, toastT;
  function toast(txt) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = txt;
    toastEl.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2400);
  }

  // ---------- Carte d'un exercice (enseignant et parent) ----------
  function carteExo(x, actions) {
    var pj = x.pdf ? '<button type="button" class="pj" data-pj="' + esc(x.pdf) + '">' + ico("trombone") + esc(x.pdf) + "</button>" : "";
    return '<article class="carte exo">' +
      '<p class="exo__meta"><span class="etiquette">' + esc(x.matiere) + "</span>" + x.classe + " · " + dateFr(x.date) + "</p>" +
      '<h3 class="exo__titre" dir="' + sens(x.titre) + '">' + esc(x.titre) + "</h3>" +
      '<p class="exo__texte" dir="' + sens(x.texte) + '">' + esc(x.texte) + "</p>" +
      (pj || actions ? '<div class="exo__bas">' + pj + (actions || "") + "</div>" : "") + "</article>";
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-pj]");
    if (b) toast("Maquette : le PDF « " + b.getAttribute("data-pj") + " » s'ouvrirait ici");
  });

  function selectClasses(sel, valeur) {
    sel.innerHTML = D.CLASSES.map(function (c) { return '<option value="' + c.id + '">' + c.id + "</option>"; }).join("");
    if (valeur) sel.value = valeur;
  }

  window.DEMO_UI = {
    etat: function () { return etat; }, sauver: sauver, memo: memo,
    esc: esc, nombre: nombre, fcfa: fcfa, note: note, dateFr: dateFr, wa: wa, sens: sens,
    classe: classe, eleve: eleve, parentDe: parentDe, prof: prof, elevesDe: elevesDe,
    moyenne: moyenne, familleAJour: familleAJour,
    ico: ico, ecrans: ecrans, toast: toast, carteExo: carteExo, selectClasses: selectClasses
  };

  // Les pages chargent ce script en fin de <body> : le DOM est déjà là.
  monterIcones();
})();
