import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMontantsMasques } from './useMontantsMasques';

// Masquer les montants : le choix est gardé sur l'ordinateur et vaut partout à la fois.
describe('montants masqués', () => {
  beforeEach(() => localStorage.clear());

  it('affichés par défaut ; masqués d\'un clic, et le choix reste après rechargement', () => {
    const { result } = renderHook(() => useMontantsMasques());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(renderHook(() => useMontantsMasques()).result.current[0]).toBe(true);
  });

  it('un œil masque aussi les montants affichés ailleurs', () => {
    const a = renderHook(() => useMontantsMasques());
    const b = renderHook(() => useMontantsMasques());
    act(() => a.result.current[1]());
    expect(b.result.current[0]).toBe(true);
  });
});
