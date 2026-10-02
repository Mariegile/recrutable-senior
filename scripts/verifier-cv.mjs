// Vérifications CV : accents, fidélité à la source, tirets, modèle HTML.
// Lancer : npm run verifier-cv
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  restaurerAccents, retirerTiretsLongs, nettoyerTiretsCv, aplatirCompetences,
  separerTheme, controlerCv, expressionsInterdites, sansAccents, preparerQuestions,
} from "../src/cvTexte.js";
import { genererCvHtmlFr } from "../src/cvModele.js";
import { CV_SOURCE, OFFRE, CONFIRMES, INTERDITS, SORTIE_AVANT, SORTIE_APRES } from "./fixtures/cuisinier.js";

// Même post-traitement que validerCV (App.jsx)
const traiter = (brut) => {
  const o = nettoyerTiretsCv(brut);
  return { ...o, competences: aplatirCompetences(o.competences), savoirEtre: o.savoirEtre || [] };
};
const AVANT = traiter(SORTIE_AVANT);
const APRES = traiter(SORTIE_APRES);
const THEME = { primary: "#1B3A5C", accent: "#A85D2C", font: "Georgia, serif" };

test("mots-clés : la forme accentuée de l'offre est restaurée pour l'affichage", () => {
  assert.equal(restaurerAccents("equilibre nutritionnel", OFFRE), "équilibre nutritionnel");
  assert.equal(restaurerAccents("controle de gestion", OFFRE), "contrôle de gestion");
  assert.equal(restaurerAccents("securite", OFFRE), "sécurité");
  assert.equal(restaurerAccents("maitrise", OFFRE), "maîtrise");
  assert.equal(restaurerAccents("regimes", OFFRE), "régimes");
  assert.equal(restaurerAccents("textures modifiees", OFFRE), "textures modifiées");
  // mot absent de l'offre : renvoyé tel quel, jamais tronqué
  assert.equal(restaurerAccents("tresorerie", OFFRE), "tresorerie");
  // pas de correspondance partielle au milieu d'un mot
  assert.equal(restaurerAccents("cuisine", "Cuisinier, cuisine centrale"), "cuisine");
});

test("questions Oui/Non : expressions de l'offre, pas le nom de l'employeur", () => {
  const q = preparerQuestions(
    ["normes", "contrôle de gestion", "chef", "restauration", "collective", "alimentaires", "glycines", "ehpad"],
    ["haccp", "régimes"], OFFRE);
  // « normes » (devant HACCP) et « alimentaires » (après régimes) : notions déjà dans le CV
  assert.deepEqual(q, ["contrôle de gestion", "restauration collective"]);
  // jamais de question sur un mot vague
  assert.deepEqual(preparerQuestions(["gestion", "cegid"], [], "Titre

- gestion
- logiciel cegid"), ["cegid"]);
  // pas de fusion à cheval sur deux lignes
  assert.deepEqual(preparerQuestions(["entreprise", "anglais"], [], "Titre\n- 5 ans en entreprise\n- anglais"), ["entreprise", "anglais"]);
});

test("la comparaison interne reste désaccentuée", () => {
  assert.equal(sansAccents("Sécurité Alimentaire"), "securite alimentaire");
});

test("tirets cadratin et demi-cadratin supprimés", () => {
  assert.equal(retirerTiretsLongs("Cuisinier — Nantes"), "Cuisinier, Nantes");
  assert.equal(retirerTiretsLongs("2014–2020"), "2014-2020");
  assert.ok(!/[—–]/.test(JSON.stringify(nettoyerTiretsCv({ a: ["x – y", { b: "z—w" }] }))));
});

test("compétences regroupées par thème : aller-retour sans perte", () => {
  const lignes = aplatirCompetences([{ theme: "Hygiène", elements: ["HACCP", "Traçabilité"] }, "Liaison froide"]);
  assert.deepEqual(lignes, ["Hygiène : HACCP, Traçabilité", "Liaison froide"]);
  assert.deepEqual(separerTheme(lignes[0]), { theme: "Hygiène", elements: ["HACCP", "Traçabilité"] });
  assert.deepEqual(separerTheme(lignes[1]), { theme: "", elements: ["Liaison froide"] });
  // virgules entre parenthèses conservées (cas réel de la preview)
  assert.deepEqual(separerTheme("Production culinaire : Cuisine traditionnelle (entrées, plats, desserts), Liaison froide").elements,
    ["Cuisine traditionnelle (entrées, plats, desserts)", "Liaison froide"]);
});

test("le contrôle détecte bien les défauts de l'ancienne sortie", () => {
  const p = controlerCv(AVANT, CV_SOURCE, CONFIRMES).join("\n");
  assert.match(p, /sans accent/);
  assert.match(p, /BAC PRO/);
  assert.match(p, /infinitif générique/);
  assert.match(p, /formules creuses/);
  assert.ok(expressionsInterdites(AVANT, INTERDITS).includes("équilibre nutritionnel"));
});

test("nouvelle sortie : accents, aucun ajout absent de la source, aucun tiret long", () => {
  assert.deepEqual(controlerCv(APRES, CV_SOURCE, CONFIRMES), []);
  assert.deepEqual(expressionsInterdites(APRES, INTERDITS), []);
  // l'élément confirmé « Oui » est bien intégré
  assert.ok(APRES.competences.some(c => c.includes("Textures modifiées")));
  // intitulés de diplômes inchangés
  for (const f of APRES.formations) assert.ok(sansAccents(CV_SOURCE).includes(sansAccents(f.intitule).split(",")[0]), f.intitule);
});

test("modèle HTML : titres lisibles, sans émoji, barre latérale remplie", () => {
  const html = genererCvHtmlFr(APRES, THEME, { pourImpression: true });
  assert.ok(!/letter-spacing/.test(html), "pas de letter-spacing");
  assert.ok(!/text-transform:\s*uppercase/.test(html), "pas de titres forcés en capitales");
  assert.ok(!/\p{Extended_Pictographic}/u.test(html), "pas d'émoji");
  const aside = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
  for (const t of ["Contact", "Compétences", "Savoir-être", "Langues", "Hygiène et sécurité alimentaire"]) assert.ok(aside.includes(t), t);
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  assert.ok(main.indexOf("Jean-Marc DUVAL") < main.indexOf("Chef de cuisine"), "poste visé sous le nom");
  assert.ok(main.includes("Expériences professionnelles") && main.includes("Formation"));
});

test("prompt serveur : accentué, règle de fidélité, plus de mots-clés « à ajouter »", () => {
  const src = readFileSync(new URL("../netlify/functions/_securite.js", import.meta.url), "utf8");
  const rewrite = src.slice(src.indexOf("rewrite: `"), src.indexOf("`,", src.indexOf("rewrite: `")));
  assert.match(rewrite, /Expérience/);
  assert.match(rewrite, /ELEMENTS_CONFIRMES/);
  assert.match(rewrite, /BAC PRO/);
  assert.match(rewrite, /Assurer/);
  assert.ok(!/envelopper\("MOTS_CLES"/.test(src));
});
