// Pages légales : mentions légales, CGV, politique de confidentialité.
// Routes dédiées (/mentions-legales, /cgv, /confidentialite), rendues par
// main.jsx hors de l'application. Les champs entre crochets [À COMPLÉTER]
// sont mis en évidence et doivent être renseignés avant mise en production.
import { useEffect, useState } from "react";

// Liste des routes : voir routesLegales.js

const LANG_KEY = "recrutable_lang";
const EMAIL = "recrutable@proton.me";
const MAJ = "2 octobre 2026";
const MAJ_EN = "October 2, 2026";

const C = {
  bg: "#F5F0E8", card: "#FFFFFF", subtle: "#FAF7F2", border: "#E5DDD0",
  text: "#1A1612", text2: "#4A4138", muted: "#6B6052",
  primary: "#1B3A5C", accent: "#A85D2C", warnBg: "#FAF1DC", warnText: "#7A5A14",
};
const SERIF = "'Fraunces Variable', 'Fraunces', Georgia, 'Times New Roman', serif";
const SANS = "'DM Sans Variable', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ── Contenus ────────────────────────────────────────────────────────
// Chaque page : { titre, intro?, sections: [{ h, p: [paragraphes | listes] }] }
// Un élément de p peut être une chaîne ou { liste: [...] }.

const MENTIONS = {
  fr: {
    titre: "Mentions légales",
    sections: [
      { h: "Éditeur du site", p: [
        { liste: [
          "Nom : Virgile Chrétien",
          "Statut : entrepreneur individuel (micro-entreprise) [À COMPLÉTER : statut exact, immatriculation en cours]",
          "SIRET : [À COMPLÉTER]",
          "Adresse : [À COMPLÉTER]",
          "Téléphone : [À COMPLÉTER]",
          `E-mail : ${EMAIL}`,
          "TVA : [À COMPLÉTER : « TVA non applicable, article 293 B du CGI » si franchise en base, ou numéro de TVA intracommunautaire]",
        ] },
        "Directeur de la publication : Virgile Chrétien.",
      ] },
      { h: "Hébergement", p: [
        "Le site est hébergé par Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, États-Unis (www.netlify.com).",
        "Les données des comptes et des crédits sont hébergées par Supabase Inc. (www.supabase.com) [À COMPLÉTER : région d'hébergement du projet Supabase].",
      ] },
      { h: "Propriété intellectuelle", p: [
        "La marque Recrutable, le logo, les textes, l'interface et le code du site sont protégés. Toute reproduction sans autorisation écrite est interdite.",
        "Les CV, offres et lettres que vous saisissez ou générez restent les vôtres : vous pouvez les utiliser librement.",
      ] },
      { h: "Contact", p: [
        `Pour toute question sur le site ou pour signaler un contenu : ${EMAIL}.`,
      ] },
    ],
  },
  en: {
    titre: "Legal notice",
    sections: [
      { h: "Publisher", p: [
        { liste: [
          "Name: Virgile Chrétien",
          "Status: sole trader (French micro-entreprise) [TO COMPLETE: exact status, registration in progress]",
          "SIRET: [TO COMPLETE]",
          "Address: [TO COMPLETE]",
          "Phone: [TO COMPLETE]",
          `Email: ${EMAIL}`,
          "VAT: [TO COMPLETE]",
        ] },
        "Publication director: Virgile Chrétien.",
      ] },
      { h: "Hosting", p: [
        "The site is hosted by Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, USA (www.netlify.com).",
        "Account and credit data are hosted by Supabase Inc. (www.supabase.com) [TO COMPLETE: Supabase project region].",
      ] },
      { h: "Intellectual property", p: [
        "The Recrutable brand, logo, texts, interface and code are protected. Any reproduction without written permission is prohibited.",
        "The résumés, job postings and letters you enter or generate remain yours.",
      ] },
      { h: "Contact", p: [`${EMAIL}`] },
    ],
  },
};

