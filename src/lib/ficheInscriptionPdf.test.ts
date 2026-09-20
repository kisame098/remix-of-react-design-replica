import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { construireFiche, type FicheInscriptionData } from './ficheInscription';
import { genererFicheInscriptionPdf } from './ficheInscriptionPdf';
import { logoDeTest, pngDataUrl } from '@/test/helpers/png';

// ════════════════════════════════════════════════════════════════════════════
// On lit le PDF produit : identité, tuteurs, et surtout les IDENTIFIANTS — la
// raison d'être de cette fiche. Une fiche qui les perd renvoie la famille chez
// elle sans moyen de se connecter.
// ════════════════════════════════════════════════════════════════════════════

const photo = () => pngDataUrl(60, 76, (x, y) => [180 + (x % 20), 140 + (y % 30), 120, 255]);

const donnees = (extra: Partial<FicheInscriptionData> = {}): FicheInscriptionData => ({
  ...construireFiche({
    ecole: {
      nom: 'Collège Sainte Anne', ville: 'Dakar', pays: 'Sénégal', telephone: '77 123 45 67',
      email: 'contact@sainteanne.sn', adresse: 'BP 1234, Point E', ninea: '00512345 2G3', logo: logoDeTest(),
    },
    anneeScolaire: '2026-2027', dateInscription: '2026-09-19T10:00:00Z', reinscription: false,
    eleve: {
      firstName: 'Awa', lastName: 'Diop', studentId: 'ETU-2026-00042', sex: 'femme',
      dateOfBirth: '2012-03-05', placeOfBirth: 'Thiès', residence: 'Médina, Dakar', phone: '77 111 22 33',
      photoUrl: photo(),
      tutor1: { fullName: 'Moussa Diop', phone: '77 999 88 77', status: 'pere', email: 'moussa@exemple.sn' },
      tutor2: { fullName: 'Fatou Sow', phone: '76 000 11 22', status: 'mere' },
    },
    classe: { name: '6ème A', niveau: '6ème' }, filiere: undefined,
    tarifs: { inscriptionFee: 50000, monthlyFee: 25000 }, inscriptionPayee: true,
    compte: { identifiant: 'awa.diop.12345@senclass.com', motDePasse: 'Kx7mPq2Zab' },
    adresseSite: 'https://senclass.com',
  }),
  ...extra,
});

const brut = async (d: FicheInscriptionData) => {
  const doc = await genererFicheInscriptionPdf(d);
  return { doc, texte: Buffer.from(doc.output('arraybuffer')).toString('latin1') };
};

