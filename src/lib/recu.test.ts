import { describe, it, expect } from 'vitest';
import type { Payment, Receipt } from '@/types/payment';
import { construireRecu, libelleDuPaiement, numeroDeRecu } from './recu';
import type { InfosEcole } from './documentsEcole';

// ════════════════════════════════════════════════════════════════════════════
// Ce qui s'imprime sur un reçu se décide ici, avant tout PDF : numéro, lignes,
// total, mode de paiement. Une erreur de total sur un reçu, c'est de l'argent.
// ════════════════════════════════════════════════════════════════════════════

const ecole: InfosEcole = { nom: 'Collège Sainte Anne', ville: 'Dakar', pays: 'Sénégal' };
const eleve = { nom: 'DIOP Awa', matricule: 'ETU-2026-00042', classe: '6ème A' };
const mois = (cle?: string) => ({ '2026-09': 'Septembre 2026', '2026-10': 'Octobre 2026' } as Record<string, string>)[cle ?? ''] ?? cle ?? '';
const services = [{ id: 'svc1', name: 'Cantine' }];
const recu: Receipt = { id: 'r1', academicYearLabel: '2026-2027', number: 42, studentId: 'e1', createdAt: '2026-09-19T10:00:00Z' };

let n = 0;
const paiement = (extra: Partial<Payment> = {}): Payment => ({
  id: `p${++n}`, studentId: 'e1', studentUniqueId: 'ETU-2026-00042', academicYearLabel: '2026-2027',
  type: 'tuition', monthKey: '2026-09', amount: 25000, method: 'especes',
  paidAt: '2026-09-19T10:00:00Z', status: 'confirmed', receivedBy: 'Fatou Sow', ...extra,
});

const construire = (paiements: Payment[], duplicata = false) =>
  construireRecu({ ecole, recu, paiements, eleve, services, libelleMois: mois, duplicata });

describe('numeroDeRecu', () => {
  it('année de début + numéro sur 5 chiffres', () => {
    expect(numeroDeRecu('2026-2027', 42)).toBe('REC-2026-00042');
    expect(numeroDeRecu('2026-2027', 1)).toBe('REC-2026-00001');
    expect(numeroDeRecu('2026-2027', 12345)).toBe('REC-2026-12345');
  });
  it('deux années différentes ne se confondent pas', () => {
    expect(numeroDeRecu('2025-2026', 7)).not.toBe(numeroDeRecu('2026-2027', 7));
  });
  it('un libellé d\'année inattendu ne fait pas planter', () => {
    expect(numeroDeRecu('Année spéciale', 3)).toBe('REC-Année spéciale-00003');
  });
});

describe('libelleDuPaiement', () => {
  it('inscription', () => {
    expect(libelleDuPaiement({ type: 'inscription' }, services, mois)).toBe("Frais d'inscription");
  });
  it('scolarité avec son mois en toutes lettres', () => {
    expect(libelleDuPaiement({ type: 'tuition', monthKey: '2026-09' }, services, mois)).toBe('Scolarité — Septembre 2026');
  });
  it('service annexe : son nom, et son mois s\'il y en a un', () => {
    expect(libelleDuPaiement({ type: 'service', serviceId: 'svc1', monthKey: '2026-10' }, services, mois)).toBe('Cantine — Octobre 2026');
    expect(libelleDuPaiement({ type: 'service', serviceId: 'svc1' }, services, mois)).toBe('Cantine');
  });
  it('service supprimé depuis : reste lisible', () => {
    expect(libelleDuPaiement({ type: 'service', serviceId: 'disparu' }, services, mois)).toBe('Service annexe');
  });
});

describe('construireRecu — un encaissement, plusieurs lignes', () => {
  it('inscription + deux mois : trois lignes, un total exact', () => {
    const r = construire([
      paiement({ type: 'tuition', monthKey: '2026-10', amount: 25000 }),
      paiement({ type: 'inscription', monthKey: undefined, amount: 50000 }),
      paiement({ type: 'tuition', monthKey: '2026-09', amount: 25000 }),
    ]);
    expect(r.total).toBe(100000);
    // Ordre stable : inscription, puis les mois dans l'ordre du calendrier.
    expect(r.lignes.map(l => l.designation)).toEqual([
      "Frais d'inscription", 'Scolarité — Septembre 2026', 'Scolarité — Octobre 2026',
    ]);
    expect(r.numero).toBe('REC-2026-00042');
  });

  it('le total est la somme exacte des lignes', () => {
    const paiements = [12500, 7500, 30000, 1].map(amount => paiement({ amount, monthKey: undefined, type: 'inscription' }));
    expect(construire(paiements).total).toBe(50001);
  });

  it('un reçu sans paiement est refusé', () => {
    expect(() => construire([])).toThrow();
  });
});

describe('construireRecu — mode de paiement', () => {
  it('un seul mode', () => {
    expect(construire([paiement(), paiement({ monthKey: '2026-10' })]).mode).toBe('Espèces');
  });
  it('plusieurs modes dans le même encaissement : tous listés', () => {
    expect(construire([paiement({ method: 'especes' }), paiement({ method: 'wave', monthKey: '2026-10' })]).mode).toBe('Espèces, Wave');
  });
  it('références réunies, sans doublon', () => {
    const r = construire([paiement({ method: 'cheque', reference: 'CHQ-1' }), paiement({ method: 'cheque', reference: 'CHQ-1', monthKey: '2026-10' })]);
    expect(r.reference).toBe('CHQ-1');
    expect(construire([paiement()]).reference).toBeUndefined();
  });
  it('qui a encaissé', () => {
    expect(construire([paiement()]).encaissePar).toBe('Fatou Sow');
    expect(construire([paiement({ receivedBy: undefined })]).encaissePar).toBeUndefined();
  });
});

describe('construireRecu — la date est celle du dernier paiement', () => {
  it('même si les paiements ont été insérés à quelques secondes d\'écart', () => {
    const r = construire([
      paiement({ paidAt: '2026-09-19T10:00:00Z' }),
      paiement({ paidAt: '2026-09-19T10:00:04Z', monthKey: '2026-10' }),
    ]);
    expect(r.date).toBe('2026-09-19T10:00:04Z');
  });
});

describe('construireRecu — annulation', () => {
  it('tout annulé : le reçu est ANNULÉ, avec qui et quand', () => {
    const r = construire([paiement({ status: 'cancelled', cancelledAt: '2026-09-20T08:00:00Z', cancelledBy: 'Le directeur' })]);
    expect(r.annule).toEqual({ le: '2026-09-20T08:00:00Z', par: 'Le directeur' });
    expect(r.total).toBe(0);
  });

  it('une seule ligne annulée : le reçu reste valable, le total l\'exclut', () => {
    const r = construire([
      paiement({ monthKey: '2026-09', amount: 25000 }),
      paiement({ monthKey: '2026-10', amount: 25000, status: 'cancelled', cancelledAt: '2026-09-20T08:00:00Z' }),
    ]);
    expect(r.annule).toBeNull();
    expect(r.total).toBe(25000);
    expect(r.lignes.map(l => l.annulee)).toEqual([false, true]);
  });

  it('un paiement en règle n\'est pas marqué annulé', () => {
    expect(construire([paiement()]).annule).toBeNull();
  });
});

describe('construireRecu — duplicata', () => {
  it('le drapeau est transmis tel quel', () => {
    expect(construire([paiement()], true).duplicata).toBe(true);
    expect(construire([paiement()], false).duplicata).toBe(false);
  });
});
