import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FiletGuide } from './FiletGuide';

it('un incident du guide n\'emporte pas l\'écran', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const Casse = () => { throw new Error('incident'); };
  render(<><p>Caisse ouverte</p><FiletGuide><Casse /></FiletGuide></>);
  expect(screen.getByText('Caisse ouverte')).toBeInTheDocument();
});
