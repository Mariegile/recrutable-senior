// ═══════════════════════════════════════════════════════════════════
//   cvTexte.js : outils texte partagés (app + scripts de vérification)
//   Règle : la forme désaccentuée ne sert QU'À COMPARER. Tout ce qui est
//   affiché ou envoyé au modèle garde les accents d'origine.
// ═══════════════════════════════════════════════════════════════════

const DIACRITIQUES = /[̀-ͯ]/g;

// Forme de comparaison interne (minuscules, sans accents). Jamais affichée.
export function sansAccents(txt) {
  return String(txt ?? "").toLowerCase().normalize("NFD").replace(DIACRITIQUES, "");
}

// Désaccentue le texte caractère par caractère en gardant, pour chaque
// position du texte normalisé, la position correspondante dans l'original.
function indexerSansAccents(texte) {
  let norm = "";
  const pos = [];
  for (let i = 0; i < texte.length; i++) {
    const n = sansAccents(texte[i]);
    for (let k = 0; k < n.length; k++) { norm += n[k]; pos.push(i); }
  }
  pos.push(texte.length);
  return { norm, pos };
}

// Retrouve dans le texte source la forme accentuée d'un mot-clé extrait
// en désaccentué ("controle de gestion" -> "contrôle de gestion").
// Si le mot n'est pas retrouvé tel quel, il est renvoyé inchangé.
export function restaurerAccents(motNorm, texteSource) {
  if (!motNorm || !texteSource) return motNorm;
  const { norm, pos } = indexerSansAccents(texteSource);
  const echappe = sansAccents(motNorm).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp("(^|[^a-z0-9])(" + echappe + ")(?![a-z0-9])").exec(norm);
  if (!m) return motNorm;
  const debut = m.index + m[1].length;
  const fin = debut + m[2].length;
  return texteSource.slice(pos[debut], pos[fin]).toLowerCase();
}

// Transforme les mots-clés absents du CV en questions lisibles pour le
// candidat : un mot isolé est complété par son voisin dans l'offre quand ce
// voisin est lui aussi un mot-clé (« normes » -> « normes HACCP »,
// « restauration » + « collective » -> « restauration collective »).
// Les mots présents uniquement dans la 1re ligne (intitulé, employeur) sont
// écartés : le titre est traité à part et le nom de l'employeur n'est pas
// une compétence.
export function preparerQuestions(manquants, presents, texteOffre) {
  const lignes = String(texteOffre || "").split(/\n/).filter(l => l.trim());
  const corps = lignes.slice(1);
  const mots = corps.flatMap(l => l.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [])
    .map(m => m.replace(/^[ldLD]['’]/, ""));
  const cles = new Set([...manquants, ...presents].flatMap(k => sansAccents(k).split(/\s+/)));
  const corpsNorm = " " + sansAccents(corps.join(" ")).replace(/[^a-z0-9]+/g, " ") + " ";
  const forme = (m) => (m.length >= 2 && m === m.toUpperCase() && /\p{L}/u.test(m)) ? m : m.toLowerCase();
  const out = [];
  for (const k of manquants) {
    const kn = sansAccents(k);
    if (!corpsNorm.includes(" " + kn.replace(/[^a-z0-9]+/g, " ").trim() + " ")) continue;
    let phrase = k;
    if (!/\s/.test(k)) {
      const i = mots.findIndex(m => sansAccents(m) === kn);
      const suiv = mots[i + 1], prec = mots[i - 1];
      if (i >= 0 && suiv && cles.has(sansAccents(suiv)) && sansAccents(suiv) !== kn) phrase = `${forme(mots[i])} ${forme(suiv)}`;
      else if (i >= 0 && prec && cles.has(sansAccents(prec)) && sansAccents(prec) !== kn) phrase = `${forme(prec)} ${forme(mots[i])}`;
    }
    if (!out.some(p => sansAccents(p) === sansAccents(phrase))) out.push(phrase);
  }
  return out;
}

// Tirets cadratin / demi-cadratin : interdits dans le texte généré.
const TIRETS_LONGS = /\s*[—–]\s*/g;
export function retirerTiretsLongs(txt) {
  return String(txt ?? "")
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2")   // plages : 2015–2020 -> 2015-2020
    .replace(/(\S)\s+[—–]\s+(\S)/g, "$1, $2")  // incise : a — b -> a, b
    .replace(TIRETS_LONGS, "-");
}

// Applique retirerTiretsLongs à toutes les chaînes d'un objet CV.
export function nettoyerTiretsCv(v) {
  if (typeof v === "string") return retirerTiretsLongs(v);
  if (Array.isArray(v)) return v.map(nettoyerTiretsCv);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = nettoyerTiretsCv(val);
    return out;
  }
  return v;
}

// Compétence groupée : "Thème : a, b, c" -> { theme, elements }
export function separerTheme(ligne) {
  const s = String(ligne ?? "");
  const i = s.indexOf(" : ");
  if (i <= 0 || i > 60) return { theme: "", elements: [s] };
  return {
    theme: s.slice(0, i).trim(),
    elements: s.slice(i + 3).split(/\s*,\s*/).map(x => x.trim()).filter(Boolean),
  };
}

// Accepte ["a", "b"] OU [{ theme, elements: [] }] et renvoie des lignes
// texte ("Thème : a, b") compatibles avec l'éditeur et la traduction.
export function aplatirCompetences(v) {
  if (!Array.isArray(v)) return [];
  return v.map(x => {
    if (typeof x === "string") return x.trim();
    if (x && typeof x === "object") {
      const el = Array.isArray(x.elements) ? x.elements.filter(e => typeof e === "string" && e.trim()) : [];
      const th = typeof x.theme === "string" ? x.theme.trim() : "";
      if (!el.length) return "";
      return th ? `${th} : ${el.join(", ")}` : el.join(", ");
    }
    return "";
  }).filter(Boolean);
}

// ── Contrôle de fidélité (tests + garde-fou) ─────────────────────────
// Mots d'usage courant qui, sans accent, signalent un texte désaccentué.
const MOTS_ACCENTUES = ["experience", "experiences", "securite", "francais", "gerer", "gere",
  "defense", "equipe", "equipes", "elaboration", "realisation", "competences", "qualite",
  "hygiene", "regime", "regimes", "medico", "etablissement", "diplome", "preparation",
  "creation", "reception", "specialite", "evenements", "maitrise", "tresorerie", "controle"];

// Verbes à l'infinitif génériques à proscrire en tête de puce.
const INFINITIFS_CREUX = ["assurer", "veiller", "garantir", "participer", "contribuer", "gérer", "gerer"];
const ADJECTIFS_CREUX = ["dynamique", "motivé", "motivée", "passionné", "passionnée", "rigoureux", "rigoureuse",
  "excellent relationnel", "doté d'un", "dotée d'un", "force de proposition"];

function texteDuCv(cv) {
  const morceaux = [cv.titre, cv.profil,
    ...(cv.experiences || []).flatMap(e => [e.poste, e.entreprise, e.lieu, ...(e.taches || [])]),
    ...(cv.formations || []).flatMap(f => [f.intitule]),
    ...(cv.competences || []), ...(cv.savoirEtre || []), ...(cv.langues || [])];
  return morceaux.filter(Boolean).join("\n");
}

const MOTS_VIDES = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "d", "l", "a", "un", "une", "pour", "par", "sur", "avec"]);
function motsSignificatifs(txt) {
  return sansAccents(txt).split(/[^a-z0-9+]+/).filter(w => w.length >= 2 && !MOTS_VIDES.has(w));
}