const CGV = {
  fr: {
    titre: "Conditions générales de vente",
    sections: [
      { h: "1. Objet", p: [
        "Les présentes conditions régissent l'utilisation du service Recrutable (recrutable.com), édité par Virgile Chrétien (voir les mentions légales), et l'achat de crédits par des consommateurs.",
        "Recrutable compare gratuitement un CV à une offre d'emploi, puis, contre des crédits, réécrit le CV pour cette offre et rédige une lettre de motivation assortie, à l'aide d'un service d'intelligence artificielle.",
      ] },
      { h: "2. Compte", p: [
        "L'analyse est gratuite et ne nécessite pas de compte. La réécriture du CV, la lettre et l'achat de crédits nécessitent un compte (e-mail et mot de passe, ou connexion Google). Vous êtes responsable de la confidentialité de vos identifiants.",
      ] },
      { h: "3. Offres et prix", p: [
        "Les prix sont indiqués en euros, toutes taxes comprises. [À COMPLÉTER : mention TVA, par exemple « TVA non applicable, article 293 B du CGI »]",
        { liste: [
          "Recharge : 2,99 €, paiement unique, 3 crédits.",
          "Abonnement mensuel : 5,99 € par mois, 8 crédits par mois, sans engagement.",
          "Abonnement annuel : 49,99 € par an, 60 crédits.",
        ] },
        "1 crédit = 1 dossier complet pour une offre : réécriture du CV, puis lettre de motivation, traduction et pistes de reconversion associées, téléchargement et copie.",
        "Pour garantir le service à tous, des limites d'usage quotidiennes s'appliquent (par exemple 30 réécritures par jour et par compte).",
        "Validité des crédits : [À COMPLÉTER : durée de validité des crédits achetés et sort des crédits non utilisés à la fin d'un abonnement].",
      ] },
      { h: "4. Commande et paiement", p: [
        "Le paiement est effectué par carte bancaire via Stripe (Stripe Payments Europe Ltd). Recrutable n'a jamais accès à vos numéros de carte.",
        "Les crédits sont ajoutés automatiquement au compte utilisé pour l'achat dès la confirmation du paiement par Stripe, en général en quelques secondes. Un reçu est envoyé par Stripe à l'adresse e-mail indiquée lors du paiement.",
        "Abonnements : ils sont renouvelés automatiquement à chaque échéance (mois ou année) jusqu'à résiliation. Vous pouvez résilier à tout moment, la résiliation prenant effet à la fin de la période en cours, en ligne, depuis le bouton « Gérer ou résilier mon abonnement » de la fenêtre « Recharger mon compte » (portail client sécurisé de Stripe), ou par e-mail à " + EMAIL + ".",
      ] },
      { h: "5. Fourniture du service et droit de rétractation", p: [
        "Les crédits et les documents générés sont des contenus numériques fournis immédiatement après le paiement, sans support matériel.",
        "Conformément à l'article L221-28, 13° du Code de la consommation, le droit de rétractation ne peut pas être exercé pour un contenu numérique dont l'exécution a commencé, après votre accord préalable exprès et votre renoncement exprès à ce droit, recueillis avant le paiement.",
        "Avant tout paiement, vous devez cocher la case : « J'accepte les conditions générales de vente. Je demande l'accès immédiat aux crédits et je renonce à mon droit de rétractation dès leur utilisation. » Votre accord est enregistré et horodaté sur nos serveurs. Tant qu'aucun crédit acheté n'a été utilisé, vous pouvez demander le remboursement de l'achat dans les 14 jours.",
        "[À COMPLÉTER : confirmation de l'accord sur support durable, par exemple mention dans le reçu ou la facture Stripe envoyés par e-mail.]",
      ] },
      { h: "6. Échec technique et remboursement", p: [
        "Si la réécriture échoue pour une raison technique (erreur du service d'intelligence artificielle, réponse incomplète, coupure), le crédit débité est automatiquement recrédité sur votre compte.",
        `Si un paiement validé n'a pas été crédité dans les 15 minutes, ou si un problème technique vous a empêché d'utiliser un crédit, écrivez à ${EMAIL} : nous recréditons le compte ou remboursons l'achat.`,
      ] },
      { h: "7. Garanties et responsabilité", p: [
        "Vous bénéficiez de la garantie légale de conformité des contenus numériques (articles L224-25-12 et suivants du Code de la consommation).",
        "Les documents sont produits automatiquement à partir des informations que vous fournissez ; le service est conçu pour ne rien inventer, mais vous devez relire et vérifier chaque document avant de l'envoyer. Recrutable ne garantit pas l'obtention d'un entretien ou d'un emploi.",
        "Vous vous engagez à ne saisir que des informations vous concernant ou que vous êtes autorisé à utiliser.",
      ] },
      { h: "8. Réclamations et médiation", p: [
        `Pour toute réclamation : ${EMAIL}. Nous répondons sous 7 jours ouvrés [À COMPLÉTER : délai].`,
        "En cas de litige non résolu, vous pouvez recourir gratuitement au médiateur de la consommation : [À COMPLÉTER : nom, adresse et site du médiateur].",
      ] },
      { h: "9. Droit applicable", p: [
        "Les présentes conditions sont soumises au droit français. À défaut d'accord amiable, le litige relève des tribunaux compétents, le consommateur pouvant saisir la juridiction du lieu où il demeurait au moment de la commande.",
      ] },
    ],
  },
  en: {
    titre: "Terms of sale",
    intro: "This English version is provided for convenience; the French version prevails.",
    sections: [
      { h: "1. Purpose", p: [
        "These terms govern the use of Recrutable (recrutable.com), published by Virgile Chrétien (see the legal notice), and the purchase of credits by consumers.",
        "Recrutable compares a résumé with a job posting for free, then, for credits, rewrites the résumé for that posting and writes a matching cover letter using an artificial intelligence service.",
      ] },
      { h: "2. Account", p: [
        "The analysis is free and needs no account. The rewrite, the letter and buying credits require an account (email and password, or Google sign-in).",
      ] },
      { h: "3. Offers and prices", p: [
        "Prices are in euros, all taxes included. [TO COMPLETE: VAT statement]",
        { liste: [
          "Top-up: €2.99, one-time payment, 3 credits.",
          "Monthly subscription: €5.99 per month, 8 credits per month, no commitment.",
          "Annual subscription: €49.99 per year, 60 credits.",
        ] },
        "1 credit = 1 complete set for one job: résumé rewrite, then the related cover letter, translation and career-change ideas, download and copy.",
        "Daily usage limits apply (for example 30 rewrites per day per account).",
        "Credit validity: [TO COMPLETE].",
      ] },
      { h: "4. Order and payment", p: [
        "Payment is made by card through Stripe. Recrutable never sees your card numbers.",
        "Credits are added automatically to the account used for the purchase once Stripe confirms the payment. Stripe emails a receipt.",
        "Subscriptions renew automatically until cancelled. You can cancel at any time, effective at the end of the current period, online with the « Manage or cancel my subscription » button (Stripe secure customer portal) or by email.",
      ] },
      { h: "5. Delivery and right of withdrawal", p: [
        "Credits and generated documents are digital content supplied immediately after payment.",
        "Under article L221-28 13° of the French Consumer Code, the right of withdrawal does not apply to digital content whose supply has started with your prior express consent and express waiver of that right, collected before payment.",
        "Before paying, you must tick a box accepting these terms, requesting immediate access to the credits and waiving your right of withdrawal once they are used. Your consent is recorded and timestamped on our servers. As long as no purchased credit has been used, you may request a refund within 14 days.",
        "[TO COMPLETE: confirmation on a durable medium, e.g. in the Stripe receipt or invoice.]",
      ] },
      { h: "6. Technical failure and refunds", p: [
        "If a rewrite fails for a technical reason, the credit is automatically returned to your account.",
        `If a confirmed payment is not credited within 15 minutes, email ${EMAIL}: we will credit your account or refund the purchase.`,
      ] },
      { h: "7. Warranties and liability", p: [
        "You benefit from the legal conformity guarantee for digital content (French Consumer Code, articles L224-25-12 et seq.).",
        "Documents are generated from the information you provide; always review them before sending. Recrutable does not guarantee an interview or a job.",
      ] },
      { h: "8. Complaints and mediation", p: [
        `Complaints: ${EMAIL}. Consumer mediator: [TO COMPLETE].`,
      ] },
      { h: "9. Governing law", p: ["French law applies."] },
    ],
  },
};

