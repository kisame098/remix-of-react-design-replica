import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let school: { management_mode?: string } | null = null;
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ school }) }));

import ModeRoute from './ModeRoute';

const rendre = (chemin: string) => render(
  <MemoryRouter initialEntries={[chemin]}>
    <Routes>
      <Route path="/dashboard" element={<p>TABLEAU CLASSIQUE</p>} />
      <Route path="/formation" element={<p>ESPACE FORMATION</p>} />
      <Route path="/classes" element={<ModeRoute mode="classique"><p>PAGE CLASSES</p></ModeRoute>} />
      <Route path="/formation/x" element={<ModeRoute mode="formation_pro"><p>PAGE X</p></ModeRoute>} />
    </Routes>
  </MemoryRouter>,
);

describe('ModeRoute', () => {
  it('école classique : accède aux pages classiques, pas à celles de la formation', () => {
    school = { management_mode: 'classique' };
    rendre('/classes');
    expect(screen.getByText('PAGE CLASSES')).toBeInTheDocument();
  });
  it('école classique : /formation/x renvoie au tableau de bord', () => {
    school = {};
    rendre('/formation/x');
    expect(screen.getByText('TABLEAU CLASSIQUE')).toBeInTheDocument();
  });
  it('école en formation pro : /classes renvoie à son espace', () => {
    school = { management_mode: 'formation_pro' };
    rendre('/classes');
    expect(screen.getByText('ESPACE FORMATION')).toBeInTheDocument();
  });
  it('école en formation pro : accède à ses pages', () => {
    school = { management_mode: 'formation_pro' };
    rendre('/formation/x');
    expect(screen.getByText('PAGE X')).toBeInTheDocument();
  });
});
