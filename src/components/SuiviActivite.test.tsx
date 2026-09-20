import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
let auth: { user: { id: string } | null; isPlatformAdmin: boolean } = { user: { id: 'u1' }, isPlatformAdmin: false };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { SuiviActivite } from './SuiviActivite';

describe('SuiviActivite', () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }); auth = { user: { id: 'u1' }, isPlatformAdmin: false }; });

  it('signale l\'activité une fois à l\'ouverture', () => {
    render(<MemoryRouter><SuiviActivite /></MemoryRouter>);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('record_activity');
  });

  it('pas de ping sans utilisateur connecté, ni pour le chef du système', () => {
    auth = { user: null, isPlatformAdmin: false };
    const a = render(<MemoryRouter><SuiviActivite /></MemoryRouter>);
    a.unmount();
    auth = { user: { id: 'boss' }, isPlatformAdmin: true };
    render(<MemoryRouter><SuiviActivite /></MemoryRouter>);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('un échec du serveur ne casse rien', async () => {
    rpc.mockRejectedValue(new Error('réseau'));
    expect(() => render(<MemoryRouter><SuiviActivite /></MemoryRouter>)).not.toThrow();
    await Promise.resolve();
  });
});