// Renvoie la liste des problèmes détectés (vide = CV conforme).
// source : texte du CV d'origine. confirmes : éléments validés "oui" par le candidat.
export function controlerCv(cv, source, confirmes = []) {
  const problemes = [];
  const tout = texteDuCv(cv);
  const autorise = sansAccents(source + "\n" + confirmes.join("\n"));

  if (/[—–]/.test(tout)) problemes.push("Tiret cadratin ou demi-cadratin présent");

  const motsSansAccent = MOTS_ACCENTUES.filter(m => new RegExp(`\\b${m}\\b`, "i").test(tout));
  if (motsSansAccent.length) problemes.push("Mots écrits sans accent : " + motsSansAccent.join(", "));

  // Chiffres : tout nombre du CV généré doit exister dans la source.
  const nombresSource = new Set((source.match(/\d+/g) || []));
  const nombresCv = [...new Set(tout.match(/\d+/g) || [])];
  const nombresInventes = nombresCv.filter(n => !nombresSource.has(n));
  if (nombresInventes.length) problemes.push("Chiffres absents de la source : " + nombresInventes.join(", "));

  // Diplômes : chaque mot de l'intitulé doit figurer dans la source.
  for (const f of cv.formations || []) {
    const absents = motsSignificatifs(f.intitule).filter(w => !autorise.includes(w));
    if (absents.length) problemes.push(`Diplôme modifié ou inventé « ${f.intitule} » (mots absents : ${absents.join(", ")})`);
  }

  // Puces : pas d'infinitif générique en tête.
  for (const e of cv.experiences || []) {
    for (const t of e.taches || []) {
      const premier = sansAccents(t.trim().split(/\s+/)[0] || "");
      if (INFINITIFS_CREUX.map(sansAccents).includes(premier)) problemes.push(`Puce à l'infinitif générique : « ${t} »`);
    }
  }

  const profil = String(cv.profil || "").toLowerCase();
  const creux = ADJECTIFS_CREUX.filter(a => profil.includes(a));
  if (creux.length) problemes.push("Profil avec formules creuses : " + creux.join(", "));

  return problemes;
}

// Vérifie qu'aucune expression interdite (ajout non confirmé) n'apparaît.
export function expressionsInterdites(cv, interdits) {
  const t = sansAccents(texteDuCv(cv));
  return interdits.filter(x => t.includes(sansAccents(x)));
}
