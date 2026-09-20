import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ProfilMatieres } from './ProfilMatieres';
import { appliquerReglageLocal, resolveAcademicProfile } from '@/lib/academicProfile';
import type { AcademicProfileRow } from '@/lib/academicProfile';
import type { GradePeriod, Subject, SubjectSettingsData } from '@/contexts/SchoolContext';

// ════════════════════════════════════════════════════════════════════════════
// LE BUG, tel que l'école le voit : on désactive l'EPS pour un élève, et la
// matière DISPARAÎT du profil académique — impossible de la réactiver. Ces tests
// cliquent sur l'interrupteur, comme le fait l'utilisateur, et regardent l'écran.
// ════════════════════════════════════════════════════════════════════════════

const ligne = (nom: string, over: Partial<AcademicProfileRow> = {}): AcademicProfileRow => ({
  subject: { id: `id-${nom}`, name: nom, coefficient: 2, classId: 'c', periodId: 'p1', ordering: 0, subjectType: 'obligatoire' },
  occurrenceIds: [`id-${nom}`], active: true, partielle: false, desactivee: false,
  coefficient: 2, source: 'Hérité du cursus', ...over,
});

const monter = (lignes: AcademicProfileRow[], onBasculer = vi.fn(), onCoefficient = vi.fn()) => {
  render(<ProfilMatieres lignes={lignes} onBasculer={onBasculer} onCoefficient={onCoefficient} />);
  return { onBasculer, onCoefficient };
};

describe('une matière désactivée est visible ET réactivable', () => {
  it('l\'EPS désactivée est bien à l\'écran, barrée, avec son étiquette', () => {
    monter([ligne('EPS', { active: false, desactivee: true }), ligne('Maths')]);
    expect(screen.getByText('EPS')).toBeInTheDocument();
    expect(screen.getByText('EPS')).toHaveClass('line-through');
    expect(screen.getByText('Désactivée pour cet élève')).toBeInTheDocument();
    expect(screen.getByText('Maths')).not.toHaveClass('line-through');
  });

  it('son interrupteur est là, décoché, et propose de RÉACTIVER', () => {
    monter([ligne('EPS', { active: false, desactivee: true })]);
    const bouton = screen.getByRole('switch', { name: /Réactiver EPS/ });
    expect(bouton).toHaveAttribute('aria-checked', 'false');
  });

  it('cliquer dessus demande la RÉACTIVATION', () => {
    const { onBasculer } = monter([ligne('EPS', { active: false, desactivee: true })]);
    fireEvent.click(screen.getByRole('switch', { name: /Réactiver EPS/ }));
    expect(onBasculer).toHaveBeenCalledTimes(1);
    expect(onBasculer.mock.calls[0][0].subject.name).toBe('EPS');
    expect(onBasculer.mock.calls[0][1]).toBe(true);
  });

  it('une matière active se désactive par le même interrupteur', () => {
    const { onBasculer } = monter([ligne('EPS')]);
    fireEvent.click(screen.getByRole('switch', { name: /Désactiver EPS/ }));
    expect(onBasculer.mock.calls[0][1]).toBe(false);
  });

  it('le coefficient d\'une matière désactivée est grisé (elle ne compte plus)', () => {
    monter([ligne('EPS', { active: false, desactivee: true })]);
    expect(screen.getByLabelText('Coefficient de EPS')).toBeDisabled();
  });

  it('le coefficient d\'une matière active se modifie', () => {
    const { onCoefficient } = monter([ligne('Maths')]);
    const champ = screen.getByLabelText('Coefficient de Maths');
    fireEvent.change(champ, { target: { value: '3' } });
    fireEvent.blur(champ);
    expect(onCoefficient).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.objectContaining({ name: 'Maths' }) }), '3');
  });
});

describe('réglage différent selon les périodes', () => {
  it('est signalé, avec la façon de le corriger', () => {
    monter([ligne('EPS', { active: false, partielle: true })]);
    expect(screen.getByText('Réglage différent selon les périodes')).toBeInTheDocument();
    expect(screen.getByText(/L'interrupteur l'applique à toutes/)).toBeInTheDocument();
  });

  it('une matière cohérente n\'affiche aucun avertissement', () => {
    monter([ligne('Maths')]);
    expect(screen.queryByText(/Réglage différent/)).toBeNull();
    expect(screen.queryByText(/Désactivée pour cet élève/)).toBeNull();
  });
});

// ── Le parcours complet, avec la vraie logique : on clique, l'écran suit ─────
describe('le parcours de l\'école : désactiver, retrouver, réactiver', () => {
  const YEAR = '2025-2026';
  const periodes: GradePeriod[] = ['p1', 'p2'].map((id, i) => ({
    id, name: id, type: 'semester', academicYearLabel: YEAR, ordering: i, createdAt: new Date('2025-09-01'),
  }));
  const subject = (id: string, name: string, periodId: string): Subject =>
    ({ id, name, coefficient: 2, classId: 'c', periodId, ordering: 0, subjectType: 'obligatoire' });
  const matieres = [subject('e1', 'EPS', 'p1'), subject('e2', 'EPS', 'p2'), subject('m1', 'Maths', 'p1'), subject('m2', 'Maths', 'p2')];

  /** Un profil branché sur la vraie logique, comme StudentManagement le fait. */
  const Profil = () => {
    const [reglages, setReglages] = useState<SubjectSettingsData[]>([]);
    const lignes = resolveAcademicProfile(
      matieres, periodes, id => reglages.find(r => r.subjectId === id), 'enr-1', 'c', YEAR, { inclureDesactivees: true });
    return (
      <ProfilMatieres
        lignes={lignes}
        onBasculer={(l, actif) => setReglages(prev => appliquerReglageLocal(prev, l.occurrenceIds, 'enr-1', actif))}
        onCoefficient={() => undefined}
      />
    );
  };

  it('on désactive l\'EPS : elle reste à l\'écran ; on la réactive : elle redevient ordinaire', () => {
    render(<Profil />);
    expect(screen.getByRole('switch', { name: /Désactiver EPS/ })).toHaveAttribute('aria-checked', 'true');

    // 1. on désactive
    fireEvent.click(screen.getByRole('switch', { name: /Désactiver EPS/ }));

    // 2. LA MATIÈRE N'A PAS DISPARU
    expect(screen.getByText('EPS'), 'l\'EPS a disparu du profil').toBeInTheDocument();
    expect(screen.getByText('Désactivée pour cet élève')).toBeInTheDocument();
    // Et les autres matières ne bougent pas.
    expect(screen.getByRole('switch', { name: /Désactiver Maths/ })).toHaveAttribute('aria-checked', 'true');

    // 3. on la réactive
    fireEvent.click(screen.getByRole('switch', { name: /Réactiver EPS/ }));
    expect(screen.queryByText('Désactivée pour cet élève')).toBeNull();
    expect(screen.getByRole('switch', { name: /Désactiver EPS/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('plusieurs allers-retours de suite : toujours réactivable', () => {
    render(<Profil />);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('switch', { name: /Désactiver EPS/ }));
      expect(screen.getByRole('switch', { name: /Réactiver EPS/ })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('switch', { name: /Réactiver EPS/ }));
    }
    expect(screen.getByRole('switch', { name: /Désactiver EPS/ })).toHaveAttribute('aria-checked', 'true');
  });
});
