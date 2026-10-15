// Après « vite build » : génère dist/en/index.html, la page d'atterrissage
// anglaise (Hirable) servie telle quelle par Netlify sur /en.
// Même application, mais HTML servi en anglais : <html lang="en">, titre,
// description, canonical, Open Graph en_GB, hreflang, JSON-LD et contenu
// statique lisible sans JavaScript (moteurs, aperçus de liens).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEO_EN, URL_PAGE_EN, htmlStatiqueHirable } from "../src/contenuHirable.js";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(racine, "dist", "index.html");
let html = fs.readFileSync(source, "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function remplacer(motif, valeur, nom) {
  if (!motif.test(html)) throw new Error(`generer-page-en : balise introuvable (${nom})`);
  html = html.replace(motif, valeur);
}

remplacer(/<html lang="fr">/, '<html lang="en">', "html lang");
remplacer(/<title>[^<]*<\/title>/, `<title>${esc(SEO_EN.titre)}</title>`, "title");
remplacer(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(SEO_EN.description)}" />`, "description");
remplacer(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${URL_PAGE_EN}" />`, "canonical");
remplacer(/<meta property="og:locale" content="[^"]*"\s*\/?>/, '<meta property="og:locale" content="en_GB" />\n    <meta property="og:locale:alternate" content="fr_FR" />', "og:locale");
remplacer(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${URL_PAGE_EN}" />`, "og:url");
remplacer(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(SEO_EN.ogTitre)}" />`, "og:title");
remplacer(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(SEO_EN.ogDescription)}" />`, "og:description");
remplacer(/<meta property="og:image:alt" content="[^"]*"\s*\/?>/, `<meta property="og:image:alt" content="${esc(SEO_EN.ogTitre)}" />`, "og:image:alt");
remplacer(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${esc(SEO_EN.ogTitre)}" />`, "twitter:title");
remplacer(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${esc(SEO_EN.ogDescription)}" />`, "twitter:description");
remplacer(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Hirable by Recrutable",
      url: URL_PAGE_EN,
      inLanguage: "en-GB",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: SEO_EN.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Free CV analysis" },
      email: "recrutable@proton.me",
      logo: "https://recrutable.com/icon-512.png",
    })}
    </script>`, "JSON-LD");
remplacer(/<main class="seo-static">[\s\S]*?<\/main>/, htmlStatiqueHirable(), "contenu statique");

fs.mkdirSync(path.join(racine, "dist", "en"), { recursive: true });
fs.writeFileSync(path.join(racine, "dist", "en", "index.html"), html);
console.log("generer-page-en : dist/en/index.html écrit");
