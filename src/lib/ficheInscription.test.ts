import { describe, it, expect, vi } from 'vitest';
import {
  construireFiche, dateIsoVersFr, libelleQualite, libelleSexe,
} from './ficheInscription';
import { chargerIdentifiantsEleve } from './identifiantsEleve';

const sb = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: sb }));

const ecole = { nom: 'Collège Sainte Anne', ville: 'Dakar' };

const eleve = {
  firstName: 'Awa', lastName: 'Diop', studentId: 'ETU-2026-00042', sex: 'femme',
  dateOfBirth: '2012-03-05', placeOfBirth: 'Thiès', residence: 'Médina, Dakar',
  phone: '77 111 22 33', email: '',
  tutor1: { fullName: 'Moussa Diop', phone: '77 999 88 77', status: 'pere', email: 'moussa@exemple.sn' },
};

const base = (extra: Record<string, unknown> = {}) => construireFiche({
  ecole, anneeScolaire: '2026-2027', dateInscription: '2026-09-19T10:00:00Z', reinscription: false,
  eleve, classe: { name: '6ème A', niveau: '6ème' }, inscriptionPayee: true,
  compte: { identifiant: 'awa.diop.12345@senclass.com', motDePasse: 'Kx7mPq2Zab' },
  adresseSite: 'https://senclass.com', ...extra,
});

describe('petits libellés', () => {
  it.each([['pere', 'Père'], ['mere', 'Mère'], ['oncle', 'Oncle'], ['tante', 'Tante'], ['autre', 'Autre']])(
    'qualité %s → %s', (statut, attendu) => expect(libelleQualite(statut)).toBe(attendu));
  it('qualité inconnue ou absente : lisible', () => {
    expect(libelleQualite('grand-mere')).toBe('Grand-mere');
    expect(libelleQualite(undefined)).toBe('Tuteur');
  });
  it('sexe', () => {
    expect(libelleSexe('homme')).toBe('Masculin');
    expect(libelleSexe('femme')).toBe('Féminin');
    expect(libelleSexe(undefined)).toBe('—');
  });
  it('date ISO → jj/mm/aaaa, sans décalage de fuseau', () => {
    expect(dateIsoVersFr('2012-03-05')).toBe('05/03/2012');
    expect(dateIsoVersFr('2012-03-05T00:00:00.000Z')).toBe('05/03/2012');
    expect(dateIsoVersFr('2012-01-01')).toBe('01/01/2012');   // le 1er janvier ne devient pas le 31 décembre
    expect(dateIsoVersFr('n\'importe quoi')).toBe('n\'importe quoi');
    expect(dateIsoVersFr(undefined)).toBe('');
  });
});

