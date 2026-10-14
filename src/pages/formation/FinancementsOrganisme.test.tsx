import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ════════════════════════════════════════════════════════════════════════════
// L'espace d'un organisme : quatre rubriques à gauche (comme Gestion des
// paiements), les apprenants avec leurs trois fenêtres (dossier, insertion,
// suivi), la facturation pour un apprenant / une promotion / une formation /
// tous. Seuls les dossiers validés se facturent.
// ════════════════════════════════════════════════════════════════════════════

const organisme = {
  id: 'fpt', nom: '3FPT', partFinancee: 90,
  tranches: [{ id: 'a', libelle: 'Acompte', pourcentage: 70 }, { id: 's', libelle: 'Solde', pourcentage: 30 }],
  frais: { inscription: true, mensualites: true, services: [] }, pieces: [{ id: 'cni', nom: 'CNI' }],
};
const eleve = (id: string, nom: string, classId = 'c1') => ({ id, studentId: `ETU-${id}`, firstName: 'Awa', lastName: nom, classId });
const dossier = (id: string, e: string, statut: string) => ({
  id, studentEnrollmentId: e, organismeId: 'fpt', statut, contratSigne: false, engagementSigne: false,
  situation: 'en_formation', ajustementIds: [], pieces: [], createdAt: '', updatedAt: '',
});
const emettre = vi.fn();
let fin: Record<string, unknown>;

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ accountRole: 'admin', school: { settings: {} }, updateSchoolSettings: vi.fn() }) }));
vi.mock('@/contexts/FinancementsContext', () => ({ useFinancements: () => fin }));
vi.mock('@/contexts/SchoolContext', () => ({ useSchool: () => ({ students: [eleve('e1', 'DIOP'), eleve('e2', 'FALL'), eleve('e3', 'SARR')] }) }));
vi.mock('@/contexts/FormationProContext', () => ({
  useFormationPro: () => ({
    promotions: [{ id: 'p1', name: 'CAP 1 — 2026', classId: 'c1', niveauId: 'n1', endDate: '2027-06-30' }],
    niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1' }], formations: [{ id: 'f1', name: 'Cuisine' }],
    niveauMatieres: [], baremeCategories: [], periodes: [], evaluations: [], notes: [],
  }),
}));
vi.mock('@/hooks/useElementsAPayer', () => ({
  useElementsAPayer: () => ({ elementsDe: () => [{ id: 'inscription', type: 'inscription', tarifNormal: 100000, du: 100000, amount: 10000, paid: false, personnalise: false, dejaVerse: 0, blocked: false, label: '', partOrganisme: 90000, priseEnChargeTotale: false }] }),
}));
vi.mock('@/contexts/AttendanceContext', () => ({ useAttendance: () => ({ studentAttendances: [{ studentId: 'e1', status: 'present' }, { studentId: 'e1', status: 'absent' }] }) }));
vi.mock('@/contexts/ExamensContext', () => ({ useExamens: () => ({ examens: [], tours: [], epreuves: [], notes: [], candidats: [], resultats: [] }) }));
vi.mock('@/contexts/StagesContext', () => ({
  useStages: () => ({ stages: [{ id: 'st', promotionId: 'p1', studentEnrollmentId: 'e1', entrepriseId: 'h', poste: 'Commis', dateDebut: '2026-11-01', dateFin: '2026-12-01', conventionSignee: true, abandonne: false, createdAt: '' }], entreprises: [{ id: 'h', nom: 'Hôtel Terrou-Bi' }] }),
}));
vi.mock('@/contexts/PaymentContext', () => ({ usePayment: () => ({ annexServices: [] }) }));

import FinancementsOrganisme from './FinancementsOrganisme';