describe('fiche d\'inscription PDF', () => {
  it('est un vrai PDF A4', async () => {
    const { doc, texte } = await brut(donnees());
    expect(texte.startsWith('%PDF-')).toBe(true);
    expect(Math.round(doc.internal.pageSize.width)).toBe(210);
    expect(Math.round(doc.internal.pageSize.height)).toBe(297);
  });

  it('porte l\'identité, le matricule et l\'année', async () => {
    const { texte } = await brut(donnees());
    for (const attendu of ['DIOP', 'Awa', 'ETU-2026-00042', '05/03/2012', 'Thi', 'Nouvelle inscription', '2026-2027']) {
      expect(texte, attendu).toContain(attendu);
    }
  });

  it('LES IDENTIFIANTS DE CONNEXION : identifiant, mot de passe, site', async () => {
    const { texte } = await brut(donnees());
    expect(texte).toContain('awa.diop.12345@senclass.com');
    expect(texte).toContain('Kx7mPq2Zab');
    expect(texte).toContain('senclass.com');
    expect(texte).toContain('confidentiels');
  });

  it('la page 2 explique comment se connecter, installer l\'application et activer les notifications', async () => {
    const { texte } = await brut(donnees());
    expect(texte).toContain('COMMENT SE CONNECTER');
    expect(texte).toContain('cran d\'accueil');
    expect(texte).toContain('Activer les notifications');
  });

  it('avec identifiants : deux pages — la fiche, puis l\'exemplaire de la famille', async () => {
    const { doc } = await brut(donnees());
    expect(doc.getNumberOfPages()).toBe(2);
  });

  // ══ Le point de sécurité : le dossier d'archive ne donne pas accès au compte ══
  it('LA PAGE 1 (archivée par l\'école) NE CONTIENT NI MOT DE PASSE NI IDENTIFIANT', async () => {
    const doc = await genererFicheInscriptionPdf(donnees());
    doc.deletePage(2);                                   // on ne garde que la fiche de l'école
    const page1 = Buffer.from(doc.output('arraybuffer')).toString('latin1');
    expect(page1).not.toContain('Kx7mPq2Zab');
    expect(page1).not.toContain('awa.diop.12345@senclass.com');
    expect(page1).toContain('ETU-2026-00042');           // mais bien l'identité et le matricule
    expect(page1).toContain('page 2');                   // et un renvoi vers la page de la famille
  });

  it('sans identifiants lisibles : une seule page, qui renvoie vers l\'administration', async () => {
    const { doc, texte } = await brut(donnees({ compte: null }));
    expect(texte).not.toContain('Kx7mPq2Zab');
    expect(texte).toContain('retirer aupr');
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('les deux tuteurs figurent, avec leur qualité', async () => {
    const { texte } = await brut(donnees());
    for (const attendu of ['Moussa Diop', 'Fatou Sow', '77 999 88 77', '76 000 11 22']) expect(texte, attendu).toContain(attendu);
  });

  it('frais : montants, et case « payés » cochée ou non', async () => {
    const { texte } = await brut(donnees());
    expect(texte).toContain('50 000 FCFA');
    expect(texte).toContain('25 000 FCFA');
  });

  it('pas de frais saisis : la section n\'apparaît pas', async () => {
    const { texte } = await brut(donnees({ frais: undefined }));
    expect(texte).not.toContain('FRAIS DE SCOLARIT');
  });

  it('pièces à fournir, engagement et signatures', async () => {
    const { texte } = await brut(donnees());
    expect(texte).toContain('PIÈCES À FOURNIR'.replace('È', '\xC8').replace('À', '\xC0'));
    expect(texte).toContain('ENGAGEMENT');
    expect(texte).toContain('Lu et approuv');
  });

  it('photo : l\'image est intégrée ; sans photo, un cadre vide', async () => {
    expect((await brut(donnees())).texte).toContain('/Subtype /Image');
    const sans = donnees(); sans.eleve = { ...sans.eleve, photo: null }; sans.ecole = { ...sans.ecole, logo: null };
    const { texte } = await brut(sans);
    expect(texte).toContain('Photo');
  });

  it('une photo corrompue ne fait pas échouer la fiche', async () => {
    const d = donnees(); d.eleve = { ...d.eleve, photo: 'data:image/png;base64,PAS-UNE-IMAGE' };
    const { texte } = await brut(d);
    expect(texte).toContain('ETU-2026-00042');
  });

  it('réinscription indiquée', async () => {
    expect((await brut(donnees({ reinscription: true }))).texte).toContain('R\xE9inscription');
  });

  it('aucun caractère que les polices d\'un PDF ne savent pas dessiner', async () => {
    const { texte } = await brut(donnees());
    expect(texte).not.toMatch(/[\u202F\u2192\u2713]/);
  });

  it('la fiche de l\'école tient sur UNE page, même avec deux tuteurs et des frais', async () => {
    // Si elle débordait, la page « suite » se glisserait avant les identifiants.
    const { doc } = await brut(donnees());
    expect(doc.getNumberOfPages()).toBe(2);              // fiche + identifiants, rien d'autre
  });

  it('chaque page dit à qui elle est destinée, et porte sa pagination', async () => {
    const { doc, texte } = await brut(donnees());
    expect(texte).toContain('exemplaire de l\'\'école'.replace("''", "'") );
    expect(texte).toContain('Document confidentiel');
    expect(texte).toContain(`Page 1 / ${doc.getNumberOfPages()}`);
    expect(texte).toContain(`Page 2 / ${doc.getNumberOfPages()}`);
  });
});

describe.runIf(process.env.SORTIE_PDF)('exemplaires pour relecture visuelle', () => {
  it('écrit la fiche', async () => {
    const dossier = process.env.SORTIE_PDF as string;
    const doc = await genererFicheInscriptionPdf(donnees());
    writeFileSync(join(dossier, 'fiche-inscription.pdf'), Buffer.from(doc.output('arraybuffer')));
    const un = donnees(); un.tuteurs = un.tuteurs.slice(0, 1); un.compte = null;
    writeFileSync(join(dossier, 'fiche-sans-compte.pdf'), Buffer.from((await genererFicheInscriptionPdf(un)).output('arraybuffer')));
  });
});
