/* ============================================================
   MAQUETTE — toutes les données de la démo, et rien d'autre.
   Tout est INVENTÉ : noms, numéros, montants, notes.
   Les montants de scolarité sont des EXEMPLES, pas les tarifs de l'école.

   Les 100 élèves sont tirés d'un générateur à graine fixe : la liste
   est la même à chaque chargement, sur chaque téléphone.
   ============================================================ */
(function () {
  "use strict";

  // Graine fixe : mêmes élèves, mêmes notes, à chaque ouverture.
  var graine = 20261012;
  function hasard() {
    graine = (graine * 1103515245 + 12345) % 2147483648;
    return graine / 2147483648;
  }
  function pioche(liste) { return liste[Math.floor(hasard() * liste.length)]; }

  var DATE_DEMO = "2026-10-12";            // « aujourd'hui » dans la maquette (un lundi)
  var MOIS = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet"];
  var MOIS_COURANT = 0;                    // index dans MOIS : Octobre

  var MATIERES = ["Français", "Maths", "Anglais", "Arabe", "Chinois"];

  var ENSEIGNANTS = [
    { id: "p1", nom: "Mme Fatou Ndiaye",   classe: "CI",  tel: "77 000 01 01" },
    { id: "p2", nom: "M. Moussa Diop",     classe: "CP",  tel: "77 000 01 02" },
    { id: "p3", nom: "Mme Aminata Sow",    classe: "CE1", tel: "77 000 01 03" },
    { id: "p4", nom: "M. Ibrahima Fall",   classe: "CE2", tel: "77 000 01 04" },
    { id: "p5", nom: "Mme Khady Diagne",   classe: "CM1", tel: "77 000 01 05" },
    { id: "p6", nom: "M. Cheikh Mbaye",    classe: "CM2", tel: "77 000 01 06" }
  ];

  // Montant EXEMPLE, en F CFA par mois.
  var CLASSES = [
    { id: "CI",  effectif: 18, scolarite: 25000 },
    { id: "CP",  effectif: 17, scolarite: 25000 },
    { id: "CE1", effectif: 17, scolarite: 27500 },
    { id: "CE2", effectif: 16, scolarite: 27500 },
    { id: "CM1", effectif: 16, scolarite: 30000 },
    { id: "CM2", effectif: 16, scolarite: 30000 }
  ];
  CLASSES.forEach(function (c) {
    c.prof = ENSEIGNANTS.filter(function (p) { return p.classe === c.id; })[0].id;
  });

  var PRENOMS_F = ["Awa", "Fatou", "Aïssatou", "Mariama", "Khady", "Ndèye", "Coumba", "Astou", "Bineta", "Rokhaya", "Adama", "Seynabou", "Marème", "Dieynaba", "Oumou", "Sokhna", "Yacine", "Ndeye Fatou", "Aminata", "Penda"];
  var PRENOMS_G = ["Mamadou", "Moussa", "Ibrahima", "Cheikh", "Abdoulaye", "Ousmane", "Modou", "Babacar", "Serigne", "Pape", "Alioune", "Lamine", "Omar", "Souleymane", "Malick", "Assane", "Elhadji", "Idrissa", "Saliou", "Birame"];
  var NOMS = ["Diallo", "Ndiaye", "Diop", "Fall", "Sow", "Ba", "Sy", "Mbaye", "Gueye", "Faye", "Sarr", "Cissé", "Kane", "Thiam", "Seck", "Niang", "Diouf", "Camara", "Touré", "Sène", "Dieng", "Wade", "Mbengue", "Ly"];
  var PRENOMS_PARENT_F = ["Mme Awa", "Mme Fatou", "Mme Mariama", "Mme Khady", "Mme Ndèye", "Mme Coumba", "Mme Astou", "Mme Rokhaya"];
  var PRENOMS_PARENT_G = ["M. Mamadou", "M. Moussa", "M. Ibrahima", "M. Abdoulaye", "M. Ousmane", "M. Modou", "M. Babacar", "M. Alioune"];

  // --- La famille qui sert d'exemple dans l'espace parent : 2 enfants ---
  var FAMILLE_DEMO = "f1";

  var eleves = [];
  var parents = [];
  var n = 0;
  CLASSES.forEach(function (c) {
    for (var i = 0; i < c.effectif; i++) {
      n++;
      var fille = hasard() < 0.5;
      var nom = pioche(NOMS);
      var pid = "f" + (parents.length + 1);
      parents.push({
        id: pid,
        nom: (hasard() < 0.6 ? pioche(PRENOMS_PARENT_F) : pioche(PRENOMS_PARENT_G)) + " " + nom,
        tel: "77 000 " + String(10 + Math.floor(parents.length / 100)).slice(-2) + " " + ("0" + (parents.length % 100)).slice(-2),
        enfants: []
      });
      eleves.push({
        id: "e" + n,
        prenom: fille ? pioche(PRENOMS_F) : pioche(PRENOMS_G),
        nom: nom,
        fille: fille,
        classe: c.id,
        parent: pid
      });
    }
  });

  // Famille Diallo : les deux enfants partagent le même parent (f1).
  // e1 est en CI ; on lui donne un frère en CM1.
  var aine = eleves.filter(function (e) { return e.classe === "CM1"; })[3];
  var cadette = eleves[0];
  cadette.prenom = "Aïssatou"; cadette.nom = "Diallo"; cadette.fille = true;
  parents.splice(parents.findIndex(function (p) { return p.id === aine.parent; }), 1);
  aine.prenom = "Mamadou"; aine.nom = "Diallo"; aine.fille = false; aine.parent = FAMILLE_DEMO;
  parents[0].nom = "Mme Awa Diallo";
  parents[0].tel = "77 000 10 00";

  eleves.forEach(function (e) {
    var p = parents.filter(function (x) { return x.id === e.parent; })[0];
    p.enfants.push(e.id);
  });

  // --- Paiements : Octobre, 80 % des familles à jour ---
  // On désigne 20 familles non à jour (jamais la famille de démo, pour que
  // l'interrupteur de l'espace parent soit la seule façon de la voir en retard).
  var familles = parents.map(function (p) { return p.id; });
  var enRetard = {};
  var candidates = familles.filter(function (f) { return f !== FAMILLE_DEMO; });
  var aChoisir = Math.round(familles.length * 0.2);
  while (Object.keys(enRetard).length < aChoisir) enRetard[pioche(candidates)] = true;

  // paiements[eleveId] = tableau de 10 booléens, un par mois.
  // Mois passés du courant : rien (l'année commence en octobre).
  var paiements = {};
  eleves.forEach(function (e) {
    paiements[e.id] = MOIS.map(function (m, i) { return i === MOIS_COURANT ? !enRetard[e.parent] : false; });
  });

  // --- Notes d'octobre : sur 10, une par matière ---
  function appreciation(note) {
    if (note === null || note === "" || isNaN(note)) return "";
    if (note >= 9) return "Très bien";
    if (note >= 7) return "Bien";
    if (note >= 6) return "Assez bien";
    if (note >= 5) return "Passable";
    return "Insuffisant";
  }
  var OBSERVATIONS = [
    "Élève appliqué, participe volontiers.",
    "Bon mois. Doit soigner l'écriture.",
    "Travail sérieux, continuez ainsi.",
    "Des progrès en lecture, à encourager à la maison.",
    "Bavarde un peu en classe, mais bon niveau.",
    "Doit revoir les tables de multiplication.",
    "Très bonne attitude, curieux et attentif.",
    "Manque de concentration l'après-midi.",
    "Beaux efforts en arabe ce mois-ci.",
    "Le travail à la maison n'est pas toujours fait."
  ];
  var notes = {};
  eleves.forEach(function (e) {
    var niveau = 5 + hasard() * 4;           // chaque élève a son niveau
    var parMatiere = {};
    MATIERES.forEach(function (m) {
      var v = Math.round((niveau + (hasard() - 0.5) * 3) * 2) / 2;
      parMatiere[m] = Math.max(2, Math.min(10, v));
    });
    notes[e.id] = { mois: MOIS_COURANT, parMatiere: parMatiere, observation: pioche(OBSERVATIONS) };
  });
  // La famille de démo : des notes lisibles et variées.
  notes[cadette.id] = { mois: MOIS_COURANT, parMatiere: { "Français": 8.5, "Maths": 9, "Anglais": 7, "Arabe": 6.5, "Chinois": 5.5 }, observation: "Aïssatou lit de mieux en mieux. Très bonne participation en classe." };
  notes[aine.id]    = { mois: MOIS_COURANT, parMatiere: { "Français": 7, "Maths": 6, "Anglais": 8, "Arabe": 9.5, "Chinois": 4.5 }, observation: "Mamadou progresse en arabe. Doit revoir les fractions à la maison." };

  // --- Exercices de la semaine (lundi 12 → vendredi 16 octobre) ---
  var exercices = [
    { id: "x1", prof: "p3", classe: "CE1", matiere: "Arabe", date: "2026-10-12",
      titre: "تمرين: الحروف الشمسية والقمرية",
      texte: "اقرأ الكلمات التالية بصوت عالٍ ثم صنّفها في جدولين:\nالشمس – القمر – النور – الكتاب – السماء – البيت\n١. الحروف الشمسية: ...\n٢. الحروف القمرية: ...\nاكتب جملة قصيرة بكلمة « المدرسة ».",
      pdf: "arabe-ce1-lettres.pdf", audio: "arabe-ce1-lecture.mp3", rtl: true },
    { id: "x2", prof: "p3", classe: "CE1", matiere: "Français", date: "2026-10-12",
      titre: "Dictée de mots : les sons [on] et [an]",
      texte: "Lis ces mots à voix haute avec un parent, puis recopie-les deux fois :\nmaman – bonbon – enfant – montagne – orange – pantalon.\nEntoure en rouge le son [on] et en bleu le son [an].",
      pdf: "francais-ce1-sons.pdf", audio: "francais-ce1-dictee.mp3" },
    { id: "x3", prof: "p3", classe: "CE1", matiere: "Maths", date: "2026-10-13",
      titre: "Additions posées",
      texte: "Pose et calcule :\n1) 34 + 25\n2) 48 + 17\n3) 126 + 53\nProblème : Awa a 35 billes, son frère lui en donne 18. Combien en a-t-elle ?",
      pdf: "", audio: "" },
    { id: "x4", prof: "p1", classe: "CI", matiere: "Français", date: "2026-10-12",
      titre: "La lettre « m »",
      texte: "Écris une ligne de « m » puis une ligne de « ma, me, mi, mo ».\nColorie les images dont le nom commence par « m ».",
      pdf: "ci-lettre-m.pdf", audio: "ci-lettre-m.mp3" },
    { id: "x5", prof: "p2", classe: "CP", matiere: "Maths", date: "2026-10-13",
      titre: "Compter jusqu'à 50",
      texte: "Complète la suite : 10, 12, 14, … , 30.\nDessine 23 ronds en groupes de 10.",
      pdf: "cp-compter.pdf", audio: "" },
    { id: "x6", prof: "p4", classe: "CE2", matiere: "Anglais", date: "2026-10-12",
      titre: "Colours and numbers",
      texte: "Write the colours in English: rouge, bleu, vert, jaune.\nCount from 1 to 20 out loud with your family.",
      pdf: "", audio: "ce2-colours.mp3" },
    { id: "x7", prof: "p5", classe: "CM1", matiere: "Chinois", date: "2026-10-13",
      titre: "Saluer en chinois : 你好",
      texte: "Écoute l'audio et répète : 你好 (nǐ hǎo) – 谢谢 (xièxie) – 再见 (zàijiàn).\nRecopie trois fois le caractère 你.",
      pdf: "cm1-chinois-salutations.pdf", audio: "cm1-chinois-salutations.mp3" },
    { id: "x8", prof: "p5", classe: "CM1", matiere: "Maths", date: "2026-10-12",
      titre: "Les fractions simples",
      texte: "Colorie 1/2, 1/4 et 3/4 de chaque rectangle.\nRange du plus petit au plus grand : 3/4, 1/4, 1/2.",
      pdf: "cm1-fractions.pdf", audio: "" },
    { id: "x9", prof: "p6", classe: "CM2", matiere: "Français", date: "2026-10-13",
      titre: "Rédaction : mon quartier",
      texte: "En 8 à 10 lignes, décris ton quartier : ce que tu vois, ce que tu entends, ce que tu aimes.",
      pdf: "", audio: "" }
  ];

  var annonces = [
    { id: "a1", date: "2026-10-09", cible: "Toute l'école", titre: "Réunion des parents", texte: "Réunion des parents le samedi 17 octobre à 10 h dans la cour de l'école. Votre présence est importante." },
    { id: "a2", date: "2026-10-05", cible: "Toute l'école", titre: "Tenue du vendredi", texte: "Rappel : le vendredi, les élèves viennent en tenue traditionnelle." }
  ];

  // Chiffres de l'enquête parents déjà en ligne (fictifs dans la maquette).
  var ENQUETE = { reponses: 64, satisfaction: "4,3 / 5", recommandent: "92 %" };

  window.DEMO = {
    DATE_DEMO: DATE_DEMO,
    MOIS: MOIS,
    MOIS_COURANT: MOIS_COURANT,
    MATIERES: MATIERES,
    CLASSES: CLASSES,
    ENSEIGNANTS: ENSEIGNANTS,
    FAMILLE_DEMO: FAMILLE_DEMO,
    WHATSAPP_ECOLE: "221778845353",
    ENQUETE: ENQUETE,
    appreciation: appreciation,
    // Valeurs de départ ; demo.js les recopie dans l'état de l'onglet.
    depart: { eleves: eleves, parents: parents, paiements: paiements, notes: notes, exercices: exercices, annonces: annonces, comptes: ENSEIGNANTS.slice() }
  };
})();
