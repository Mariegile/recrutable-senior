// Page d'atterrissage anglaise « English CV to French CV » (Hirable).
// Source unique du texte : affichée par l'app (HirableAccueil dans App.jsx)
// et écrite en HTML statique dans dist/en/index.html au build
// (scripts/generer-page-en.mjs), pour les moteurs et les aperçus de liens.
// Règles : aucun tiret cadratin, aucune statistique, prix réels du catalogue.

export const URL_PAGE_EN = "https://recrutable.com/en/";

export const SEO_EN = {
  titre: "English CV to French CV | Hirable by Recrutable",
  description: "Upload your English CV, paste a French job ad and get a French CV recruiters understand. Free analysis, no account needed.",
  ogTitre: "English CV to French CV",
  ogDescription: "Upload your English CV, paste a French job ad, get a French CV recruiters understand. Free analysis, then from €2.99.",
};

export const HIRABLE = {
  surtitre: "Hirable · for English speakers in France",
  titre: "English CV to French CV",
  promesse: "Upload your English CV, paste a French job ad, get a French CV recruiters understand.",
  pourQui: "Made for English speakers living in France who apply to French employers.",
  etapes: [
    { n: 1, titre: "Add your English CV", texte: "Upload the PDF or paste the text. It doesn't need to be perfect." },
    { n: 2, titre: "Paste a French job ad", texte: "From France Travail, Indeed, LinkedIn or the employer's website." },
    { n: 3, titre: "Get your French CV", texte: "Rewritten in French for that job, in the layout French recruiters expect, with a matching cover letter in French. Ready to download as a PDF." },
  ],
  faitTitre: "What it does",
  fait: [
    "Writes your whole CV in French, with correct spelling and French CV conventions.",
    "Uses the wording of the job ad when your CV already shows that skill.",
    "Shows how well your CV matches the ad before you pay anything.",
  ],
  pasTitre: "What it does not do",
  pas: [
    "It never invents a French equivalent for your degrees: original titles are kept, with a short description in French.",
    "It never adds experience, skills or figures that are not in your CV.",
    "It is not a certified translation. For official documents, use a sworn translator.",
  ],
  prixTitre: "Pricing",
  prix: [
    "Analysis: free, no account needed.",
    "French CV and cover letter: from €2.99 (top-up, 3 complete sets).",
    "Monthly plan: €5.99 for 8 sets a month. Annual plan: €49.99 for 60 sets.",
  ],
  bouton: "Start my free analysis",
  note: "The interface is in English. Your new CV and cover letter are written in French because the job ad is in French.",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// HTML statique (sans JavaScript) servi dans <div id="root"> de /en.
// React le remplace au chargement par la version interactive.
export function htmlStatiqueHirable() {
  const h = HIRABLE;
  const liste = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  return `<main class="seo-static">
<p>${esc(h.surtitre)}</p>
<h1>${esc(h.titre)}</h1>
<p><strong>${esc(h.promesse)}</strong></p>
<p>${esc(h.pourQui)}</p>
<h2>How it works</h2>
<ol>${h.etapes.map((e) => `<li><strong>${esc(e.titre)}.</strong> ${esc(e.texte)}</li>`).join("")}</ol>
<h2>${esc(h.faitTitre)}</h2>${liste(h.fait)}
<h2>${esc(h.pasTitre)}</h2>${liste(h.pas)}
<h2>${esc(h.prixTitre)}</h2>${liste(h.prix)}
<p><a href="/en/">${esc(h.bouton)}</a></p>
<p>${esc(h.note)}</p>
<noscript><p><strong>Hirable needs JavaScript. Please enable it in your browser to analyse your CV.</strong></p></noscript>
</main>`;
}
