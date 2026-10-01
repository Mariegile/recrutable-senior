// Cas de test FICTIF : cuisinier qui vise un poste de chef de cuisine
// en restauration collective médico-sociale (EHPAD).

export const CV_SOURCE = `Jean-Marc DUVAL
Cuisinier
06 12 34 56 78 | jm.duval@email.fr | Nantes (44)

EXPÉRIENCE PROFESSIONNELLE
Cuisinier, Restaurant Le Relais des Halles, Nantes
2014 - aujourd'hui
- Préparation des entrées, plats et desserts pour 200+ couverts par jour
- Gestion des commandes fournisseurs et réception des marchandises
- Application du plan HACCP et tenue des relevés de température
- Formation de 2 apprentis

Commis puis cuisinier, Cuisine centrale du SIVU Loire-Atlantique, Saint-Herblain
2006 - 2014
- Production en liaison froide, 1 500 repas par jour pour les écoles
- Préparation des régimes sans porc et sans sel
- Nettoyage et désinfection des postes

Cuisinier, Ministère de la Défense, Vannes
1998 - 2006
- Cuisine pour 300 militaires en garnison et en manœuvre
- Gestion des stocks de denrées

FORMATION
2006 Formation cuisine, EPMT (6 mois)
1997 CAP Cuisine, Lycée hôtelier de Guérande

COMPÉTENCES
HACCP, liaison froide, gestion des stocks, encadrement d'apprentis, cuisine traditionnelle

LANGUES
Français : langue maternelle
Anglais : notions

QUALITÉS
Ponctualité, travail en équipe`;

export const OFFRE = `Chef de cuisine H/F, EHPAD Les Glycines (Rezé)
Restauration collective médico-sociale, CDI

Missions :
- Encadrer une équipe de 4 cuisiniers et 2 plongeurs
- Élaborer les menus avec la diététicienne et garantir l'équilibre nutritionnel
- Préparer des repas en textures modifiées (mixé, haché) pour les résidents
- Gérer les commandes, les stocks et le budget denrées
- Appliquer le plan de maîtrise sanitaire et le contrôle de gestion des coûts

Profil recherché :
- Expérience exigée en restauration collective
- Maîtrise impérative des normes HACCP et de la sécurité alimentaire
- Connaissance des régimes alimentaires
- Le permis B serait un plus`;

// Réponses simulées du candidat aux questions Oui/Non
export const REPONSES = {
  "textures modifiées": "oui",
  "équilibre nutritionnel": "non",
  "budget": "non",
  "diététicienne": "non",
};
export const CONFIRMES = Object.keys(REPONSES).filter(k => REPONSES[k] === "oui");

// Ce qui n'est ni dans le CV ni confirmé : ne doit JAMAIS apparaître.
export const INTERDITS = ["équilibre nutritionnel", "BAC PRO", "budget", "diététicienne", "permis B", "plongeurs"];

// AVANT : sortie simulée du modèle avec l'ancien prompt (prompt sans accents,
// mots-clés manquants envoyés « à ajouter »). Reproduit les défauts constatés.
export const SORTIE_AVANT = {
  nom: "Jean-Marc DUVAL",
  titre: "Chef de cuisine",
  contact: { email: "jm.duval@email.fr", telephone: "06 12 34 56 78", ville: "Nantes (44)", linkedin: "" },
  profil: "Cuisinier experimente doté d'un excellent relationnel, dynamique et rigoureux, fort de plus de 25 ans d'experience en restauration commerciale et collective. Capable de garantir l'equilibre nutritionnel et la securite alimentaire.",
  experiences: [
    { poste: "Cuisinier", entreprise: "Restaurant Le Relais des Halles", dates: "2014 - aujourd'hui", taches: [
      "Assurer la preparation des plats pour 200+ couverts par jour",
      "Gerer les commandes fournisseurs et le budget denrees",
      "Garantir l'equilibre nutritionnel des plats",
      "Veiller au respect des normes HACCP" ] },
    { poste: "Commis puis cuisinier", entreprise: "Cuisine centrale du SIVU Loire-Atlantique", dates: "2006 - 2014", taches: [
      "Assurer la production en liaison froide en restauration collective",
      "Preparer des regimes et textures modifiees",
      "Veiller a l'hygiene des postes" ] },
    { poste: "Cuisinier", entreprise: "Ministere de la Defense", dates: "1998 - 2006", taches: [
      "Assurer la restauration de 300 militaires",
      "Gerer les stocks de denrees" ] },
  ],
  formations: [
    { annees: "2006", intitule: "BAC PRO Cuisine - EPMT (6 mois)" },
    { annees: "1997", intitule: "CAP Cuisine - Lycee hotelier de Guerande" },
  ],
  competences: ["HACCP", "Restauration collective", "Equilibre nutritionnel", "Textures modifiees", "Gestion des stocks", "Liaison froide", "Encadrement", "Securite alimentaire"],
  langues: ["Francais : langue maternelle", "Anglais : notions"],
};

// APRÈS : sortie simulée du modèle avec le nouveau prompt + réponses Oui/Non.
export const SORTIE_APRES = {
  nom: "Jean-Marc DUVAL",
  titre: "Chef de cuisine",
  contact: { email: "jm.duval@email.fr", telephone: "06 12 34 56 78", ville: "Nantes (44)", linkedin: "" },
  profil: "Cuisinier depuis 1998, en restauration commerciale et en restauration collective (cuisine centrale, armée). Production en volume jusqu'à 1 500 repas par jour en liaison froide, régimes sans porc et sans sel, application du plan HACCP. Formation et encadrement d'apprentis.",
  experiences: [
    { poste: "Cuisinier", entreprise: "Restaurant Le Relais des Halles", lieu: "Nantes", dates: "2014 - aujourd'hui", taches: [
      "Préparation des entrées, plats et desserts pour plus de 200 couverts par jour",
      "Commandes fournisseurs et réception des marchandises",
      "Application du plan HACCP, relevés de température",
      "Formation de 2 apprentis" ] },
    { poste: "Commis puis cuisinier", entreprise: "Cuisine centrale du SIVU Loire-Atlantique", lieu: "Saint-Herblain", dates: "2006 - 2014", taches: [
      "Production en liaison froide en restauration collective : 1 500 repas par jour pour les écoles",
      "Préparation des régimes sans porc et sans sel",
      "Nettoyage et désinfection des postes" ] },
    { poste: "Cuisinier", entreprise: "Ministère de la Défense", lieu: "Vannes", dates: "1998 - 2006", taches: [
      "Cuisine pour 300 militaires en garnison et en manœuvre",
      "Gestion des stocks de denrées" ] },
  ],
  formations: [
    { annees: "2006", intitule: "Formation cuisine, EPMT (6 mois)" },
    { annees: "1997", intitule: "CAP Cuisine, Lycée hôtelier de Guérande" },
  ],
  competences: [
    { theme: "Production culinaire", elements: ["Cuisine traditionnelle", "Liaison froide", "Production en volume", "Textures modifiées"] },
    { theme: "Hygiène et sécurité alimentaire", elements: ["Plan HACCP", "Relevés de température", "Nettoyage et désinfection"] },
    { theme: "Régimes alimentaires", elements: ["Sans porc", "Sans sel"] },
    { theme: "Gestion et encadrement", elements: ["Commandes fournisseurs", "Gestion des stocks", "Formation d'apprentis"] },
  ],
  savoirEtre: ["Ponctualité", "Travail en équipe"],
  langues: ["Français : langue maternelle", "Anglais : notions"],
};
