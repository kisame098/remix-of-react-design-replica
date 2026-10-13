import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import {
  CLE_CARTE_SCOLAIRE, ELEVE_EXEMPLE, FORMAT_STANDARD, REGLAGES_PAR_DEFAUT, TAILLE_MAX, TAILLE_MIN, TEXTE_VERSO_PAR_DEFAUT, TITRE_PAR_DEFAUT,
  ajuster, borner, dessinerFace, eleveCarte, lireReglagesCarte, naissance, planche, positionSurPlanche,
  type DonneesCarte, type Trace,
} from './carteScolaire';
import { creerMesure, fabriquerCartesPdf } from './carteScolairePdf';
import { paletteDepuis } from './couleurLogo';

// ════════════════════════════════════════════════════════════════════════════
// La carte doit tenir dans sa taille, quelle qu'elle soit : rien ne déborde,
// aucun texte n'est perdu sans « … ». Et le PDF a la taille exacte de la carte.
// (Le PDF est compressé : son contenu se vérifie sur les tracés, pas sur le fichier.)
// ════════════════════════════════════════════════════════════════════════════

const mesure = creerMesure();
const ecole = { nom: 'Groupe Scolaire Les Baobabs', ville: 'Dakar', pays: 'Sénégal', telephone: '33 820 00 00', directeurGeneral: 'M. Ibrahima FALL', logo: null };
const donnees = (reglages = REGLAGES_PAR_DEFAUT, eleve = ELEVE_EXEMPLE): DonneesCarte =>
  ({ reglages, eleve, ecole, anneeScolaire: '2026-2027', palette: paletteDepuis('#1B7A3E') });

