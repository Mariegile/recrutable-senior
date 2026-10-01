// ═══════════════════════════════════════════════════════════════════
//   cvModele.js : modèle HTML du CV au format français (aperçu + PDF)
//   Barre latérale (contact, compétences par thème, savoir-être, langues)
//   + colonne principale (nom, poste visé, profil, expériences, formation).
//   Titres de section en casse normale, sans espacement de lettres :
//   le letter-spacing éclate les mots à l'extraction ATS (« C O N TA C T »).
// ═══════════════════════════════════════════════════════════════════
import { separerTheme } from "./cvTexte.js";

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// theme : { primary, accent, font }
export function genererCvHtmlFr(cv, theme, opts = {}) {
  const { avecPhoto = false, pourImpression = false, sectionsMasquees = [] } = opts;
  const t = theme;
  const masquee = (id) => sectionsMasquees.includes(id);
  const contact = cv.contact || {};

  const photoBloc = avecPhoto
    ? `<div class="photo-box"><div class="photo-inner">Ajoutez<br/>votre photo</div></div>` : "";

  // Coordonnées : texte simple, sans émoji, corrigeables dans l'aperçu
  const ligneContact = (valeur, placeholder) =>
    `<p class="contact-line" contenteditable="true" spellcheck="false">${valeur ? esc(valeur) : placeholder}</p>`;
  const contactHtml = [
    ligneContact(contact.telephone, "06 XX XX XX XX"),
    ligneContact(contact.email, "votre@email.com"),
    ligneContact(contact.ville, "Votre ville"),
    contact.linkedin ? ligneContact(contact.linkedin, "") : "",
  ].join("");

  // Compétences regroupées par thème ("Thème : a, b, c")
  const competences = cv.competences || [];
  const compHtml = competences.map(ligne => {
    const { theme: th, elements } = separerTheme(ligne);
    const liste = `<ul>${elements.map(e => `<li>${esc(e)}</li>`).join("")}</ul>`;
    return th ? `<div class="comp-group"><div class="comp-theme">${esc(th)}</div>${liste}</div>` : liste;
  }).join("");

  const savoirEtre = cv.savoirEtre || [];
  const seHtml = savoirEtre.length ? `<ul>${savoirEtre.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : "";
  const langHtml = (cv.langues || []).length ? `<ul>${cv.langues.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : "";

  const expHtml = (cv.experiences || []).map(e => {
    const taches = e.taches?.length ? `<ul>${e.taches.map(tx => `<li>${esc(tx)}</li>`).join("")}</ul>` : "";
    const ou = [e.entreprise, e.lieu].filter(Boolean).map(esc).join(", ");
    return `<div class="exp-item"><div class="ligne-titre"><span class="exp-role">${esc(e.poste)}</span>${e.dates ? `<span class="dates">${esc(e.dates)}</span>` : ""}</div>${ou ? `<div class="exp-company">${ou}</div>` : ""}${taches}</div>`;
  }).join("");

  const formHtml = (cv.formations || []).map(f =>
    `<div class="form-item ligne-titre"><span class="form-label">${esc(f.intitule)}</span>${f.annees ? `<span class="dates">${esc(f.annees)}</span>` : ""}</div>`
  ).join("");

  const profilHtml = cv.profil ? `<p class="profil">${esc(cv.profil)}</p>` : "";

  const hintBloc = pourImpression ? "" : `<div class="hint">Cliquez sur une coordonnée pour la corriger</div>`;
  const footerBloc = pourImpression ? "" :
    `<div class="footer-note">Corrigez vos coordonnées à gauche si besoin, puis enregistrez au format PDF depuis la fenêtre d'impression</div>`;

  const section = (titre, contenu, cls = "") => `<section class="${cls}"><h2>${titre}</h2>${contenu}</section>`;

  const sidebar = [
    photoBloc,
    hintBloc,
    section("Contact", contactHtml),
    (compHtml && !masquee("competences")) ? section("Compétences", compHtml) : "",
    (seHtml && !masquee("competences")) ? section("Savoir-être", seHtml) : "",
    (langHtml && !masquee("langues")) ? section("Langues", langHtml) : "",
  ].join("");

  const main = [
    `<header><h1>${esc(cv.nom)}</h1>${cv.titre ? `<div class="poste-vise">${esc(cv.titre)}</div>` : ""}</header>`,
    (profilHtml && !masquee("profil")) ? section("Profil", profilHtml) : "",
    (expHtml && !masquee("experiences")) ? section("Expériences professionnelles", expHtml) : "",
    (formHtml && !masquee("formations")) ? section("Formation", formHtml) : "",
  ].join("");

  const css = `@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:210mm;font-family:${t.font};color:#222;background:#fff;font-size:9.5pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;overflow:hidden;display:grid;grid-template-columns:66mm 1fr;grid-template-areas:"side main"}
.main{grid-area:main;padding:16mm 12mm 10mm 10mm;min-width:0}
.side{grid-area:side;background:${t.primary};color:#fff;padding:16mm 7mm 10mm 8mm;min-width:0}
h1{font-size:22pt;line-height:1.1;font-weight:700;color:${t.primary}}
.poste-vise{font-size:12pt;font-weight:600;color:${t.accent};margin-top:4px}
header{margin-bottom:6mm}
h2{font-size:11.5pt;font-weight:700;margin:0 0 6px;padding-bottom:3px}
.main h2{color:${t.primary};border-bottom:1.5px solid ${t.accent}}
.side h2{color:#fff;border-bottom:1px solid rgba(255,255,255,0.35)}
section{margin-bottom:5mm}
.side p,.side li{font-size:8.9pt;line-height:1.45;color:rgba(255,255,255,0.92)}
.contact-line{margin-bottom:3px;word-break:break-word}
.side ul{list-style:none;margin:0 0 4px}
.side li{padding-left:9px;position:relative;margin-bottom:2px}
.side li::before{content:"";position:absolute;left:0;top:0.62em;width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,0.8)}
.comp-group{margin-bottom:6px}
.comp-theme{font-size:9pt;font-weight:700;color:#fff;margin-bottom:2px}
.profil{font-size:9.4pt;line-height:1.55}
.ligne-titre{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.dates{font-size:8.6pt;color:#555;white-space:nowrap;flex-shrink:0}
.exp-item{margin-bottom:9px}
.exp-role{font-weight:700;font-size:10pt;color:#1a1a1a}
.exp-company{font-weight:600;color:${t.primary};font-size:9.2pt;margin:1px 0 3px}
.main ul{margin:2px 0 0 15px;padding:0}
.main li{font-size:9pt;line-height:1.42;margin-bottom:2px}
.form-item{margin-bottom:4px;font-size:9.2pt}
.form-label{color:#222}
.photo-box{width:30mm;height:30mm;border:2px dashed rgba(255,255,255,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 6mm}
.photo-inner{color:rgba(255,255,255,0.75);font-size:7pt;text-align:center;line-height:1.3}
[contenteditable]{outline:none;border-bottom:1px dashed rgba(255,255,255,0.35);cursor:text}
[contenteditable]:focus{background:rgba(255,255,255,0.12)}
.hint{background:#fff3cd;color:#856404;font-size:7pt;padding:3px 6px;margin-bottom:4mm;border-radius:3px}
.footer-note{position:absolute;bottom:2mm;right:12mm;font-size:6pt;color:#bbb}
@media print{.hint,.footer-note{display:none}[contenteditable]{border-bottom:none}}`;

  // Colonne principale en premier dans le DOM : nom et poste visé sont lus
  // en premier par les ATS ; la grille affiche la barre latérale à gauche.
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>CV ${esc(cv.nom)}</title>
<style>${css}</style></head>
<body><div class="page" style="position:relative"><main class="main">${main}</main><aside class="side">${sidebar}</aside>${footerBloc}</div></body></html>`;
}