const CONFIDENTIALITE = {
  fr: {
    titre: "Politique de confidentialité",
    sections: [
      { h: "Responsable du traitement", p: [
        `Virgile Chrétien, éditeur de Recrutable (voir les mentions légales). Contact pour toute question sur vos données : ${EMAIL}.`,
      ] },
      { h: "Données traitées", p: [
        { liste: [
          "Compte : adresse e-mail, identifiant technique, mot de passe (stocké sous forme chiffrée par Supabase) ou, en cas de connexion Google, les informations transmises par Google (e-mail, nom, photo de profil).",
          "Consentement avant paiement : date et heure, offre choisie, version du texte accepté (CGV et renonciation au droit de rétractation).",
          "Crédits et paiements : solde de crédits, historique des mouvements (date, nombre de crédits, référence de la session de paiement Stripe), identifiant client Stripe. Les données de carte bancaire sont traitées uniquement par Stripe.",
          "CV et offres d'emploi : l'analyse gratuite est réalisée dans votre navigateur, sans envoi à nos serveurs. Pour la réécriture, la lettre, la traduction et les pistes de reconversion, le texte du CV et de l'offre est envoyé à nos fonctions serveur puis au service d'intelligence artificielle d'Anthropic, le temps du traitement. Nous ne conservons pas vos CV ni vos offres sur nos serveurs.",
          "Données d'utilisation : nombre d'utilisations par jour et par action (limites anti-abus), adresse IP utilisée temporairement pour limiter le nombre de requêtes, journaux techniques de l'hébergeur.",
        ] },
      ] },
      { h: "Finalités et bases légales", p: [
        { liste: [
          "Fournir le service, gérer votre compte, vos crédits et vos achats : exécution du contrat.",
          "Tenir la comptabilité et conserver les pièces de paiement : obligation légale.",
          "Conserver la preuve de votre accord avant paiement : obligation légale et intérêt légitime (preuve en cas de litige).",
          "Sécuriser le service et prévenir les abus (limites de requêtes, quotas) : intérêt légitime.",
        ] },
        "Vos données ne sont ni vendues, ni utilisées à des fins publicitaires, ni utilisées pour entraîner des modèles d'intelligence artificielle par Recrutable.",
      ] },
      { h: "Durées de conservation", p: [
        { liste: [
          "CV et offres : non conservés sur nos serveurs. Ils restent enregistrés dans votre navigateur (stockage local) pour reprendre votre session, jusqu'à ce que vous cliquiez sur « Nouvelle candidature » ou effaciez les données du site.",
          "Côté Anthropic : traitement le temps de la requête, puis conservation limitée selon la politique de l'API d'Anthropic [À COMPLÉTER : durée actuelle indiquée par Anthropic, à vérifier].",
          "Compte et solde de crédits : tant que le compte existe ; supprimés sur demande [À COMPLÉTER : durée d'inactivité au-delà de laquelle le compte est supprimé].",
          "Historique des paiements et transactions : 10 ans (obligation comptable).",
          "Preuves de consentement avant paiement : durée de la relation contractuelle, puis 5 ans (prescription).",
          "Compteurs d'utilisation quotidiens : [À COMPLÉTER : durée réelle de conservation en base].",
          "Adresse IP pour la limitation des requêtes : en mémoire, quelques minutes, non enregistrée. Journaux de l'hébergeur : selon la politique de Netlify.",
        ] },
      ] },
      { h: "Destinataires et sous-traitants", p: [
        { liste: [
          "Netlify, Inc. (hébergement du site et des fonctions serveur), États-Unis.",
          "Supabase Inc. (base de données, comptes et authentification) [À COMPLÉTER : région d'hébergement].",
          "Stripe Payments Europe Ltd (paiement), Irlande, avec des transferts possibles vers Stripe, Inc. aux États-Unis.",
          "Anthropic PBC (intelligence artificielle : réécriture, lettre, traduction), États-Unis. Le contenu de votre CV et de l'offre lui est transmis pour chaque génération.",
          "Google (uniquement si vous choisissez la connexion avec Google). Les polices de caractères sont hébergées sur notre site : aucun appel à Google Fonts.",
        ] },
      ] },
      { h: "Transferts hors de l'Union européenne", p: [
        "Certains prestataires sont situés aux États-Unis, en particulier Anthropic, qui traite le contenu des CV. Ces transferts sont encadrés par le cadre de protection des données UE-États-Unis (Data Privacy Framework) lorsque le prestataire y est certifié, et/ou par les clauses contractuelles types de la Commission européenne prévues dans les accords de traitement des données de ces prestataires. [À COMPLÉTER : vérifier, pour chaque prestataire, le mécanisme applicable (certification DPF de Netlify, Stripe, Anthropic, Supabase ; clauses contractuelles types) et la signature des accords de traitement (DPA).]",
      ] },
      { h: "Stockage dans votre navigateur et cookies", p: [
        "Recrutable n'utilise aucun cookie de mesure d'audience ni de publicité. Le site enregistre dans votre navigateur (stockage local) uniquement des données nécessaires à son fonctionnement, qui ne nécessitent pas de consentement :",
        { liste: [
          "recrutable_session_v1 : vos saisies et documents en cours, pour reprendre où vous en étiez.",
          "recrutable_lang : la langue choisie (FR ou EN).",
          "sb-…-auth-token : votre session de connexion (Supabase).",
          "recrutable_used_sessions : les références des paiements déjà traités, pour éviter un double affichage.",
          "recrutable_credits : ancien compteur local de crédits.",
          "achat_apres_connexion (stockage de session) : reprendre un achat commencé avant la connexion.",
        ] },
        "Lors du paiement, la page Stripe peut déposer ses propres cookies, nécessaires à la sécurité du paiement (voir la politique de Stripe).",
      ] },
      { h: "Vos droits", p: [
        `Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, ainsi que du droit de définir des directives sur leur sort après votre décès. Pour les exercer, écrivez à ${EMAIL} depuis l'adresse de votre compte. Nous répondons dans un délai d'un mois.`,
        "Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).",
      ] },
    ],
  },
  en: {
    titre: "Privacy policy",
    intro: "This English version is provided for convenience; the French version prevails.",
    sections: [
      { h: "Controller", p: [`Virgile Chrétien, publisher of Recrutable. Contact: ${EMAIL}.`] },
      { h: "Data processed", p: [
        { liste: [
          "Account: email address, technical ID, password (stored encrypted by Supabase) or, with Google sign-in, the data provided by Google (email, name, profile picture).",
          "Credits and payments: credit balance, movement history (date, credits, Stripe session reference), Stripe customer ID. Card data is handled by Stripe only.",
          "Résumés and job postings: the free analysis runs in your browser. For the rewrite, letter, translation and career-change ideas, the text is sent to our server functions and then to Anthropic's AI service for processing. We do not store your résumés or postings on our servers.",
          "Usage data: daily usage counts per action, IP address used temporarily for rate limiting, host technical logs.",
        ] },
      ] },
      { h: "Purposes and legal bases", p: [
        { liste: [
          "Providing the service, account, credits and purchases: performance of the contract.",
          "Accounting records: legal obligation.",
          "Security and abuse prevention: legitimate interest.",
        ] },
      ] },
      { h: "Retention", p: [
        { liste: [
          "Résumés and postings: not stored on our servers; kept in your browser until you start a new application or clear site data.",
          "Anthropic: limited retention under Anthropic's API policy [TO COMPLETE].",
          "Account and balance: while the account exists [TO COMPLETE: inactivity period].",
          "Payment history: 10 years (accounting obligation).",
          "Daily usage counters: [TO COMPLETE].",
        ] },
      ] },
      { h: "Processors", p: [
        { liste: [
          "Netlify, Inc. (hosting), USA.",
          "Supabase Inc. (database and authentication) [TO COMPLETE: region].",
          "Stripe Payments Europe Ltd (payments), Ireland, with possible transfers to the USA.",
          "Anthropic PBC (artificial intelligence), USA.",
          "Google (only if you choose Google sign-in). Fonts are self-hosted: no call to Google Fonts.",
        ] },
      ] },
      { h: "Transfers outside the EU", p: [
        "Some providers are in the USA, notably Anthropic, which processes résumé content. Transfers rely on the EU-US Data Privacy Framework where the provider is certified and/or the European Commission's standard contractual clauses. [TO COMPLETE: check each provider.]",
      ] },
      { h: "Browser storage and cookies", p: [
        "No analytics or advertising cookies. The site stores in your browser only what it needs to work: recrutable_session_v1 (your work in progress), recrutable_lang (language), sb-…-auth-token (login session), recrutable_used_sessions (processed payments), recrutable_credits (legacy counter), achat_apres_connexion (purchase started before login). Stripe may set its own cookies on its payment page.",
      ] },
      { h: "Your rights", p: [
        `Access, rectification, erasure, restriction, objection and portability: email ${EMAIL} from your account address. You may lodge a complaint with the CNIL (www.cnil.fr).`,
      ] },
    ],
  },
};

