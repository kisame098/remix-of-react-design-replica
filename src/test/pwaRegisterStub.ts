// Remplace, pendant les tests, le module virtuel `virtual:pwa-register/react`
// que vite-plugin-pwa ne génère qu'au build. Les tests qui ont besoin de
// piloter la mise à jour le simulent avec vi.mock.
import { useState } from 'react';

export const useRegisterSW = () => ({
  needRefresh: useState(false),
  offlineReady: useState(false),
  updateServiceWorker: async () => {},
});