const ouvrir = () => render(
  <MemoryRouter initialEntries={['/formation/financements/fpt']}>
    <Routes><Route path="/formation/financements/:organismeId" element={<FinancementsOrganisme />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  emettre.mockReset().mockImplementation(async (b: unknown[]) => b.map((x, i) => ({ ...(x as object), id: `f${i}`, numero: 1, annee: 2026, total: 0, annulee: false, createdAt: '' })));
  fin = {
    actif: true, loading: false, disponible: true, suiviDisponible: true,
    reglages: { actif: true, organismes: [organisme] },
    organisme: (id: string) => (id === 'fpt' ? organisme : undefined),
    dossiers: [dossier('d1', 'e1', 'valide'), dossier('d2', 'e2', 'en_attente')],
    dossierDe: (e: string) => (fin.dossiers as { studentEnrollmentId: string }[]).find(d => d.studentEnrollmentId === e),
    factures: [], versements: [], rapports: [], journal: [], insertions: [],
    emettreFactures: emettre, modifier: vi.fn(), activer: vi.fn(),
  };
});

describe('espace d\'un organisme', () => {
  it('quatre rubriques ; les statistiques ne comptent que les dossiers validés', () => {
    ouvrir();
    expect(screen.getByRole('heading', { name: '3FPT' })).toBeInTheDocument();
    for (const r of ['Statistiques', 'Apprenants', 'Gestion financière', 'Rapports']) expect(screen.getByRole('button', { name: new RegExp(r) })).toBeInTheDocument();
    // 90 000 pris en charge (un seul dossier validé), un dossier à valider signalé.
    expect(screen.getByText('Pris en charge').nextElementSibling?.textContent?.replace(/\s/g, '')).toBe('90000');
    expect(screen.getByText(/1 dossier à valider/)).toBeInTheDocument();
  });

  it('apprenants : trois fenêtres — dossier, insertion (avec ses stages), suivi de la formation', () => {
    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Apprenants/ }));
    expect(screen.getByText('DIOP', { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /^Dossier — DIOP/ })[0]);
    expect(screen.getByText('Statut du dossier')).toBeInTheDocument();
    expect(screen.getByText(/Prise en charge active/)).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    fireEvent.click(screen.getAllByRole('button', { name: /^Insertion — DIOP/ })[0]);
    expect(screen.getByText('Hôtel Terrou-Bi', { exact: false })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    fireEvent.click(screen.getAllByRole('button', { name: /^Suivi — DIOP/ })[0]);
    expect(screen.getByText('Assiduité')).toBeInTheDocument();
    expect(screen.getByText('50 %')).toBeInTheDocument();
  });

  it('un dossier non validé : « l\'apprenant paie tout »', () => {
    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Apprenants/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Dossier — FALL/ })[0]);
    expect(within(screen.getByRole('dialog')).getByText(/l'apprenant paie ses frais en entier/)).toBeInTheDocument();
  });

  it('facturer une promotion : seuls les dossiers validés, acompte 70 % des 90 000', async () => {
    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Gestion financière/ }));
    fireEvent.click(screen.getByRole('button', { name: /Émettre une facture/ }));
    const dialogue = screen.getByRole('dialog');
    expect(within(dialogue).getByText(/1 dossier pas encore validé/)).toBeInTheDocument();
    expect(within(dialogue).getAllByText('63 000 F')).toHaveLength(2); // la ligne et le total
    fireEvent.click(within(dialogue).getByRole('button', { name: /Émettre et imprimer/ }));
    await vi.waitFor(() => expect(emettre).toHaveBeenCalledTimes(1));
    expect(emettre.mock.calls[0][0][0]).toMatchObject({ portee: 'cohorte', classId: 'c1', trancheLibelle: 'Acompte', lignes: [{ dossierId: 'd1', montant: 63000 }] });
  });

  it('facturer tous les apprenants : aucune promotion attachée', async () => {
    ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Gestion financière/ }));
    fireEvent.click(screen.getByRole('button', { name: /Émettre une facture/ }));
    const dialogue = screen.getByRole('dialog');
    fireEvent.click(within(dialogue).getByRole('button', { name: /^Tous$/ }));
    fireEvent.click(within(dialogue).getByRole('button', { name: /Émettre et imprimer/ }));
    await vi.waitFor(() => expect(emettre).toHaveBeenCalledTimes(1));
    expect(emettre.mock.calls[0][0][0]).toMatchObject({ portee: 'cohorte', classId: undefined });
  });
});
