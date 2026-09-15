import { defineConfig } from 'vitest/config';
import path from 'path';

// Config de test séparée de vite.config.ts : celle-ci ne charge NI le plugin
// React SWC NI lovable-tagger, inutiles pour des tests de logique et sources de
// lenteur/bruit. L'alias '@' doit en revanche rester identique à l'app.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Module virtuel généré par vite-plugin-pwa au build seulement.
      'virtual:pwa-register/react': path.resolve(__dirname, './src/test/pwaRegisterStub.ts'),
    },
  },
  test: {
    globals: true,
    // jsdom partout : plusieurs modules métier remontent (via leurs imports) au
    // client Supabase, qui touche localStorage au chargement. En environnement
    // 'node' le simple import ferait échouer le fichier de test.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      // On ne mesure que la LOGIQUE MÉTIER. Couvrir des composants de
      // présentation ou des générateurs de PDF gonflerait le chiffre sans rien
      // garantir — et un chiffre qu'on n'écoute plus ne protège personne.
      include: [
        'src/types/payment.ts',
        'src/types/schedule.ts',
        'src/lib/dueItems.ts',
        'src/lib/paymentQueries.ts',
        'src/lib/payroll.ts',
        'src/lib/teacherHours.ts',
        'src/lib/scheduleConflicts.ts',
        'src/lib/schoolYearBounds.ts',
        'src/lib/schoolYears.ts',
        'src/lib/attendanceStatus.ts',
        'src/lib/academicProfile.ts',
        'src/lib/cumulativeAverage.ts',
        'src/lib/csvExport.ts',
        'src/lib/subscription.ts',
        'src/lib/permissions.ts',
        'src/lib/bacMention.ts',
        'src/lib/accountUtils.ts',
        'src/lib/elementaryDefaults.ts',
        'src/lib/programmeCards.ts',
        'src/lib/linkedAccounts.ts',
        'src/pages/portal/portalHelpers.ts',
        'src/hooks/useClassRanking.ts',
        'src/hooks/useElementaryClassRanking.ts',
      ],
      // Seuils par fichier : le chemin de l'argent ne peut PAS perdre sa
      // couverture sans que la commande échoue. `npm run test:coverage` devient
      // un garde-fou, pas un rapport décoratif.
      thresholds: {
        'src/types/payment.ts':   { statements: 95, branches: 95, functions: 100, lines: 95 },
        'src/lib/dueItems.ts':    { statements: 85, branches: 80, functions: 75,  lines: 95 },
        'src/lib/paymentQueries.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/lib/schoolYearBounds.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/lib/payroll.ts':     { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/lib/csvExport.ts':   { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/lib/cumulativeAverage.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/lib/attendanceStatus.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/lib/academicProfile.ts': { statements: 95, branches: 90, functions: 100, lines: 95 },
        'src/lib/teacherHours.ts': { statements: 95, branches: 90, functions: 100, lines: 95 },
        'src/lib/subscription.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/lib/permissions.ts': { statements: 100, branches: 90, functions: 100, lines: 100 },
      },
    },
  },
});
