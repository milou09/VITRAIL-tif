import React, { useEffect, useRef, useState, useCallback } from "react";

const MAX_WIDTH = 1000;
const DARK_THRESHOLD = 90;
const COLOR_TOLERANCE = 35;
const GLASS_STORAGE_KEY = "vitrail_tiffany_glasses_v2";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function toSafeNumber(v, fb = 0) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isFinite(n) ? n : fb;
}
function hexToRgba(hex) {
  const c = String(hex || "#7dd3fc").replace("#", "");
  const f =
    c.length === 3
      ? c
          .split("")
          .map((x) => x + x)
          .join("")
      : c.padEnd(6, "0");
  return {
    r: parseInt(f.slice(0, 2), 16),
    g: parseInt(f.slice(2, 4), 16),
    b: parseInt(f.slice(4, 6), 16),
    a: 0.7,
  };
}
function normalizeGlass(g) {
  if (!g || typeof g !== "object") return null;
  const nom = typeof g.nom === "string" ? g.nom : "Verre sans nom";
  const couleur =
    typeof g.couleur === "string" && g.couleur ? g.couleur : "#7dd3fc";
  const prix_dm2 = toSafeNumber(g.prix_dm2, 0);
  return {
    id: g.id ?? Date.now() + Math.floor(Math.random() * 1000),
    nom,
    prix_dm2,
    couleur,
    overlayColor: g.overlayColor ?? hexToRgba(couleur),
  };
}