/** Le rectangle occupé par un tracé (le texte : sa largeur mesurée, selon son alignement). */
const boite = (t: Trace): { x1: number; y1: number; x2: number; y2: number } => {
  if (t.type === 'courbe') {
    const xs = t.points.map(p => p[0]);
    const ys = t.points.map(p => p[1]);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  if (t.type === 'ligne') return { x1: Math.min(t.x1, t.x2), y1: Math.min(t.y1, t.y2), x2: Math.max(t.x1, t.x2), y2: Math.max(t.y1, t.y2) };
  if (t.type === 'texte') {
    const l = Math.max(...t.lignes.map(li => mesure(li, t.taille, t.style)));
    const x1 = t.align === 'center' ? t.x - l / 2 : t.align === 'right' ? t.x - l : t.x;
    return { x1, y1: t.y - t.taille * 0.3528 * 0.75, x2: x1 + l, y2: t.y + (t.lignes.length - 1) * t.interligne };
  }
  return { x1: t.x, y1: t.y, x2: t.x + t.l, y2: t.y + t.h };
};

const debordements = (traces: Trace[], l: number, h: number) =>
  traces.filter(t => { const b = boite(t); return b.x1 < -0.01 || b.y1 < -0.01 || b.x2 > l + 0.01 || b.y2 > h + 0.01; });

describe('réglages de la carte', () => {
  it('sans réglage enregistré : format standard des cartes plastiques, couleur du logo', () => {
    expect(lireReglagesCarte(null)).toEqual(REGLAGES_PAR_DEFAUT);
    expect(REGLAGES_PAR_DEFAUT).toMatchObject({ largeur: 85.6, hauteur: 53.98, couleur: null, titre: TITRE_PAR_DEFAUT, fond: 'motif' });
  });

  it('relit les réglages de l\'école et corrige ce qui est abîmé', () => {
    const r = lireReglagesCarte({ [CLE_CARTE_SCOLAIRE]: { largeur: 54, hauteur: '86,5', couleur: '#1b7a3e', titre: '  Carte scolaire ', texteVerso: '' } });
    expect(r).toEqual({ largeur: 54, hauteur: 86.5, couleur: '#1B7A3E', titre: 'Carte scolaire', texteVerso: TEXTE_VERSO_PAR_DEFAUT, fond: 'motif' });
    expect(lireReglagesCarte({ [CLE_CARTE_SCOLAIRE]: { fond: 'uni' } }).fond).toBe('uni');
    expect(lireReglagesCarte({ [CLE_CARTE_SCOLAIRE]: { largeur: 5000, hauteur: 'abc', couleur: 'rouge' } }))
      .toMatchObject({ largeur: TAILLE_MAX, hauteur: FORMAT_STANDARD.hauteur, couleur: null });
  });

  it('borne les dimensions saisies', () => {
    expect(borner('10', 85.6)).toBe(TAILLE_MIN);
    expect(borner(200, 85.6)).toBe(TAILLE_MAX);
    expect(borner('', 85.6)).toBe(85.6);
    expect(borner('70,25', 85.6)).toBe(70.25);
  });
});

describe('l\'élève sur la carte', () => {
  const source = {
    studentId: 'ETU-2026-00147', firstName: 'Mame Diarra', lastName: 'NDIAYE', sex: 'femme', dateOfBirth: '2012-11-23', placeOfBirth: 'Thiès',
    tutor1: { fullName: 'Aliou NDIAYE', phone: '' }, tutor2: { fullName: 'Awa SOW', phone: '77 451 23 89' },
  };

  it('la personne à prévenir est le premier tuteur qui a un téléphone', () => {
    expect(eleveCarte(source, '4ème B')).toMatchObject({ contactNom: 'Awa SOW', contactTelephone: '77 451 23 89', classe: '4ème B' });
  });

  it('sans nom de tuteur (l\'inscription ne le demande pas) : son lien avec l\'élève', () => {
    const sansNom = { ...source, tutor1: { phone: '77 451 23 89', status: 'mere' }, tutor2: undefined };
    expect(eleveCarte(sansNom)).toMatchObject({ contactNom: 'Mère', contactTelephone: '77 451 23 89' });
  });

  it('seule une photo déjà dans l\'application est imprimée, jamais un lien distant', () => {
    expect(eleveCarte({ ...source, photoUrl: 'https://exemple.com/p.jpg' }).photo).toBeNull();
    expect(eleveCarte({ ...source, photoUrl: 'data:image/png;base64,AAAA' }).photo).toBe('data:image/png;base64,AAAA');
  });

  it('date et lieu de naissance sans trou si l\'un manque', () => {
    expect(naissance(eleveCarte(source))).toBe('23/11/2012 à Thiès');
    expect(naissance(eleveCarte({ ...source, placeOfBirth: '' }))).toBe('23/11/2012');
  });
});

describe('ajuster un texte', () => {
  it('rétrécit, puis passe à la ligne, et ne tronque qu\'avec « … »', () => {
    expect(ajuster(mesure, 'Court', 50, 8).lignes).toEqual(['Court']);
    const long = 'Institution Sainte Jeanne d\'Arc de Dakar Plateau et Médina';
    const deux = ajuster(mesure, long, 40, 8, { lignesMax: 2, min: 5 });
    expect(deux.lignes.length).toBe(2);
    expect(deux.lignes.join(' ')).toBe(long);
    const coupe = ajuster(mesure, long, 20, 8, { lignesMax: 1, min: 6 });
    expect(coupe.lignes[0].endsWith('…')).toBe(true);
  });

  it('ne coupe jamais à une espace insécable (numéro de téléphone)', () => {
    const r = ajuster(mesure, 'appeler le 33\u00A0820\u00A000\u00A000 maintenant', 22, 8, { lignesMax: 3, min: 8 });
    // Jamais coupé, et écrit avec des espaces ordinaires.
    expect(r.lignes.some(l => l.includes('33 820 00 00'))).toBe(true);
  });
});

describe('mise en page', () => {
  const formats = [
    ['standard couchée', REGLAGES_PAR_DEFAUT],
    ['standard debout', { ...REGLAGES_PAR_DEFAUT, largeur: 53.98, hauteur: 85.6 }],
    ['petite', { ...REGLAGES_PAR_DEFAUT, largeur: 60, hauteur: 40 }],
    ['grande et étroite', { ...REGLAGES_PAR_DEFAUT, largeur: 120, hauteur: 50 }],
    ['badge allongé', { ...REGLAGES_PAR_DEFAUT, largeur: 55, hauteur: 110 }],
  ] as const;
  const eleveLong = {
    ...ELEVE_EXEMPLE, nom: 'DIOP-NDIAYE-SECK-FALL-THIAM', prenom: 'Serigne Mouhamadou Moustapha Abdoul Aziz',
    contactNom: 'Mame Fatou Bintou Diarra NDIAYE épouse SECK', lieuNaissance: 'Saint-Louis du Sénégal (Sor)',
  };

  it.each(formats)('format %s : rien ne déborde de la carte, recto comme verso', (_nom, r) => {
    for (const face of ['recto', 'verso'] as const) {
      for (const eleve of [ELEVE_EXEMPLE, eleveLong]) {
        const traces = dessinerFace(face, mesure, donnees(r, eleve));
        expect(debordements(traces, r.largeur, r.hauteur)).toEqual([]);
      }
    }
  });

  it('le recto porte l\'école, le titre, l\'année et l\'identité ; le verso la personne à prévenir et la signature', () => {
    const mots = (face: 'recto' | 'verso') => dessinerFace(face, mesure, donnees())
      .flatMap(t => (t.type === 'texte' ? t.lignes : [])).join(' | ');
    const recto = mots('recto');
    for (const attendu of ['GROUPE SCOLAIRE LES BAOBABS', TITRE_PAR_DEFAUT, '2026-2027', 'DIOP', 'Awa', '05/03/2012 à Dakar', '6ème A', 'ETU-2026-00001', 'NÉE LE']) {
      expect(recto).toContain(attendu);
    }
    const verso = mots('verso');
    for (const attendu of ['Moussa DIOP', 'Tél. 77 000 00 00', 'LE DIRECTEUR', 'M. Ibrahima FALL', 'CACHET', 'strictement personnelle']) expect(verso).toContain(attendu);
  });

  it('fond de sécurité (guilloches, rosace) sur les deux faces, sans aucun texte ; « uni » le retire', () => {
    for (const face of ['recto', 'verso'] as const) {
      const avec = dessinerFace(face, mesure, donnees());
      const sans = dessinerFace(face, mesure, donnees({ ...REGLAGES_PAR_DEFAUT, fond: 'uni' }));
      expect(avec.filter(t => t.type === 'courbe').length).toBeGreaterThan(10);
      expect(sans.some(t => t.type === 'courbe')).toBe(false);
      // Le motif n'ajoute que des courbes : les textes sont les mêmes.
      expect(avec.filter(t => t.type === 'texte')).toEqual(sans.filter(t => t.type === 'texte'));
    }
  });

  it('sans photo : un cadre « PHOTO » pour coller une photo d\'identité', () => {
    const traces = dessinerFace('recto', mesure, donnees());
    expect(traces.some(t => t.type === 'photo')).toBe(false);
    expect(traces.some(t => t.type === 'texte' && t.lignes[0] === 'PHOTO')).toBe(true);
    const avec = dessinerFace('recto', mesure, donnees(REGLAGES_PAR_DEFAUT, { ...ELEVE_EXEMPLE, photo: 'data:image/png;base64,AAAA' }));
    expect(avec.some(t => t.type === 'photo')).toBe(true);
  });
});

/** « Photographie » une face (tracés pleins seulement), à `ppm` pixels par mm, comme le ferait la caméra. */
const photographier = (traces: Trace[], l: number, h: number, ppm = 12) => {
  const W = Math.ceil(l * ppm);
  const H = Math.ceil(h * ppm);
  const px = new Uint8ClampedArray(W * H * 4).fill(255);
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (const t of traces) {
    if (t.type !== 'rect' || !t.fond) continue;
    const [r, g, b] = rgb(t.fond);
    for (let y = Math.round(t.y * ppm); y < Math.round((t.y + t.h) * ppm) && y < H; y++) {
      for (let x = Math.round(t.x * ppm); x < Math.round((t.x + t.l) * ppm) && x < W; x++) {
        const i = (y * W + x) * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b;
      }
    }
  }
  return jsQR(px, W, H);
};

describe('QR code du recto', () => {
  it.each([
    ['couchée', REGLAGES_PAR_DEFAUT],
    ['debout', { ...REGLAGES_PAR_DEFAUT, largeur: 53.98, hauteur: 85.6 }],
  ] as const)('carte %s : le QR se lit et rend le matricule — ce que cherchent les scanners des paiements', (_nom, r) => {
    const traces = dessinerFace('recto', mesure, donnees(r));
    expect(photographier(traces, r.largeur, r.hauteur)?.data).toBe('ETU-2026-00001');
  });

  it('le QR ne chevauche aucun texte du recto', () => {
    const traces = dessinerFace('recto', mesure, donnees());
    const qr = traces.filter(t => t.type === 'rect' && t.fond === '#000000').map(boite);
    const zone = { x1: Math.min(...qr.map(b => b.x1)), y1: Math.min(...qr.map(b => b.y1)), x2: Math.max(...qr.map(b => b.x2)), y2: Math.max(...qr.map(b => b.y2)) };
    const textes = traces.filter(t => t.type === 'texte').map(boite);
    expect(textes.filter(b => b.x1 < zone.x2 && b.x2 > zone.x1 && b.y1 < zone.y2 && b.y2 > zone.y1)).toEqual([]);
  });
});

describe('feuille A4 à découper', () => {
  it('10 cartes standard par feuille (2 × 5), centrées', () => {
    const pl = planche(REGLAGES_PAR_DEFAUT);
    expect([pl.colonnes, pl.rangees]).toEqual([2, 5]);
    expect(pl.x0).toBeCloseTo((210 - 2 * 85.6) / 2);
    expect(planche({ largeur: 53.98, hauteur: 85.6 })).toMatchObject({ colonnes: 3, rangees: 3 });
  });

  it('au verso, les colonnes sont en miroir : chaque dos tombe derrière son recto', () => {
    const pl = planche(REGLAGES_PAR_DEFAUT);
    const r = REGLAGES_PAR_DEFAUT;
    expect(positionSurPlanche(pl, r, 0, 'verso').x).toBeCloseTo(positionSurPlanche(pl, r, 1, 'recto').x);
    expect(positionSurPlanche(pl, r, 2, 'verso').y).toBeCloseTo(positionSurPlanche(pl, r, 2, 'recto').y);
  });
});

describe('PDF', () => {
  const base = { ecole, anneeScolaire: '2026-2027', palette: paletteDepuis('#1B7A3E') };
  const eleves = [ELEVE_EXEMPLE, { ...ELEVE_EXEMPLE, nom: 'SECK', prenom: 'Cheikh' }];

  it('imprimante à cartes : une page par face, à la taille exacte de la carte', () => {
    const doc = fabriquerCartesPdf({ ...base, reglages: REGLAGES_PAR_DEFAUT, eleves, sortie: 'carte' });
    expect(doc.getNumberOfPages()).toBe(4);
    for (let p = 1; p <= 4; p++) {
      doc.setPage(p);
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(85.6, 1);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(53.98, 1);
    }
  });

  it('badge debout : pages en portrait', () => {
    const doc = fabriquerCartesPdf({ ...base, reglages: { ...REGLAGES_PAR_DEFAUT, largeur: 53.98, hauteur: 85.6 }, eleves: [ELEVE_EXEMPLE], sortie: 'carte' });
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(53.98, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(85.6, 1);
  });

  it('feuille A4 : une page de recto puis une page de verso par groupe de 10 élèves', () => {
    const douze = Array.from({ length: 12 }, (_, i) => ({ ...ELEVE_EXEMPLE, matricule: `ETU-${i}` }));
    const doc = fabriquerCartesPdf({ ...base, reglages: REGLAGES_PAR_DEFAUT, eleves: douze, sortie: 'feuille' });
    expect(doc.getNumberOfPages()).toBe(4);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
  });
});
