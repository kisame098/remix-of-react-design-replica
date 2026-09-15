import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

/** Couleur de la marque (--primary, hsl(38 92% 50%)) : barre d'état, écran de lancement. */
const ORANGE_SENCLASS = "#F59E0B";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Autorise l'accès via un tunnel HTTPS temporaire (cloudflared) pour
    // tester le scan caméra sur téléphone — l'API caméra exige un contexte
    // sécurisé, indisponible sur une simple adresse IP locale en http://.
    allowedHosts: true,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),

    // ── Application installable et utilisable hors connexion ──────────────
    VitePWA({
      // « prompt » et non mise à jour automatique : une mise à jour imposée
      // rechargerait la page sous les doigts d'un caissier en pleine saisie
      // et lui ferait perdre son encaissement. L'application affiche un
      // bandeau « Nouvelle version » et c'est l'utilisateur qui recharge.
      registerType: "prompt",
      // Enregistrement fait par <MiseAJourApplication />, qui porte ce bandeau.
      injectRegister: false,
      includeAssets: ["favicon.ico", "favicon-32x32.png", "favicon-96x96.png", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "SenClass",
        short_name: "SenClass",
        description: "Gestion scolaire : élèves, notes, emplois du temps, présences et paiements.",
        lang: "fr",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#ffffff",
        theme_color: ORANGE_SENCLASS,
        categories: ["education", "productivity"],
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // L'application entière est gardée sur l'appareil : elle s'ouvre
        // ensuite instantanément, et même sans réseau.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,webp,woff2}"],
        // Une adresse profonde (/portail/notes, /paiements…) ouverte hors
        // connexion reçoit l'application, qui affiche la bonne page.
        navigateFallback: "/index.html",
        // Les générateurs de PDF pèsent lourd ; sans ce plafond relevé,
        // Workbox les écarterait en silence et le bulletin ne marcherait
        // plus hors connexion.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Seules les polices sont mises en cache à la volée.
        //
        // Les données Supabase ne le sont JAMAIS, volontairement : le cache
        // d'un service worker est rangé par adresse, pas par utilisateur. Sur
        // un téléphone partagé — le portail permet de basculer entre plusieurs
        // comptes — un élève pourrait voir hors connexion les réponses mises
        // en cache pour un autre. Et un montant payé affiché depuis un cache
        // périmé est pire qu'un message « hors connexion ».
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "polices-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "polices-fichiers",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Pas de service worker en développement : il servirait du code
      // périmé pendant qu'on modifie les fichiers.
      devOptions: { enabled: false },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