/* ─── formula parser ──────────────────────────────────────────────────────── */
function tokenize(f) {
  const re = /\s*([A-Za-z_][A-Za-z0-9_]*|\d*\.?\d+|[()+\-*/])\s*/g;
  const t = [];
  let m,
    c = 0;
  while ((m = re.exec(f)) !== null) {
    t.push(m[1]);
    c += m[0].length;
  }
  if (c !== f.length) throw new Error("Formule invalide");
  return t;
}
function evalFormula(formula, vars) {
  const t = tokenize(formula);
  let i = 0;
  const expr = () => {
    let v = term();
    while (i < t.length && (t[i] === "+" || t[i] === "-")) {
      const op = t[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const term = () => {
    let v = factor();
    while (i < t.length && (t[i] === "*" || t[i] === "/")) {
      const op = t[i++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const factor = () => {
    const tok = t[i];
    if (tok === "(") {
      i++;
      const v = expr();
      if (t[i] !== ")") throw new Error("Parenthèse manquante");
      i++;
      return v;
    }
    if (tok === "+" || tok === "-") {
      i++;
      const v = factor();
      return tok === "-" ? -v : v;
    }
    if (/^\d*\.?\d+$/.test(tok || "")) {
      i++;
      return parseFloat(tok);
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok || "")) {
      i++;
      if (!(tok in vars)) throw new Error(`Variable inconnue : ${tok}`);
      return vars[tok];
    }
    throw new Error("Formule invalide");
  };
  const res = expr();
  if (i !== t.length || !isFinite(res)) throw new Error("Formule invalide");
  return res;
}

/* ─── compliments ─────────────────────────────────────────────────────────── */
const C_FUNNY = [
  "Ce vitrail est plus stylé qu'un coucher de soleil à Bali.",
  "Même un musée serait jaloux de ça.",
  "Ce vitrail a plus de classe que la plupart des salons bourgeois.",
  "Franchement, les cathédrales peuvent aller se rhabiller.",
  "C'est le genre de truc qui fait pleurer les gens sans qu'ils sachent pourquoi.",
  "Si la lumière du matin passe là-dedans, les voisins vont frapper à la porte.",
  "Ce vitrail ferait passer n'importe quelle fenêtre IKEA pour une honte nationale.",
  "On est clairement dans la catégorie 'œuvre que les enfants hériteront'.",
  "Louis Comfort Tiffany himself aurait hoché la tête avec respect.",
  "Ce truc pourrait faire la une d'un magazine que personne ne lit mais tout le monde expose.",
];

const C_ABSURD = [
  "Ce vitrail pourrait probablement résoudre des équations.",
  "Ce truc mérite presque un passeport.",
  "Je suis presque sûr que ce vitrail a une personnalité.",
  "Le verre a atteint un niveau de conscience supérieur.",
  "Les photons qui passent là-dedans ressortent changés, philosophiquement.",
  "Ce vitrail a probablement des opinions sur le réchauffement climatique.",
  "Je pense que la lumière du soleil a signé un contrat exclusif avec cette pièce.",
  "Les abeilles de la région viennent de changer leur itinéraire pour passer devant.",
  "Ce vitrail pourrait guérir une mauvaise journée. Des études le montreront bientôt.",
  "À ce niveau de qualité, le verre a arrêté d'être un matériau pour devenir un argument.",
];

// Each roast has a text + a Snow mood that drives which SVG expression is shown
const C_ROAST = [
  { text: "On dirait un vitrail fait un lundi matin.", mood: "bored" },
  { text: "C'est\u2026 audacieux. Tr\u00e8s audacieux.", mood: "royal" },
  {
    text: "M\u00eame une \u00e9glise abandonn\u00e9e h\u00e9siterait.",
    mood: "disgusted",
  },
  {
    text: "On sent que le vitrail a pris des d\u00e9cisions seul.",
    mood: "suspicious",
  },
  {
    text: "Les couleurs ont l'air d'avoir eu une petite dispute.",
    mood: "shocked",
  },
  {
    text: "C'est ce qu'on appelle un style 'work in progress' assum\u00e9.",
    mood: "skeptical",
  },
  {
    text: "Il y a une \u00e9nergie tr\u00e8s\u2026 libre l\u00e0-dedans. Tr\u00e8s libre.",
    mood: "confused",
  },
  {
    text: "On voit clairement que l'artiste avait des choses \u00e0 dire. On ne sait pas quoi, mais des choses.",
    mood: "judging",
  },
  { text: "C'est courageux. Vraiment. On salue le courage.", mood: "pitying" },
  {
    text: "Certains choix ont \u00e9t\u00e9 faits. On ne dira pas lesquels.",
    mood: "deadpan",
  },
];

const priceC = (p) =>
  p < 50
    ? [
        "Petit prix, mais gros charme.",
        "Budget léger, effet lourd.",
        "On est sur un rapport style/prix franchement criminel.",
        "Pour ce prix-là, c'est presque indécent de beauté.",
      ]
    : p < 200
    ? [
        "Là on commence à parler sérieusement.",
        "Ça respire le travail bien fait.",
        "Tu pourrais clairement vendre ça sans rougir.",
        "C'est le juste prix pour quelque chose qui va durer des décennies.",
        "À ce tarif, c'est de l'artisanat honnête. Rare.",
      ]
    : [
        "OK là on est sur du luxe.",
        "Ça mérite une vitrine et un spot LED.",
        "On appelle ça une pièce de collection.",
        "À ce prix, la livraison devrait inclure des gants blancs.",
        "C'est le genre d'investissement que les banquiers ne comprennent pas et les artistes, si.",
      ];

const colorC = (zones) => {
  const col = zones.filter((z) => z.color);
  if (!col.length) return [];
  const r = [];
  if (col.some((z) => z.color.b > z.color.r && z.color.b > z.color.g))
    r.push(
      "Ambiance océan, c'est propre.",
      "Ce bleu-là, c'est le genre qui calme les gens."
    );
  if (col.some((z) => z.color.g > z.color.r && z.color.g > z.color.b))
    r.push(
      "Ça sent la forêt, j'aime bien.",
      "Ce vert fait quelque chose de bien à l'âme."
    );
  if (col.some((z) => z.color.r > z.color.g && z.color.r > z.color.b))
    r.push(
      "Petit côté feu, ça réchauffe.",
      "Ce rouge a du caractère. Beaucoup de caractère."
    );
  if (col.some((z) => z.color.r > 160 && z.color.g > 100 && z.color.b < 120))
    r.push(
      "Il y a un petit soleil dans ce vitrail.",
      "Ces tons chauds vont faire des miracles en fin de journée."
    );
  if (col.some((z) => z.color.r > 150 && z.color.g > 120 && z.color.b > 150))
    r.push("Ces tons violets ont une vraie élégance mystérieuse.");
  return r;
};

/* ─── Snow portraits (chihuahua, 10 moods) ────────────────────────────────── */
// Shared base: white chihuahua, big ears, dark nose. Each mood tweaks eyes/brows/mouth.
const SnowBase = ({ children, style }) => (
  <svg
    viewBox="0 0 100 110"
    style={{
      width: "5.5rem",
      height: "5.5rem",
      margin: "0 auto",
      display: "block",
      ...style,
    }}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Body / chest */}
    <ellipse
      cx="50"
      cy="95"
      rx="22"
      ry="16"
      fill="#f0ece0"
      stroke="#ccc5a8"
      strokeWidth="0.6"
    />
    {/* Head */}
    <ellipse
      cx="50"
      cy="58"
      rx="28"
      ry="26"
      fill="#f5f0e0"
      stroke="#ccc5a8"
      strokeWidth="0.8"
    />
    {/* Left ear */}
    <path
      d="M24 44 Q14 18 26 12 Q34 20 32 40Z"
      fill="#ede8d5"
      stroke="#ccc5a8"
      strokeWidth="0.7"
    />
    <path d="M25 42 Q17 22 27 16 Q32 23 31 39Z" fill="#d4b8a0" opacity="0.5" />
    {/* Right ear */}
    <path
      d="M76 44 Q86 18 74 12 Q66 20 68 40Z"
      fill="#ede8d5"
      stroke="#ccc5a8"
      strokeWidth="0.7"
    />
    <path d="M75 42 Q83 22 73 16 Q68 23 69 39Z" fill="#d4b8a0" opacity="0.5" />
    {/* Snout */}
    <ellipse
      cx="50"
      cy="68"
      rx="13"
      ry="9"
      fill="#e8e0c8"
      stroke="#ccc5a8"
      strokeWidth="0.5"
    />
    {/* Nose */}
    <ellipse cx="50" cy="63" rx="5" ry="3.5" fill="#3a2a1a" />
    <ellipse cx="48.5" cy="62" rx="1.5" ry="1" fill="#5a4a3a" opacity="0.5" />
    {/* Collar tag */}
    <circle
      cx="50"
      cy="84"
      r="3"
      fill="none"
      stroke="#8B6914"
      strokeWidth="0.8"
    />
    <text
      x="50"
      y="86"
      textAnchor="middle"
      fontSize="3.5"
      fill="#8B6914"
      fontFamily="serif"
    >
      S
    </text>
    {/* Dynamic parts (eyes, brows, mouth) injected by each mood */}
    {children}
  </svg>
);

// Mouth helpers
const MouthSmirk = () => (
  <path
    d="M44 74 Q50 76 54 73"
    stroke="#5a3a2a"
    strokeWidth="1.2"
    fill="none"
    strokeLinecap="round"
  />
);
const MouthFlat = () => (
  <path
    d="M44 74 Q50 74 56 74"
    stroke="#5a3a2a"
    strokeWidth="1.2"
    fill="none"
    strokeLinecap="round"
  />
);
const MouthFrown = () => (
  <path
    d="M44 75 Q50 72 56 75"
    stroke="#5a3a2a"
    strokeWidth="1.2"
    fill="none"
    strokeLinecap="round"
  />
);
const MouthOpen = () => (
  <>
    <path
      d="M44 73 Q50 78 56 73"
      stroke="#5a3a2a"
      strokeWidth="1.2"
      fill="none"
      strokeLinecap="round"
    />
    <ellipse cx="50" cy="76" rx="4" ry="2.5" fill="#c08080" opacity="0.6" />
  </>
);
const MouthTight = () => (
  <path
    d="M46 74 Q50 73 54 74"
    stroke="#5a3a2a"
    strokeWidth="1.5"
    fill="none"
    strokeLinecap="round"
  />
);

// Eye helpers
const EyeHalf = ({ x }) => (
  <>
    <ellipse cx={x} cy="54" rx="5" ry="2.5" fill="#2a1a0a" />
    <ellipse cx={x - 1} cy="53.5" rx="1.2" ry="0.8" fill="#fff" opacity="0.4" />
  </>
);
const EyeNormal = ({ x }) => (
  <>
    <ellipse cx={x} cy="54" rx="5" ry="5" fill="#2a1a0a" />
    <ellipse
      cx={x - 1.5}
      cy="52.5"
      rx="1.8"
      ry="1.5"
      fill="#fff"
      opacity="0.5"
    />
  </>
);
const EyeWide = ({ x }) => (
  <>
    <ellipse cx={x} cy="54" rx="5.5" ry="6.5" fill="#2a1a0a" />
    <ellipse
      cx={x - 1.5}
      cy="51.5"
      rx="2"
      ry="1.8"
      fill="#fff"
      opacity="0.55"
    />
  </>
);
const EyeSquint = ({ x }) => (
  <>
    <ellipse cx={x} cy="54" rx="5" ry="1.8" fill="#2a1a0a" />
    <ellipse cx={x - 1} cy="53.5" rx="1" ry="0.6" fill="#fff" opacity="0.4" />
  </>
);
const EyeSide = ({ x, dir }) => (
  <>
    <ellipse cx={x + dir * 1} cy="54" rx="5" ry="5" fill="#2a1a0a" />
    <ellipse
      cx={x + dir * 2 - 1}
      cy="52.5"
      rx="1.8"
      ry="1.5"
      fill="#fff"
      opacity="0.5"
    />
  </>
);

// Brow helpers
const BrowFlat = ({ x, flip }) => (
  <path
    d={`M${x - 5} 46 Q${x} 44 ${x + 5} 46`}
    stroke="#6a4a2a"
    strokeWidth="1.2"
    fill="none"
    transform={flip ? `scale(-1,1) translate(-100,0)` : ""}
  />
);
const BrowUp = ({ x }) => (
  <path
    d={`M${x - 5} 47 Q${x} 43 ${x + 5} 46`}
    stroke="#6a4a2a"
    strokeWidth="1.2"
    fill="none"
  />
);
const BrowDown = ({ x }) => (
  <path
    d={`M${x - 5} 44 Q${x} 47 ${x + 5} 45`}
    stroke="#6a4a2a"
    strokeWidth="1.2"
    fill="none"
  />
);
const BrowAngryL = () => (
  <path
    d="M28 44 Q33 47 38 46"
    stroke="#6a4a2a"
    strokeWidth="1.4"
    fill="none"
  />
);
const BrowAngryR = () => (
  <path
    d="M62 46 Q67 47 72 44"
    stroke="#6a4a2a"
    strokeWidth="1.4"
    fill="none"
  />
);
const BrowSadL = () => (
  <path
    d="M28 46 Q33 43 38 46"
    stroke="#6a4a2a"
    strokeWidth="1.2"
    fill="none"
  />
);
const BrowSadR = () => (
  <path
    d="M62 46 Q67 43 72 46"
    stroke="#6a4a2a"
    strokeWidth="1.2"
    fill="none"
  />
);
const BrowHighL = () => (
  <path
    d="M28 42 Q33 40 38 42"
    stroke="#6a4a2a"
    strokeWidth="1.2"
    fill="none"
  />
);
const BrowHighR = () => (
  <path
    d="M62 42 Q67 40 72 42"
    stroke="#6a4a2a"
    strokeWidth="1.2"
    fill="none"
  />
);
const BrowOneSide = () => (
  <>
    <path
      d="M28 43 Q33 46 38 44"
      stroke="#6a4a2a"
      strokeWidth="1.2"
      fill="none"
    />
    <path
      d="M62 44 Q67 41 72 43"
      stroke="#6a4a2a"
      strokeWidth="1.2"
      fill="none"
    />
  </>
);

const SNOW_MOODS = {
  // Yeux mi-clos, sourcils plats, bouche plate — classique lundi matin
  bored: (
    <SnowBase>
      <BrowFlat x={33} />
      <BrowFlat x={67} />
      <EyeHalf x={33} />
      <EyeHalf x={67} />
      <MouthFlat />
    </SnowBase>
  ),
  // Menton levé, yeux mi-clos dédaigneux, sourcils relevés — "je suis au-dessus de ça"
  royal: (
    <SnowBase style={{ transform: "rotate(-8deg)" }}>
      <BrowHighL />
      <BrowHighR />
      <EyeHalf x={33} />
      <EyeHalf x={67} />
      <MouthSmirk />
    </SnowBase>
  ),
  // Sourcils froncés, yeux plissés, bouche pincée — dégoût poli
  disgusted: (
    <SnowBase>
      <BrowAngryL />
      <BrowAngryR />
      <EyeSquint x={33} />
      <EyeSquint x={67} />
      <MouthFrown />
    </SnowBase>
  ),
  // Un œil plissé, l'autre normal, bouche de côté — suspicion
  suspicious: (
    <SnowBase>
      <BrowOneSide />
      <EyeSquint x={33} />
      <EyeNormal x={67} />
      <MouthSmirk />
    </SnowBase>
  ),
  // Yeux écarquillés, sourcils très hauts, bouche ouverte — choc
  shocked: (
    <SnowBase>
      <BrowHighL />
      <BrowHighR />
      <EyeWide x={33} />
      <EyeWide x={67} />
      <MouthOpen />
    </SnowBase>
  ),
  // Yeux plissés symétriques, sourcils légèrement froncés — scepticisme
  skeptical: (
    <SnowBase>
      <BrowDown x={33} />
      <BrowDown x={67} />
      <EyeSquint x={33} />
      <EyeSquint x={67} />
      <MouthTight />
    </SnowBase>
  ),
  // Yeux regardant de côté, sourcils normaux, bouche ouverte — perdu
  confused: (
    <SnowBase>
      <BrowUp x={33} />
      <BrowUp x={67} />
      <EyeSide x={33} dir={-1} />
      <EyeSide x={67} dir={1} />
      <MouthOpen />
    </SnowBase>
  ),
  // Yeux normaux mais regard fixe, sourcils asymétriques — jugement silencieux
  judging: (
    <SnowBase>
      <BrowAngryL />
      <BrowHighR />
      <EyeNormal x={33} />
      <EyeSquint x={67} />
      <MouthFlat />
    </SnowBase>
  ),
  // Sourcils tristes, yeux mi-clos, bouche vers le bas — pitié condescendante
  pitying: (
    <SnowBase>
      <BrowSadL />
      <BrowSadR />
      <EyeHalf x={33} />
      <EyeHalf x={67} />
      <MouthFrown />
    </SnowBase>
  ),
  // Tout plat, regard vide, bouche droite — deadpan absolu
  deadpan: (
    <SnowBase>
      <BrowFlat x={33} />
      <BrowFlat x={67} />
      <EyeNormal x={33} />
      <EyeNormal x={67} />
      <MouthFlat />
    </SnowBase>
  ),
};

/* ─── Happy cat SVG (for compliments) ─────────────────────────────────────── */
const HappyCat = () => (
  <svg
    viewBox="0 0 100 110"
    style={{
      width: "5.5rem",
      height: "5.5rem",
      margin: "0 auto",
      display: "block",
    }}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Body */}
    <ellipse
      cx="50"
      cy="92"
      rx="20"
      ry="14"
      fill="#d4b896"
      stroke="#b89870"
      strokeWidth="0.6"
    />
    {/* Head */}
    <ellipse
      cx="50"
      cy="60"
      rx="26"
      ry="24"
      fill="#ddc4a0"
      stroke="#b89870"
      strokeWidth="0.8"
    />
    {/* Left ear */}
    <path
      d="M27 42 L20 20 L38 34Z"
      fill="#ddc4a0"
      stroke="#b89870"
      strokeWidth="0.7"
    />
    <path d="M28 41 L22 24 L36 35Z" fill="#e8a0a0" opacity="0.5" />
    {/* Right ear */}
    <path
      d="M73 42 L80 20 L62 34Z"
      fill="#ddc4a0"
      stroke="#b89870"
      strokeWidth="0.7"
    />
    <path d="M72 41 L78 24 L64 35Z" fill="#e8a0a0" opacity="0.5" />
    {/* Face markings */}
    <path
      d="M38 58 Q50 54 62 58"
      stroke="#b89870"
      strokeWidth="0.4"
      fill="none"
      opacity="0.4"
    />
    {/* Snout */}
    <ellipse
      cx="50"
      cy="68"
      rx="11"
      ry="8"
      fill="#c8a880"
      stroke="#b89870"
      strokeWidth="0.4"
    />
    {/* Nose */}
    <path d="M47 63 Q50 61 53 63 Q50 66 47 63Z" fill="#c06080" />
    {/* Happy eyes — closed crescent */}
    <path
      d="M34 56 Q39 52 44 56"
      stroke="#3a2a1a"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M56 56 Q61 52 66 56"
      stroke="#3a2a1a"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    {/* Whiskers left */}
    <line
      x1="20"
      y1="65"
      x2="39"
      y2="67"
      stroke="#8a7050"
      strokeWidth="0.6"
      opacity="0.6"
    />
    <line
      x1="20"
      y1="68"
      x2="39"
      y2="68"
      stroke="#8a7050"
      strokeWidth="0.6"
      opacity="0.6"
    />
    <line
      x1="20"
      y1="71"
      x2="39"
      y2="69"
      stroke="#8a7050"
      strokeWidth="0.6"
      opacity="0.6"
    />
    {/* Whiskers right */}
    <line
      x1="61"
      y1="67"
      x2="80"
      y2="65"
      stroke="#8a7050"
      strokeWidth="0.6"
      opacity="0.6"
    />
    <line
      x1="61"
      y1="68"
      x2="80"
      y2="68"
      stroke="#8a7050"
      strokeWidth="0.6"
      opacity="0.6"
    />
    <line
      x1="61"
      y1="69"
      x2="80"
      y2="71"
      stroke="#8a7050"
      strokeWidth="0.6"
      opacity="0.6"
    />
    {/* Happy mouth */}
    <path
      d="M45 72 Q50 76 55 72"
      stroke="#c06080"
      strokeWidth="1.2"
      fill="none"
      strokeLinecap="round"
    />
    {/* Tail */}
    <path
      d="M68 92 Q82 80 78 68 Q76 62 80 58"
      stroke="#b89870"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
    {/* Blush */}
    <ellipse cx="34" cy="68" rx="5" ry="3" fill="#e8a0a0" opacity="0.3" />
    <ellipse cx="66" cy="68" rx="5" ry="3" fill="#e8a0a0" opacity="0.3" />
  </svg>
);

/* ─── SVG botanical illustrations ─────────────────────────────────────────── */
const LeafBranch = ({ style }) => (
  <svg
    viewBox="0 0 120 80"
    style={style}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M10 70 Q30 40 60 20 Q90 5 110 10"
      stroke="#5c7a3e"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.6"
    />
    <path
      d="M60 20 Q50 35 40 50"
      stroke="#5c7a3e"
      strokeWidth="1"
      strokeLinecap="round"
      fill="none"
      opacity="0.5"
    />
    <path d="M40 50 Q30 45 25 38 Q35 32 40 50Z" fill="#7a9e52" opacity="0.4" />
    <path
      d="M75 25 Q65 38 55 50"
      stroke="#5c7a3e"
      strokeWidth="1"
      strokeLinecap="round"
      fill="none"
      opacity="0.5"
    />
    <path d="M55 50 Q44 46 38 38 Q50 30 55 50Z" fill="#7a9e52" opacity="0.4" />
    <path
      d="M90 15 Q82 30 72 42"
      stroke="#5c7a3e"
      strokeWidth="1"
      strokeLinecap="round"
      fill="none"
      opacity="0.5"
    />
    <path d="M72 42 Q60 38 55 30 Q67 22 72 42Z" fill="#7a9e52" opacity="0.35" />
    <path d="M30 58 Q22 52 18 44 Q28 40 30 58Z" fill="#7a9e52" opacity="0.3" />
  </svg>
);

const Fern = ({ style }) => (
  <svg
    viewBox="0 0 80 120"
    style={style}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M40 115 Q40 60 40 10"
      stroke="#4a6741"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.55"
    />
    {[20, 32, 44, 56, 68, 80, 90, 100].map((y, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const len = 12 + (i < 4 ? i * 3 : (7 - i) * 3);
      return (
        <g key={y}>
          <path
            d={`M40 ${y} Q${40 + side * len * 0.6} ${y - 8} ${
              40 + side * len
            } ${y - 14}`}
            stroke="#4a6741"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />
          <path
            d={`M${40 + side * len} ${y - 14} Q${40 + side * (len - 4)} ${
              y - 10
            } ${40 + side * len * 0.6} ${y - 8} Q${
              40 + side * (len * 0.6 + 3)
            } ${y - 13} ${40 + side * len} ${y - 14}Z`}
            fill="#6b8f4a"
            opacity="0.3"
          />
        </g>
      );
    })}
  </svg>
);

const WildFlower = ({ style }) => (
  <svg
    viewBox="0 0 60 90"
    style={style}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M30 85 Q30 50 30 30"
      stroke="#5c7a3e"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.6"
    />
    <path d="M30 60 Q20 55 15 48 Q22 44 30 60Z" fill="#7a9e52" opacity="0.4" />
    <path d="M30 50 Q40 45 45 38 Q38 34 30 50Z" fill="#7a9e52" opacity="0.4" />
    <ellipse cx="30" cy="24" rx="7" ry="7" fill="#d4a853" opacity="0.7" />
    {[0, 51, 102, 153, 204, 255, 306].map((deg, i) => (
      <ellipse
        key={i}
        cx={30 + Math.cos((deg * Math.PI) / 180) * 13}
        cy={24 + Math.sin((deg * Math.PI) / 180) * 13}
        rx="5"
        ry="3.5"
        fill="#e8c97a"
        opacity="0.55"
        transform={`rotate(${deg} ${
          30 + Math.cos((deg * Math.PI) / 180) * 13
        } ${24 + Math.sin((deg * Math.PI) / 180) * 13})`}
      />
    ))}
  </svg>
);

const Acorn = ({ style }) => (
  <svg
    viewBox="0 0 40 50"
    style={style}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <ellipse cx="20" cy="19" rx="10" ry="7" fill="#8B6914" opacity="0.6" />
    <path d="M10 19 Q10 36 20 38 Q30 36 30 19Z" fill="#a07830" opacity="0.55" />
    <path
      d="M20 6 Q22 12 20 19"
      stroke="#5c7a3e"
      strokeWidth="1.2"
      strokeLinecap="round"
      fill="none"
      opacity="0.6"
    />
    <path d="M20 6 Q26 4 28 8 Q22 10 20 6Z" fill="#4a6741" opacity="0.5" />
  </svg>
);

const PineBranch = ({ style }) => (
  <svg
    viewBox="0 0 140 60"
    style={style}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M5 50 Q40 30 80 25 Q110 22 135 20"
      stroke="#4a5e35"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      opacity="0.55"
    />
    {[15, 30, 45, 60, 75, 90, 105, 120].map((x, i) => {
      const y = 50 - (x / 135) * 30 + Math.sin(i) * 2;
      const h = 8 + Math.sin(i * 0.8) * 3;
      return (
        <g key={x} opacity="0.45">
          <line
            x1={x}
            y1={y}
            x2={x - 5}
            y2={y - h}
            stroke="#3d5228"
            strokeWidth="1"
          />
          <line
            x1={x}
            y1={y}
            x2={x + 3}
            y2={y - h + 2}
            stroke="#3d5228"
            strokeWidth="1"
          />
          <line
            x1={x}
            y1={y}
            x2={x - 8}
            y2={y - h + 4}
            stroke="#3d5228"
            strokeWidth="0.8"
          />
          <line
            x1={x}
            y1={y}
            x2={x + 6}
            y2={y - h + 6}
            stroke="#3d5228"
            strokeWidth="0.8"
          />
        </g>
      );
    })}
  </svg>
);

/* ─── parchment background ─────────────────────────────────────────────────── */
const ParchmentBg = () => (
  <svg
    style={{
      position: "fixed",
      inset: 0,
      width: "100%",
      height: "100%",
      zIndex: 0,
      pointerEvents: "none",
      opacity: 0.18,
    }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <filter id="noise">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.65"
        numOctaves="3"
        stitchTiles="stitch"
      />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#noise)" opacity="0.4" />
    <pattern
      id="woodgrain"
      x="0"
      y="0"
      width="200"
      height="40"
      patternUnits="userSpaceOnUse"
    >
      <path
        d="M0 20 Q50 15 100 20 Q150 25 200 20"
        stroke="#8B6914"
        strokeWidth="0.5"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M0 30 Q60 26 120 30 Q160 33 200 30"
        stroke="#8B6914"
        strokeWidth="0.3"
        fill="none"
        opacity="0.2"
      />
    </pattern>
    <rect width="100%" height="100%" fill="url(#woodgrain)" opacity="0.15" />
  </svg>
);

/* ─── fonts + CSS ──────────────────────────────────────────────────────────── */
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');`;

const CSS = `
*{box-sizing:border-box;}
/* ── iPhone viewport fixes ── */
html{-webkit-text-size-adjust:100%;}
body{margin:0;overscroll-behavior:none;}
/* Prevent Safari double-tap zoom on buttons/inputs */
button,input,select,textarea{touch-action:manipulation;}

.vr{min-height:100vh;min-height:100dvh;background:linear-gradient(160deg,#eee8d8 0%,#e8e0cc 40%,#ddd5c0 100%);font-family:'Lora',Georgia,serif;color:#2d2416;position:relative;
  /* iPhone safe areas */
  padding-left:env(safe-area-inset-left);
  padding-right:env(safe-area-inset-right);
}
.card{background:linear-gradient(135deg,rgba(255,253,245,0.92) 0%,rgba(245,240,225,0.88) 100%);border:1px solid rgba(139,105,20,0.18);border-radius:4px;padding:1.1rem;box-shadow:0 2px 12px rgba(80,60,20,0.10),inset 0 1px 0 rgba(255,255,255,0.6);position:relative;overflow:hidden;}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#7a9e52,#5c7a3e,#4a5e35);border-radius:4px 4px 0 0;opacity:0.7;}
.ctitle{font-family:'Playfair Display',Georgia,serif;font-size:0.78rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#4a5e35;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.4rem;}
/* ── Inputs: 16px min to prevent Safari zoom-in ── */
.inp{width:100%;background:rgba(255,253,245,0.8);border:1px solid rgba(139,105,20,0.25);border-radius:3px;padding:0.75rem;font-family:'Lora',Georgia,serif;font-size:16px;color:#2d2416;outline:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;}
.inp:focus{border-color:#7a9e52;box-shadow:0 0 0 2px rgba(122,158,82,0.15);}
.inp:disabled{opacity:.45;cursor:not-allowed;}
select.inp{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235c7a3e' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center;padding-right:2.2rem;cursor:pointer;}
/* ── Buttons: min 48px tall for tap targets ── */
.btn-g{background:linear-gradient(135deg,#5c7a3e 0%,#4a6741 100%);color:#f5f0e8;border:none;border-radius:3px;padding:.8rem 1rem;min-height:48px;font-family:'Lora',Georgia,serif;font-size:.9rem;font-weight:500;cursor:pointer;box-shadow:0 2px 6px rgba(74,103,65,.3);transition:transform .1s,box-shadow .1s;-webkit-tap-highlight-color:transparent;}
.btn-g:active{transform:scale(.97);box-shadow:0 1px 3px rgba(74,103,65,.2);}
.btn-g:disabled{opacity:.45;cursor:not-allowed;transform:none;}
.btn-w{background:linear-gradient(135deg,#6b4c1e 0%,#5a3e18 100%);color:#f5ead8;border:none;border-radius:3px;padding:.8rem 1rem;min-height:48px;font-family:'Lora',Georgia,serif;font-size:.9rem;font-weight:500;cursor:pointer;box-shadow:0 2px 6px rgba(90,62,24,.3);transition:transform .1s,box-shadow .1s;-webkit-tap-highlight-color:transparent;}
.btn-w:active{transform:scale(.97);}
.btn-d{background:rgba(180,60,40,.08);color:#a03020;border:1px solid rgba(180,60,40,.2);border-radius:3px;padding:.6rem .9rem;min-height:44px;font-family:'Lora',Georgia,serif;font-size:.85rem;cursor:pointer;transition:background .2s;-webkit-tap-highlight-color:transparent;}
.btn-d:active{background:rgba(180,60,40,.18);}
/* ── Zone rows: bigger tap area ── */
.zone-row{display:flex;align-items:center;justify-content:space-between;background:rgba(245,240,225,.7);border:1px solid rgba(139,105,20,.12);border-radius:3px;padding:.7rem .75rem;min-height:52px;cursor:pointer;transition:background .15s,border-color .15s;text-align:left;width:100%;-webkit-tap-highlight-color:transparent;}
.zone-row:active{background:rgba(122,158,82,.12);}
.zone-row.sel{background:rgba(122,158,82,.14);border-color:rgba(92,122,62,.35);}
.rlabel{display:flex;align-items:center;gap:.6rem;font-size:.9rem;cursor:pointer;color:#3a2e1a;padding:.35rem 0;min-height:44px;-webkit-tap-highlight-color:transparent;}
.rlabel input[type=radio]{accent-color:#5c7a3e;width:18px;height:18px;}
.divider{border:none;border-top:1px solid rgba(139,105,20,.15);margin:.6rem 0;}
.lbl{font-size:.8rem;color:#5a4a2a;margin-bottom:.3rem;display:block;font-style:italic;}
.warn{background:rgba(200,160,40,.1);border:1px solid rgba(200,160,40,.3);border-radius:3px;padding:.7rem .9rem;font-size:.85rem;color:#7a5c10;font-style:italic;}
/* ── Header: compact when scrolled via JS class ── */
.hdr-wrap{position:sticky;top:0;z-index:20;margin:0 -1rem;padding:0 1rem .6rem;background:linear-gradient(to bottom,rgba(238,232,216,.98) 85%,transparent);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  /* iPhone notch */
  padding-top:max(.6rem, env(safe-area-inset-top));
}
.hdr-inner{background:linear-gradient(135deg,rgba(74,103,65,.12) 0%,rgba(107,76,30,.08) 100%);border:1px solid rgba(139,105,20,.2);border-radius:4px;padding:.7rem 1rem;text-align:center;position:relative;overflow:hidden;}
.hdr-eye{font-size:.65rem;letter-spacing:.22em;text-transform:uppercase;color:#7a9e52;font-family:'Lora',serif;font-style:italic;}
.hdr-title{font-family:'Playfair Display',Georgia,serif;font-size:1.35rem;font-weight:600;color:#2d2416;margin:.1rem 0 0;line-height:1.2;}
.cdot{width:14px;height:14px;border-radius:50%;border:1px solid rgba(80,60,20,.2);flex-shrink:0;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;}
.mt2{margin-top:.5rem;}.mt3{margin-top:.75rem;}.mt4{margin-top:1rem;}
.sy>*+*{margin-top:.55rem;}.sys>*+*{margin-top:.4rem;}
.fb{display:flex;align-items:center;justify-content:space-between;}
.fg{display:flex;align-items:center;gap:.5rem;}
.tsm{font-size:.85rem;color:#5a4a2a;}
.tmu{font-size:.8rem;color:#8a7050;font-style:italic;}
.tbold{font-weight:600;}
.wfull{width:100%;}
.fl{display:flex;}.g2r{gap:.5rem;}.g3r{gap:.75rem;}
.err{color:#a03020;font-size:.85rem;}
.ok{font-size:.88rem;color:#3a2e1a;}
.okv{font-weight:600;color:#2d2416;}
/* ── Canvas wrapper: clips zoom transform ── */
.cwrap{border-radius:3px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1px rgba(139,105,20,.15);position:relative;touch-action:none;user-select:none;-webkit-user-select:none;}
.cwrap canvas{display:block;width:100%;height:auto;transform-origin:0 0;will-change:transform;}
.zoom-badge{position:absolute;top:.4rem;right:.4rem;background:rgba(74,103,65,.75);color:#f5f0e8;font-size:.7rem;font-family:'Lora',serif;padding:.2rem .5rem;border-radius:20px;pointer-events:none;backdrop-filter:blur(4px);transition:opacity .3s;}
.ec{height:13rem;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(122,158,82,.05);border:1px dashed rgba(92,122,62,.3);border-radius:3px;color:#8a7050;font-style:italic;font-size:.88rem;gap:.5rem;}
.grow{display:flex;align-items:center;justify-content:space-between;background:rgba(245,240,225,.6);border:1px solid rgba(139,105,20,.1);border-radius:3px;padding:.6rem .75rem;min-height:52px;}
/* ── Result screen ── */
.rscreen{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:max(1.5rem,env(safe-area-inset-top)) 1rem max(1.5rem,env(safe-area-inset-bottom));background:linear-gradient(160deg,#eee8d8 0%,#e8e0cc 40%,#ddd5c0 100%);position:relative;}
.rcard{width:100%;max-width:26rem;background:linear-gradient(135deg,rgba(255,253,245,.95) 0%,rgba(245,240,225,.92) 100%);border:1px solid rgba(139,105,20,.2);border-radius:4px;padding:1.5rem;box-shadow:0 8px 32px rgba(80,60,20,.15);position:relative;z-index:1;}
.rcomp{background:rgba(122,158,82,.08);border:1px solid rgba(92,122,62,.15);border-radius:3px;padding:.75rem 1rem;font-style:italic;font-size:.9rem;color:#3a2e1a;text-align:center;margin-top:.75rem;}
.rprice{background:linear-gradient(135deg,#4a6741 0%,#3d5228 100%);border-radius:4px;padding:1rem 1.2rem;color:#f5f0e8;box-shadow:0 4px 16px rgba(61,82,40,.3);}
.cpick{display:flex;align-items:center;gap:.75rem;background:rgba(255,253,245,.8);border:1px solid rgba(139,105,20,.25);border-radius:3px;padding:.6rem .75rem;}
input[type=color]{width:2.8rem;height:2.2rem;border:1px solid rgba(139,105,20,.2);border-radius:3px;cursor:pointer;padding:.1rem;background:white;-webkit-appearance:none;}
input[type=file]{font-family:'Lora',Georgia,serif;font-size:16px;color:#5a4a2a;width:100%;}
input[type=file]::file-selector-button{background:linear-gradient(135deg,rgba(122,158,82,.15),rgba(92,122,62,.1));border:1px solid rgba(92,122,62,.25);border-radius:3px;padding:.5rem .9rem;min-height:44px;font-family:'Lora',Georgia,serif;font-size:.85rem;color:#4a5e35;cursor:pointer;margin-right:.6rem;transition:background .2s;-webkit-appearance:none;}
/* Bottom safe area spacer */
.bottom-spacer{height:max(2rem,env(safe-area-inset-bottom));}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
.fi{animation:fadeIn .3s ease forwards;}
`;

/* ─── self-tests ───────────────────────────────────────────────────────────── */
if (typeof window !== "undefined") {
  const v = {
    cost_total: 100,
    glass_cost: 20,
    copper_cost: 10,
    solder_cost: 5,
    labor_cost: 15,
  };
  const tests = [
    { e: "cost_total * 2", x: 200 },
    { e: "(glass_cost + copper_cost) * 2", x: 60 },
    { e: "-5 + 10", x: 5 },
  ];
  for (const t of tests)
    if (Math.abs(evalFormula(t.e, v) - t.x) > 0.0001)
      throw new Error("Self-test failed: " + t.e);
  const g = normalizeGlass({
    nom: "Bleu",
    prix_dm2: "12.5",
    couleur: "#112233",
  });
  if (g.prix_dm2 !== 12.5) throw new Error("normalizeGlass failed");
}

/* ─── component ────────────────────────────────────────────────────────────── */
export default function CalculateurVitrailTiffany() {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const zoneCounterRef = useRef(0);

  // Pinch-zoom state (refs to avoid re-renders during gesture)
  const zoomRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const pinchRef = useRef(null); // { dist, cx, cy, tx, ty, scale }
  const [zoomLevel, setZoomLevel] = useState(1); // for hint display only

  const [imageSrc, setImageSrc] = useState(null);
  const [imageElement, setImageElement] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [baseImageData, setBaseImageData] = useState(null);
  const [zones, setZones] = useState([]);
  const [mode, setMode] = useState("zone");
  const [scale, setScale] = useState(null);
  const [scaleLine, setScaleLine] = useState(null);
  const [isDrawingScale, setIsDrawingScale] = useState(false);
  const [scaleStart, setScaleStart] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [pendingScalePixels, setPendingScalePixels] = useState(null);
  const [scaleInputCm, setScaleInputCm] = useState("");
  const [glasses, setGlasses] = useState([]);
  const [glassForm, setGlassForm] = useState({
    nom: "",
    prix_dm2: "",
    couleur: "#7dd3fc",
  });
  const [copperPricePerMeter, setCopperPricePerMeter] = useState("");
  const [solderPricePerMeter, setSolderPricePerMeter] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [laborRate, setLaborRate] = useState("");
  const [pricingMode, setPricingMode] = useState("x2_materiaux");
  const [customFormula, setCustomFormula] = useState("(cost_total * 2.5) + 20");
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [resultCompliment, setResultCompliment] = useState("");
  const [resultMood, setResultMood] = useState(null); // Snow's mood for roast screen
  const [resultIsRoast, setResultIsRoast] = useState(false);

  // ── Inject PWA meta tags once ──
  useEffect(() => {
    // Viewport: prevent Safari auto-zoom, allow user zoom outside canvas
    let vp = document.querySelector("meta[name=viewport]");
    if (!vp) {
      vp = document.createElement("meta");
      vp.name = "viewport";
      document.head.appendChild(vp);
    }
    vp.content =
      "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover";
    // PWA tags
    const tags = [
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Vitrail Tiffany" },
      { name: "theme-color", content: "#eee8d8" },
    ];
    tags.forEach(({ name, content }) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const m = document.createElement("meta");
        m.name = name;
        m.content = content;
        document.head.appendChild(m);
      }
    });
    // Manifest (inline blob so no server needed)
    if (!document.querySelector("link[rel=manifest]")) {
      const manifest = {
        name: "Calculateur Vitrail Tiffany",
        short_name: "Vitrail",
        start_url: ".",
        display: "standalone",
        background_color: "#eee8d8",
        theme_color: "#5c7a3e",
        icons: [
          {
            src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%235c7a3e'/%3E%3Ctext y='.9em' font-size='80' x='10'%3E🪟%3C/text%3E%3C/svg%3E",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      };
      const blob = new Blob([JSON.stringify(manifest)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = url;
      document.head.appendChild(link);
    }
  }, []);
  useEffect(() => {
    try {
      const s = localStorage.getItem(GLASS_STORAGE_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p)) setGlasses(p.map(normalizeGlass).filter(Boolean));
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(GLASS_STORAGE_KEY, JSON.stringify(glasses));
  }, [glasses]);

  useEffect(() => {
    if (!imageSrc) {
      setImageElement(null);
      setCanvasSize({ width: 0, height: 0 });
      setBaseImageData(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const ratio = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
      setImageElement(img);
      setCanvasSize({
        width: Math.round(img.width * ratio),
        height: Math.round(img.height * ratio),
      });
      setZones([]);
      setSelectedZoneId(null);
      setScaleLine(null);
      setPendingScalePixels(null);
      setScaleInputCm("");
      setShowResultScreen(false);
      zoneCounterRef.current = 0;
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement || !canvasSize.width) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageElement, 0, 0, canvasSize.width, canvasSize.height);
    setBaseImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }, [imageElement, canvasSize]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImageData) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.putImageData(baseImageData, 0, 0);
    if (zones.length > 0) {
      const ov = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = ov.data;
      for (const zone of zones) {
        for (const pi of zone.pixelArray) {
          const off = pi * 4;
          if (zone.color) {
            d[off] = zone.color.r;
            d[off + 1] = zone.color.g;
            d[off + 2] = zone.color.b;
            d[off + 3] = Math.round(zone.color.a * 255);
          }
          if (zone.id === selectedZoneId) {
            d[off] = Math.round(d[off] * 0.75 + 16 * 0.25);
            d[off + 1] = Math.round(d[off + 1] * 0.75 + 185 * 0.25);
            d[off + 2] = Math.round(d[off + 2] * 0.75 + 129 * 0.25);
          }
        }
      }
      ctx.putImageData(ov, 0, 0);
    }
    if (scaleLine) {
      ctx.save();
      ctx.strokeStyle = "#5c7a3e";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(scaleLine.x1, scaleLine.y1);
      ctx.lineTo(scaleLine.x2, scaleLine.y2);
      ctx.stroke();
      for (const [x, y] of [
        [scaleLine.x1, scaleLine.y1],
        [scaleLine.x2, scaleLine.y2],
      ]) {
        ctx.fillStyle = "#5c7a3e";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }, [baseImageData, zones, scaleLine, selectedZoneId]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const reset = () => {
    setImageSrc(null);
    setImageElement(null);
    setCanvasSize({ width: 0, height: 0 });
    setBaseImageData(null);
    setZones([]);
    setMode("zone");
    setScale(null);
    setScaleLine(null);
    setIsDrawingScale(false);
    setScaleStart(null);
    setSelectedZoneId(null);
    setPendingScalePixels(null);
    setScaleInputCm("");
    setCopperPricePerMeter("");
    setSolderPricePerMeter("");
    setLaborHours("");
    setLaborRate("");
    setPricingMode("x2_materiaux");
    setCustomFormula("(cost_total * 2.5) + 20");
    setShowResultScreen(false);
    setResultCompliment("");
    zoneCounterRef.current = 0;
    if (fileInputRef.current) fileInputRef.current.value = "";
    const c = canvasRef.current;
    if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setShowResultScreen(false);
    };
    reader.readAsDataURL(file);
  };

  // ── Apply zoom transform to canvas element ──
  const applyZoom = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { scale: s, tx, ty } = zoomRef.current;
    canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    canvas.style.transformOrigin = "0 0";
  }, []);

  // ── Convert screen coords → canvas pixel coords (accounting for zoom/pan) ──
  const getXY = (e) => {
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    if (!canvas || !wrap) return { x: 0, y: 0 };
    const rect = wrap.getBoundingClientRect();
    const { scale: s, tx, ty } = zoomRef.current;
    // Raw position within the wrapper
    const rx = (e.clientX - rect.left - tx) / s;
    const ry = (e.clientY - rect.top - ty) / s;
    // Scale from CSS display size to actual canvas pixels
    const cssW = rect.width;
    const canvasDisplayW = canvas.offsetWidth * s || cssW;
    const pixelRatio = canvas.width / (cssW / s);
    return {
      x: Math.floor(rx * pixelRatio),
      y: Math.floor(ry * pixelRatio),
    };
  };

  // ── Pinch helpers ──
  const getPinchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };
  const getPinchCenter = (touches, rect) => ({
    cx: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
    cy: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
  });

  const clampZoom = (s) => Math.min(Math.max(s, 1), 5);

  // ── Touch handlers on the wrapper (pinch = zoom, single = pass to pointer) ──
  const onWrapTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const rect = canvasWrapRef.current.getBoundingClientRect();
      pinchRef.current = {
        dist: getPinchDist(e.touches),
        ...getPinchCenter(e.touches, rect),
        startScale: zoomRef.current.scale,
        startTx: zoomRef.current.tx,
        startTy: zoomRef.current.ty,
      };
    }
  }, []);

  const onWrapTouchMove = useCallback(
    (e) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const rect = canvasWrapRef.current.getBoundingClientRect();
        const newDist = getPinchDist(e.touches);
        const { cx, cy } = getPinchCenter(e.touches, rect);
        const ratio = newDist / pinchRef.current.dist;
        const newScale = clampZoom(pinchRef.current.startScale * ratio);

        // Zoom around pinch center
        const { startTx, startTy, cx: ocx, cy: ocy } = pinchRef.current;
        const tx =
          cx - (ocx - startTx) * (newScale / pinchRef.current.startScale);
        const ty =
          cy - (ocy - startTy) * (newScale / pinchRef.current.startScale);

        zoomRef.current = { scale: newScale, tx, ty };
        applyZoom();
        setZoomLevel(Math.round(newScale * 10) / 10);
      }
    },
    [applyZoom]
  );

  const onWrapTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) pinchRef.current = null;
  }, []);

  // Double-tap to reset zoom
  const lastTapRef = useRef(0);
  const onWrapDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      zoomRef.current = { scale: 1, tx: 0, ty: 0 };
      applyZoom();
      setZoomLevel(1);
    }
    lastTapRef.current = now;
  }, [applyZoom]);

  const isDark = (r, g, b) =>
    r < DARK_THRESHOLD && g < DARK_THRESHOLD && b < DARK_THRESHOLD;
  const inTol = (r, g, b, t) =>
    Math.abs(r - t.r) <= COLOR_TOLERANCE &&
    Math.abs(g - t.g) <= COLOR_TOLERANCE &&
    Math.abs(b - t.b) <= COLOR_TOLERANCE;

  const detectZone = (sx, sy) => {
    if (!baseImageData) return null;
    const { width, height, data } = baseImageData;
    const si = (sy * width + sx) * 4;
    const sc = { r: data[si], g: data[si + 1], b: data[si + 2] };
    if (isDark(sc.r, sc.g, sc.b)) return null;
    const vis = new Uint8Array(width * height);
    const stack = [[sx, sy]];
    const pixelArray = [];
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const pi = y * width + x;
      if (vis[pi]) continue;
      vis[pi] = 1;
      const off = pi * 4;
      const r = data[off],
        g = data[off + 1],
        b = data[off + 2];
      if (isDark(r, g, b)) continue;
      if (!inTol(r, g, b, sc)) continue;
      pixelArray.push(pi);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    if (!pixelArray.length) return null;
    const pixelSet = new Set(pixelArray);
    let perimeterPx = 0;
    for (const pi of pixelArray) {
      const x = pi % width,
        y = Math.floor(pi / width);
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          perimeterPx++;
          continue;
        }
        if (!pixelSet.has(ny * width + nx)) perimeterPx++;
      }
    }
    zoneCounterRef.current++;
    // Haptic feedback when zone detected
    if (navigator.vibrate) navigator.vibrate(18);
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      label: `Zone ${zoneCounterRef.current}`,
      pixelArray,
      pixelSet,
      area_px: pixelArray.length,
      perimeter_px: perimeterPx,
      area_cm2: scale ? pixelArray.length * scale * scale : null,
      color: null,
      glassId: null,
      zone_cost: 0,
    };
  };

  const recalcZones = (ns) =>
    setZones((prev) =>
      prev.map((z) => {
        const a = z.area_px * ns * ns;
        const gl = glasses.find((g) => g.id === z.glassId);
        const p = gl ? toSafeNumber(gl.prix_dm2, 0) / 100 : 0;
        return { ...z, area_cm2: a, zone_cost: a * p };
      })
    );

  const onPointerDown = (e) => {
    // Ignore if part of a pinch gesture
    if (e.touches && e.touches.length > 1) return;
    if (!baseImageData) return;
    const { x, y } = getXY(e);
    if (mode === "scale") {
      setScaleStart({ x, y });
      setIsDrawingScale(true);
      setScaleLine({ x1: x, y1: y, x2: x, y2: y });
      return;
    }
    const ci = y * baseImageData.width + x;
    const existing = zones.find((z) => z.pixelSet.has(ci));
    if (existing) {
      setSelectedZoneId((p) => (p === existing.id ? null : existing.id));
      return;
    }
    const zone = detectZone(x, y);
    if (!zone) return;
    setZones((p) => [...p, zone]);
    setSelectedZoneId(zone.id);
  };
  const onPointerMove = (e) => {
    if (e.touches && e.touches.length > 1) return;
    if (mode !== "scale" || !isDrawingScale || !scaleStart) return;
    const { x, y } = getXY(e);
    setScaleLine({ x1: scaleStart.x, y1: scaleStart.y, x2: x, y2: y });
  };
  const onPointerUp = (e) => {
    if (e.touches && e.touches.length > 1) return;
    if (mode !== "scale" || !isDrawingScale || !scaleStart) return;
    const { x, y } = getXY(e);
    const line = { x1: scaleStart.x, y1: scaleStart.y, x2: x, y2: y };
    setScaleLine(line);
    setIsDrawingScale(false);
    setScaleStart(null);
    const len = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
    if (len > 0) setPendingScalePixels(len);
  };

  const handleSaveScale = () => {
    if (!pendingScalePixels || pendingScalePixels <= 0) return;
    const cm = toSafeNumber(scaleInputCm, NaN);
    if (!isFinite(cm) || cm <= 0) return;
    const ns = cm / pendingScalePixels;
    setScale(ns);
    recalcZones(ns);
    setMode("zone");
    setScaleInputCm("");
    setPendingScalePixels(null);
  };

  const handleAddGlass = () => {
    const nom = glassForm.nom.trim();
    const prix = toSafeNumber(glassForm.prix_dm2, NaN);
    if (!nom || !isFinite(prix) || prix < 0) return;
    setGlasses((p) => [
      ...p,
      normalizeGlass({
        id: Date.now() + Math.floor(Math.random() * 1000),
        nom,
        prix_dm2: prix,
        couleur: glassForm.couleur,
      }),
    ]);
    setGlassForm({ nom: "", prix_dm2: "", couleur: "#7dd3fc" });
  };
  const handleDeleteGlass = (id) => {
    setGlasses((p) => p.filter((g) => g.id !== id));
    setZones((p) =>
      p.map((z) =>
        z.glassId === id
          ? { ...z, glassId: null, color: null, zone_cost: 0 }
          : z
      )
    );
  };
  const handleAssignGlass = (glassId) => {
    const gl = glasses.find((g) => g.id === Number(glassId));
    if (!gl || !selectedZoneId) return;
    setZones((p) =>
      p.map((z) => {
        if (z.id !== selectedZoneId) return z;
        const a = z.area_cm2 ?? 0;
        const p2 = toSafeNumber(gl.prix_dm2, 0) / 100;
        return {
          ...z,
          glassId: gl.id,
          color: gl.overlayColor,
          zone_cost: a * p2,
        };
      })
    );
  };
  const handleDeleteZone = () => {
    if (!selectedZoneId) return;
    setZones((p) => p.filter((z) => z.id !== selectedZoneId));
    setSelectedZoneId(null);
  };

  const totalPerimPx = zones.reduce((s, z) => s + (z.perimeter_px || 0), 0);
  const copperCm = scale ? totalPerimPx * scale : 0;
  const copperM = copperCm / 100;
  const copperCost = copperM * toSafeNumber(copperPricePerMeter, 0);
  const solderCost = copperM * toSafeNumber(solderPricePerMeter, 0);
  const laborCost = toSafeNumber(laborHours, 0) * toSafeNumber(laborRate, 0);
  const glassCost = zones.reduce((s, z) => s + (z.zone_cost || 0), 0);
  const totalCost = glassCost + copperCost + solderCost + laborCost;
  const pVars = {
    cost_total: totalCost,
    glass_cost: glassCost,
    copper_cost: copperCost,
    solder_cost: solderCost,
    labor_cost: laborCost,
  };

  const finalPrice = (() => {
    try {
      switch (pricingMode) {
        case "x2_materiaux":
          return {
            value: (glassCost + copperCost + solderCost) * 2,
            error: null,
          };
        case "x2_plus_mo":
          return {
            value: (glassCost + copperCost + solderCost) * 2 + laborCost,
            error: null,
          };
        case "x3_total":
          return { value: totalCost * 3, error: null };
        case "marge_30":
          return { value: totalCost * 1.3, error: null };
        case "custom":
          return { value: evalFormula(customFormula, pVars), error: null };
        default:
          return { value: totalCost, error: null };
      }
    } catch (err) {
      return { value: 0, error: err?.message || "Erreur" };
    }
  })();

  const selectedZone = zones.find((z) => z.id === selectedZoneId) || null;
  const selectedGlass = selectedZone
    ? glasses.find((g) => g.id === selectedZone.glassId) || null
    : null;

  const openResult = (type = "compliment") => {
    if (finalPrice.error) return;
    if (type === "roast") {
      const pick = C_ROAST[Math.floor(Math.random() * C_ROAST.length)];
      setResultCompliment(pick.text);
      setResultMood(pick.mood);
      setResultIsRoast(true);
    } else {
      const pool = [
        ...C_FUNNY,
        ...C_ABSURD,
        ...priceC(finalPrice.value),
        ...colorC(zones),
      ];
      setResultCompliment(
        pool[Math.floor(Math.random() * pool.length)] || "Très joli travail."
      );
      setResultMood(null);
      setResultIsRoast(false);
    }
    setShowResultScreen(true);
  };

  // ── result screen ──
  if (showResultScreen)
    return (
      <div className="vr">
        <style>
          {FONTS}
          {CSS}
        </style>
        <ParchmentBg />
        <div className="rscreen">
          <WildFlower
            style={{
              position: "absolute",
              top: "6%",
              left: "5%",
              width: "4rem",
              opacity: 0.28,
              transform: "rotate(-15deg)",
            }}
          />
          <Fern
            style={{
              position: "absolute",
              bottom: "8%",
              right: "4%",
              width: "3rem",
              opacity: 0.22,
              transform: "rotate(10deg)",
            }}
          />
          <div className="rcard fi">
            <LeafBranch
              style={{
                position: "absolute",
                top: "-0.5rem",
                right: "-0.5rem",
                width: "6rem",
                opacity: 0.18,
                transform: "rotate(20deg)",
              }}
            />

            {/* Portrait : Snow (roast) ou chat content (compliment) */}
            <div style={{ marginBottom: ".5rem" }}>
              {resultIsRoast ? (
                SNOW_MOODS[resultMood] || SNOW_MOODS.deadpan
              ) : (
                <HappyCat />
              )}
              {resultIsRoast && (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: ".68rem",
                    color: "#8a7050",
                    fontStyle: "italic",
                    margin: ".2rem 0 0",
                  }}
                >
                  Snow a un avis.
                </p>
              )}
            </div>

            <h2
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: "1.4rem",
                textAlign: "center",
                margin: "0 0 .25rem",
                color: "#2d2416",
              }}
            >
              {resultIsRoast ? "Le verdict de Snow" : "Résultat final"}
            </h2>
            <div className="rcomp">{resultCompliment}</div>
            <div
              style={{
                marginTop: "1rem",
                background: "rgba(245,240,225,.6)",
                border: "1px solid rgba(139,105,20,.12)",
                borderRadius: "3px",
                padding: ".75rem",
              }}
            >
              {[
                ["🌿 Verre", glassCost],
                ["🔧 Cuivre", copperCost],
                ["✦ Soudure", solderCost],
                ["🕐 Main d'œuvre", laborCost],
              ].map(([l, v]) => (
                <div key={l} className="fb tsm" style={{ padding: ".25rem 0" }}>
                  <span>{l}</span>
                  <span>{v.toFixed(2)} €</span>
                </div>
              ))}
              <div className="divider" />
              <div
                className="fb"
                style={{ fontWeight: 600, fontSize: ".9rem" }}
              >
                <span>Coût total</span>
                <span>{totalCost.toFixed(2)} €</span>
              </div>
            </div>
            <div className="rprice mt3">
              <div
                className="fb"
                style={{
                  fontFamily: "'Playfair Display',serif",
                  fontSize: "1.1rem",
                }}
              >
                <span>Prix final</span>
                <span>{finalPrice.value.toFixed(2)} €</span>
              </div>
            </div>
            <div className="fl g2r mt4">
              <button
                type="button"
                onClick={() => setShowResultScreen(false)}
                style={{
                  flex: 1,
                  background: "rgba(245,240,225,.8)",
                  border: "1px solid rgba(139,105,20,.2)",
                  borderRadius: "3px",
                  padding: ".65rem",
                  fontFamily: "'Lora',serif",
                  fontSize: ".85rem",
                  cursor: "pointer",
                  color: "#3a2e1a",
                }}
              >
                ← Retour
              </button>
              <button
                type="button"
                onClick={() =>
                  openResult(resultIsRoast ? "roast" : "compliment")
                }
                className={resultIsRoast ? "btn-w" : "btn-g"}
                style={{ flex: 1 }}
              >
                {resultIsRoast ? "Snow re-juge 🔥" : "Nouveau ✨"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  // ── main ──
  return (
    <div className="vr">
      <style>
        {FONTS}
        {CSS}
      </style>
      <ParchmentBg />
      <div
        style={{
          maxWidth: "28rem",
          margin: "0 auto",
          padding: "1rem 1rem 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div className="hdr-wrap" style={{ paddingTop: ".75rem" }}>
          <div className="hdr-inner">
            <Acorn
              style={{
                position: "absolute",
                top: ".4rem",
                left: ".8rem",
                width: "2rem",
                opacity: 0.35,
              }}
            />
            <WildFlower
              style={{
                position: "absolute",
                top: "-.2rem",
                right: ".6rem",
                width: "2.5rem",
                opacity: 0.28,
                transform: "scaleX(-1)",
              }}
            />
            <p className="hdr-eye">Atelier Vitrail</p>
            <h1 className="hdr-title">Calculateur Tiffany</h1>
          </div>
        </div>

        {/* Actions */}
        <div className="g2 mt3">
          <button type="button" onClick={reset} className="btn-w">
            Nouveau projet
          </button>
          <button
            type="button"
            onClick={() => setMode((p) => (p === "scale" ? "zone" : "scale"))}
            className="btn-g"
          >
            {mode === "scale" ? "→ Zones" : "⟷ Échelle"}
          </button>
        </div>

        {/* Image import */}
        <div className="card mt4">
          <p className="ctitle">
            <span>🌿</span>Image du patron
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
          />
        </div>

        {/* Canvas */}
        <div className="card mt3">
          {imageSrc ? (
            <>
              <div
                ref={canvasWrapRef}
                className="cwrap"
                onTouchStart={onWrapTouchStart}
                onTouchMove={onWrapTouchMove}
                onTouchEnd={onWrapTouchEnd}
                onClick={onWrapDoubleTap}
              >
                <canvas
                  ref={canvasRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  style={{
                    touchAction: "none",
                    cursor: mode === "scale" ? "crosshair" : "pointer",
                  }}
                />
                {zoomLevel > 1.05 && (
                  <div className="zoom-badge">×{zoomLevel.toFixed(1)}</div>
                )}
              </div>
              <p className="tmu mt2" style={{ textAlign: "center" }}>
                {mode === "scale"
                  ? "✏️ Trace une ligne de référence"
                  : zoomLevel > 1.05
                  ? "👆 Clique · 🤏 Pince pour zoomer · Double-tap pour réinitialiser"
                  : "👆 Clique · 🤏 Pince pour zoomer"}
              </p>
            </>
          ) : (
            <div className="ec">
              <LeafBranch style={{ width: "6rem", opacity: 0.4 }} />
              <span>Importe le patron de ton vitrail</span>
            </div>
          )}
        </div>

        {/* Scale */}
        {(scale || mode === "scale" || scaleLine || pendingScalePixels) && (
          <div className="card mt3 fi">
            <p className="ctitle">
              <span>📏</span>Échelle
            </p>
            {scale && (
              <p className="tsm">Enregistrée : {scale.toFixed(4)} cm/px</p>
            )}
            {!scale && mode === "scale" && !pendingScalePixels && (
              <p className="tmu">
                Trace une ligne, puis saisis sa longueur réelle.
              </p>
            )}
            {pendingScalePixels && (
              <div className="sy mt2">
                <p className="tsm">
                  Ligne : {pendingScalePixels.toFixed(1)} px
                </p>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={scaleInputCm}
                  onChange={(e) => setScaleInputCm(e.target.value)}
                  className="inp"
                  placeholder="Longueur réelle (cm)"
                />
                <button
                  type="button"
                  onClick={handleSaveScale}
                  className="btn-g wfull"
                >
                  Enregistrer l'échelle
                </button>
              </div>
            )}
          </div>
        )}

        {/* Warning */}
        {zones.length > 0 && !scale && (
          <div className="warn mt3">
            ⚠ Aucune échelle — les coûts ne peuvent pas être calculés.
          </div>
        )}

        {/* Zones */}
        {zones.length > 0 && (
          <div className="card mt3 fi">
            <p className="ctitle">
              <span>🍂</span>Zones — {zones.length}
            </p>
            <div className="sys mt2">
              {zones.map((zone) => {
                const zg = glasses.find((g) => g.id === zone.glassId);
                return (
                  <button
                    key={zone.id}
                    type="button"
                    className={`zone-row${
                      zone.id === selectedZoneId ? " sel" : ""
                    }`}
                    onClick={() =>
                      setSelectedZoneId((p) => (p === zone.id ? null : zone.id))
                    }
                  >
                    <div className="fg">
                      <span
                        className="cdot"
                        style={{
                          backgroundColor: zg
                            ? zg.couleur
                            : "rgba(139,105,20,.1)",
                        }}
                      />
                      <div>
                        <span
                          className="tsm tbold"
                          style={{ color: "#2d2416" }}
                        >
                          {zone.label}
                        </span>
                        {zg && (
                          <p
                            className="tmu"
                            style={{ margin: 0, fontSize: ".75rem" }}
                          >
                            {zg.nom}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="tmu">
                      {zone.area_px.toLocaleString()} px
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected zone */}
        {selectedZone && (
          <div className="card mt3 fi">
            <p className="ctitle">
              <span>✦</span>
              {selectedZone.label}
            </p>
            <div className="sys tsm">
              <div className="fb">
                <span>Surface</span>
                <span>
                  {selectedZone.area_px.toLocaleString()} px
                  {selectedZone.area_cm2 !== null
                    ? ` · ${selectedZone.area_cm2.toFixed(2)} cm²`
                    : ""}
                </span>
              </div>
              <div className="fb">
                <span>Périmètre</span>
                <span>{selectedZone.perimeter_px.toLocaleString()} px</span>
              </div>
              <div className="fb">
                <span>Verre</span>
                <span>{selectedGlass ? selectedGlass.nom : "—"}</span>
              </div>
              <div className="fb">
                <span>Coût zone</span>
                <span className="tbold">
                  {selectedZone.zone_cost.toFixed(2)} €
                </span>
              </div>
            </div>
            <div className="mt3">
              <span className="lbl">Attribuer un verre</span>
              <select
                value={selectedZone.glassId ?? ""}
                onChange={(e) => handleAssignGlass(e.target.value)}
                className="inp"
              >
                <option value="">— Choisir un verre —</option>
                {glasses.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom} — {toSafeNumber(g.prix_dm2, 0).toFixed(2)} €/dm²
                  </option>
                ))}
              </select>
            </div>
            <div className="mt3">
              <button
                type="button"
                onClick={handleDeleteZone}
                className="btn-d"
              >
                Supprimer la zone
              </button>
            </div>
          </div>
        )}

        {/* Copper */}
        <div className="card mt3">
          <p className="ctitle">
            <span>🔧</span>Cuivre
          </p>
          <div className="sys tsm mt2">
            <div className="fb">
              <span>Périmètre total</span>
              <span>{totalPerimPx.toLocaleString()} px</span>
            </div>
            <div className="fb">
              <span>Longueur</span>
              <span>
                {scale ? `${copperCm.toFixed(2)} cm` : "— échelle manquante"}
              </span>
            </div>
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={copperPricePerMeter}
            onChange={(e) => setCopperPricePerMeter(e.target.value)}
            className="inp mt3"
            placeholder="Prix cuivre (€/m)"
          />
          <div className="fb tsm mt2">
            <span>Coût cuivre</span>
            <span className="tbold">{copperCost.toFixed(2)} €</span>
          </div>
        </div>

        {/* Solder */}
        <div className="card mt3">
          <p className="ctitle">
            <span>✦</span>Soudure
          </p>
          <p className="tsm mt2">
            Longueur :{" "}
            {scale ? `${copperCm.toFixed(2)} cm` : "— échelle manquante"}
          </p>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={solderPricePerMeter}
            onChange={(e) => setSolderPricePerMeter(e.target.value)}
            className="inp mt3"
            placeholder="Prix soudure (€/m)"
          />
          <div className="fb tsm mt2">
            <span>Coût soudure</span>
            <span className="tbold">{solderCost.toFixed(2)} €</span>
          </div>
        </div>

        {/* Labour */}
        <div className="card mt3">
          <p className="ctitle">
            <span>🕐</span>Main d'œuvre
          </p>
          <div className="g2 mt2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={laborHours}
              onChange={(e) => setLaborHours(e.target.value)}
              className="inp"
              placeholder="Heures"
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={laborRate}
              onChange={(e) => setLaborRate(e.target.value)}
              className="inp"
              placeholder="€/heure"
            />
          </div>
          <div className="fb tsm mt2">
            <span>Coût main d'œuvre</span>
            <span className="tbold">{laborCost.toFixed(2)} €</span>
          </div>
        </div>

        {/* Total */}
        <div className="card mt3">
          <p className="ctitle">
            <span>🌱</span>Récapitulatif
          </p>
          <div className="sys mt2">
            {[
              ["Verre", glassCost],
              ["Cuivre", copperCost],
              ["Soudure", solderCost],
              ["Main d'œuvre", laborCost],
            ].map(([l, v]) => (
              <div key={l} className="fb tsm">
                <span>{l}</span>
                <span>{v.toFixed(2)} €</span>
              </div>
            ))}
            <div className="divider" />
            <div className="fb" style={{ fontSize: ".95rem", fontWeight: 600 }}>
              <span>Coût total</span>
              <span>{totalCost.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card mt3">
          <p className="ctitle">
            <span>🍀</span>Formule de prix
          </p>
          <div className="sy mt2">
            {[
              ["x2_materiaux", "×2 matériaux"],
              ["x2_plus_mo", "×2 matériaux + MO"],
              ["x3_total", "×3 total"],
              ["marge_30", "Marge 30 %"],
              ["custom", "Formule personnalisée"],
            ].map(([v, l]) => (
              <label key={v} className="rlabel">
                <input
                  type="radio"
                  name="pm"
                  checked={pricingMode === v}
                  onChange={() => setPricingMode(v)}
                />
                <span>{l}</span>
              </label>
            ))}
          </div>
          <div className="mt3">
            <input
              type="text"
              value={customFormula}
              onChange={(e) => setCustomFormula(e.target.value)}
              className="inp"
              placeholder="(cost_total * 2.5) + 20"
              disabled={pricingMode !== "custom"}
            />
            <p className="tmu mt2">
              Variables : cost_total · glass_cost · copper_cost · solder_cost ·
              labor_cost
            </p>
          </div>
          <div
            style={{
              marginTop: ".75rem",
              background: "rgba(245,240,225,.6)",
              border: "1px solid rgba(139,105,20,.12)",
              borderRadius: "3px",
              padding: ".65rem",
            }}
          >
            {finalPrice.error ? (
              <p className="err">Erreur : {finalPrice.error}</p>
            ) : (
              <p className="ok">
                Prix calculé :{" "}
                <span className="okv">{finalPrice.value.toFixed(2)} €</span>
              </p>
            )}
          </div>
          <div className="fl g2r mt3">
            <button
              type="button"
              onClick={() => openResult("compliment")}
              disabled={!!finalPrice.error}
              className="btn-g"
              style={{ flex: 1 }}
            >
              Calculer ✨
            </button>
            <button
              type="button"
              onClick={() => openResult("roast")}
              disabled={!!finalPrice.error}
              className="btn-w"
              style={{ flex: 1 }}
            >
              Roast 🔥
            </button>
          </div>
        </div>

        {/* Glass library */}
        <div className="card mt3" style={{ marginBottom: "2rem" }}>
          <p className="ctitle">
            <span>🪟</span>Bibliothèque de verres
          </p>
          <div className="sy mt2">
            <input
              type="text"
              value={glassForm.nom}
              onChange={(e) =>
                setGlassForm((p) => ({ ...p, nom: e.target.value }))
              }
              className="inp"
              placeholder="Nom du verre"
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={glassForm.prix_dm2}
              onChange={(e) =>
                setGlassForm((p) => ({ ...p, prix_dm2: e.target.value }))
              }
              className="inp"
              placeholder="Prix au dm² (€)"
            />
            <div className="cpick">
              <input
                type="color"
                value={glassForm.couleur}
                onChange={(e) =>
                  setGlassForm((p) => ({ ...p, couleur: e.target.value }))
                }
              />
              <span className="tmu">{glassForm.couleur}</span>
            </div>
            <button
              type="button"
              onClick={handleAddGlass}
              className="btn-g wfull"
            >
              Ajouter un verre
            </button>
          </div>
          <div className="sys mt4">
            {glasses.length === 0 ? (
              <p className="tmu">Aucun verre enregistré.</p>
            ) : (
              glasses.map((g) => (
                <div key={g.id} className="grow">
                  <div className="fg">
                    <span
                      className="cdot"
                      style={{
                        backgroundColor: g.couleur,
                        width: "18px",
                        height: "18px",
                      }}
                    />
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: ".85rem",
                          fontWeight: 500,
                          color: "#2d2416",
                        }}
                      >
                        {g.nom}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: ".75rem",
                          color: "#8a7050",
                          fontStyle: "italic",
                        }}
                      >
                        {toSafeNumber(g.prix_dm2, 0).toFixed(2)} €/dm²
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteGlass(g.id)}
                    className="btn-d"
                  >
                    Retirer
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer ornament */}
        <div style={{ textAlign: "center", opacity: 0.28, marginTop: "1rem" }}>
          <PineBranch style={{ width: "10rem", margin: "0 auto" }} />
        </div>

        {/* iPhone home bar safe area */}
        <div className="bottom-spacer" />
      </div>
    </div>
  );
}