const PAGES = {
  "/mentions-legales": MENTIONS,
  "/cgv": CGV,
  "/confidentialite": CONFIDENTIALITE,
};

const LIENS = [
  { href: "/mentions-legales", fr: "Mentions légales", en: "Legal notice" },
  { href: "/cgv", fr: "CGV", en: "Terms of sale" },
  { href: "/confidentialite", fr: "Confidentialité", en: "Privacy" },
];

// Met en évidence les champs [À COMPLÉTER] / [TO COMPLETE]
function Texte({ s }) {
  return s.split(/(\[[^\]]+\])/g).map((bout, i) =>
    bout.startsWith("[") ? (
      <mark key={i} style={{ background: C.warnBg, color: C.warnText, fontWeight: 700, padding: "0 3px", borderRadius: "3px" }}>{bout}</mark>
    ) : bout
  );
}

function lireLang() {
  try { return localStorage.getItem(LANG_KEY) === "en" ? "en" : "fr"; } catch { return "fr"; }
}

export default function PagesLegales({ chemin }) {
  const [lang, setLangState] = useState(lireLang);
  const page = (PAGES[chemin] || MENTIONS)[lang];
  const setLang = (l) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* stockage indisponible */ } };

  useEffect(() => {
    document.title = `${page.titre} | Recrutable`;
    document.documentElement.lang = lang;
  }, [page.titre, lang]);

  const T = (fr, en) => (lang === "en" ? en : fr);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SANS, overflowWrap: "anywhere", textAlign: "left" }}>
      <header style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "14px 16px" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <a href="/" aria-label={T("Retour à l'accueil de Recrutable", "Back to Recrutable home")} style={{ display: "block", minWidth: 0 }}>
            <img src="/logo-recrutable.svg" alt="Recrutable" width="154" height="24" style={{ display: "block", height: "24px", width: "auto", maxWidth: "100%" }}/>
          </a>
          <div style={{ display: "inline-flex", background: C.subtle, border: `1px solid ${C.border}`, borderRadius: "9px", padding: "2px", flexShrink: 0 }}>
            {["fr", "en"].map(l => (
              <button key={l} onClick={() => setLang(l)} aria-label={l === "fr" ? "Français" : "English"} style={{
                padding: "6px 12px", minHeight: "36px", minWidth: "40px", border: "none", borderRadius: "7px", cursor: "pointer",
                background: lang === l ? C.primary : "transparent", color: lang === l ? "#FFF" : C.text2,
                fontSize: "13px", fontWeight: 700, fontFamily: SANS, lineHeight: 1,
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "760px", margin: "0 auto", padding: "24px 16px 48px" }}>
        <nav aria-label={T("Pages légales", "Legal pages")} style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
          {LIENS.map(l => (
            <a key={l.href} href={l.href} aria-current={l.href === chemin ? "page" : undefined} style={{
              padding: "7px 12px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, textDecoration: "none",
              border: `1px solid ${l.href === chemin ? C.primary : C.border}`,
              background: l.href === chemin ? C.primary : C.card, color: l.href === chemin ? "#FFF" : C.text2,
            }}>{l[lang]}</a>
          ))}
        </nav>

        <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "24px 18px" }}>
          <h1 style={{ fontFamily: SERIF, fontSize: "28px", lineHeight: 1.2, margin: "0 0 6px", color: C.text, letterSpacing: "normal", fontWeight: 700 }}>{page.titre}</h1>
          <p style={{ fontSize: "13px", color: C.muted, margin: "0 0 16px" }}>{T(`Dernière mise à jour : ${MAJ}`, `Last updated: ${MAJ_EN}`)}</p>

          <div role="note" style={{ background: C.warnBg, color: C.warnText, borderRadius: "10px", padding: "12px 14px", fontSize: "14px", lineHeight: 1.5, marginBottom: "18px" }}>
            {T("Modèle à faire relire par un professionnel du droit avant publication : ce texte ne constitue pas un avis juridique. Les champs surlignés sont à compléter.",
               "Template to be reviewed by a legal professional before publication: this text is not legal advice. Highlighted fields must be completed.")}
          </div>

          {page.intro && <p style={{ fontStyle: "italic", color: C.text2 }}>{page.intro}</p>}

          {page.sections.map(sec => (
            <section key={sec.h} style={{ marginTop: "22px" }}>
              <h2 style={{ fontFamily: SERIF, fontSize: "20px", lineHeight: 1.3, margin: "0 0 8px", color: C.primary }}>{sec.h}</h2>
              {sec.p.map((x, i) => typeof x === "string" ? (
                <p key={i} style={{ fontSize: "15.5px", lineHeight: 1.65, color: C.text2, margin: "0 0 10px" }}><Texte s={x}/></p>
              ) : (
                <ul key={i} style={{ fontSize: "15.5px", lineHeight: 1.65, color: C.text2, margin: "0 0 10px", paddingLeft: "20px" }}>
                  {x.liste.map((li, j) => <li key={j} style={{ marginBottom: "4px" }}><Texte s={li}/></li>)}
                </ul>
              ))}
            </section>
          ))}
        </article>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px" }}>
          <a href="/" style={{ color: C.primary, fontWeight: 600 }}>{T("← Retour à Recrutable", "← Back to Recrutable")}</a>
        </p>
      </main>
    </div>
  );
}