describe('construireFiche', () => {
  it('nom en majuscules, prénoms tels que saisis, matricule', () => {
    const f = base();
    expect(f.eleve).toMatchObject({ nom: 'DIOP', prenoms: 'Awa', matricule: 'ETU-2026-00042', sexe: 'Féminin', dateNaissance: '05/03/2012' });
  });

  it('un seul tuteur : une seule ligne, pas de tuteur fantôme', () => {
    expect(base().tuteurs).toEqual([
      { qualite: 'Père', nom: 'Moussa Diop', telephone: '77 999 88 77', email: 'moussa@exemple.sn' },
    ]);
  });

  it('deux tuteurs : les deux figurent', () => {
    const f = base({ eleve: { ...eleve, tutor2: { fullName: 'Fatou Sow', phone: '76 000 11 22', status: 'mere' } } });
    expect(f.tuteurs.map(t => t.qualite)).toEqual(['Père', 'Mère']);
  });

  it('un tuteur 2 sans téléphone est ignoré (formulaire à moitié rempli)', () => {
    const f = base({ eleve: { ...eleve, tutor2: { fullName: 'Quelqu\'un', phone: '', status: 'mere' } } });
    expect(f.tuteurs).toHaveLength(1);
  });

  it('champs vides → absents plutôt que des chaînes vides', () => {
    expect(base().eleve.email).toBeUndefined();
  });

  it('réinscription signalée', () => {
    expect(base({ reinscription: true }).reinscription).toBe(true);
  });

  it('les identifiants de connexion figurent avec l\'adresse du site', () => {
    expect(base().compte).toEqual({
      adresseSite: 'https://senclass.com', identifiant: 'awa.diop.12345@senclass.com', motDePasse: 'Kx7mPq2Zab',
    });
  });

  it('sans compte lisible : null, jamais des identifiants inventés', () => {
    expect(base({ compte: null }).compte).toBeNull();
  });

  it('frais : seulement si l\'école a saisi ses tarifs', () => {
    expect(base().frais).toBeUndefined();
    expect(base({ tarifs: { inscriptionFee: 50000, monthlyFee: 25000 } }).frais)
      .toEqual({ inscription: 50000, mensualite: 25000, inscriptionPayee: true });
  });

  it('photo : uniquement une data URL (jsPDF ne va pas chercher une image distante)', () => {
    expect(base({ eleve: { ...eleve, photoUrl: 'data:image/jpeg;base64,AAAA' } }).eleve.photo).toBe('data:image/jpeg;base64,AAAA');
    expect(base({ eleve: { ...eleve, photoUrl: 'https://exemple.sn/photo.jpg' } }).eleve.photo).toBeNull();
    expect(base().eleve.photo).toBeNull();
  });

  it('classe, niveau et filière', () => {
    expect(base({ filiere: 'Série S2' }).scolarite).toEqual({ classe: '6ème A', niveau: '6ème', filiere: 'Série S2' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Le compte de l'élève se crée EN ARRIÈRE-PLAN après l'inscription : sa ligne
// apparaît un instant plus tard. Sans nouvelle tentative, la fiche sortirait
// SANS identifiants alors que la famille repart avec.
// ════════════════════════════════════════════════════════════════════════════
describe('chargerIdentifiantsEleve', () => {
  const trouve = { identifiant: 'a@senclass.com', motDePasse: 'Abc123' };

  it('trouvé du premier coup : une seule lecture', async () => {
    const lire = vi.fn().mockResolvedValue(trouve);
    await expect(chargerIdentifiantsEleve('e1', { lire, delaiMs: 0 })).resolves.toEqual(trouve);
    expect(lire).toHaveBeenCalledTimes(1);
  });

  it('pas encore créé, puis là : réessaie et le trouve', async () => {
    const lire = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(trouve);
    await expect(chargerIdentifiantsEleve('e1', { lire, delaiMs: 0 })).resolves.toEqual(trouve);
    expect(lire).toHaveBeenCalledTimes(3);
  });

  it('une erreur passagère ne fait pas abandonner', async () => {
    const lire = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce(trouve);
    await expect(chargerIdentifiantsEleve('e1', { lire, delaiMs: 0 })).resolves.toEqual(trouve);
  });

  it('jamais là : null après le nombre de tentatives, sans boucler', async () => {
    const lire = vi.fn().mockResolvedValue(null);
    await expect(chargerIdentifiantsEleve('e1', { lire, delaiMs: 0, tentatives: 3 })).resolves.toBeNull();
    expect(lire).toHaveBeenCalledTimes(3);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LA LECTURE RÉELLE. Un déclencheur de la base chiffre le mot de passe et VIDE la
// colonne `password_plain` : le lire là donne toujours « rien », et la fiche sort
// sans page d'identifiants. Les tests ci-dessus injectent un faux lecteur : ils ne
// pouvaient pas voir ce bug. Ceux-ci font tourner le vrai lecteur, contre un faux
// client Supabase.
// ════════════════════════════════════════════════════════════════════════════
describe('chargerIdentifiantsEleve — lecture réelle en base', () => {
  const requeteCompte = (resultat: { data: unknown; error: unknown }) => {
    const select = vi.fn();
    const chaine = { select, eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(resultat) };
    select.mockReturnValue(chaine);
    chaine.eq.mockReturnValue(chaine);
    sb.from.mockReturnValue(chaine);
    return { select, eq: chaine.eq };
  };

  const essayer = () => chargerIdentifiantsEleve('insc-1', { tentatives: 1, delaiMs: 0 });

  it('lit l\'identifiant, puis DÉCHIFFRE le mot de passe par la fonction prévue', async () => {
    const { select, eq } = requeteCompte({ data: { id: 'compte-9', email: 'awa.diop.12345@senclass.com' }, error: null });
    sb.rpc.mockResolvedValue({ data: 'Kx7mPq2Zab', error: null });

    await expect(essayer()).resolves.toEqual({ identifiant: 'awa.diop.12345@senclass.com', motDePasse: 'Kx7mPq2Zab' });

    expect(sb.from).toHaveBeenCalledWith('school_accounts');
    expect(eq).toHaveBeenCalledWith('student_enrollment_id', 'insc-1');
    expect(eq).toHaveBeenCalledWith('role', 'student');
    expect(sb.rpc).toHaveBeenCalledWith('reveal_school_account_password', { p_account_id: 'compte-9' });
    // Le mot de passe ne se lit JAMAIS dans la colonne : elle est vidée par la base.
    expect(select).toHaveBeenCalledWith('id, email');
    expect(select.mock.calls.flat().join(' ')).not.toContain('password_plain');
  });

  it('aucun compte trouvé : null, sans appeler le déchiffrement', async () => {
    requeteCompte({ data: null, error: null });
    sb.rpc.mockClear();
    await expect(essayer()).resolves.toBeNull();
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it('lecture du compte refusée (droits) : null', async () => {
    requeteCompte({ data: null, error: { message: 'refusé' } });
    await expect(essayer()).resolves.toBeNull();
  });

  it('déchiffrement refusé (pas admin de cette école) : null, jamais un mot de passe inventé', async () => {
    requeteCompte({ data: { id: 'compte-9', email: 'a@senclass.com' }, error: null });
    sb.rpc.mockResolvedValue({ data: null, error: { message: 'Non autorisé' } });
    await expect(essayer()).resolves.toBeNull();
  });

  it('mot de passe vide : null', async () => {
    requeteCompte({ data: { id: 'compte-9', email: 'a@senclass.com' }, error: null });
    sb.rpc.mockResolvedValue({ data: '', error: null });
    await expect(essayer()).resolves.toBeNull();
  });
});
