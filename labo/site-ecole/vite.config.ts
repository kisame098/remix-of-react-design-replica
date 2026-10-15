import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import configTailwindSaaS from "../../tailwind.config";

const ICI = __dirname;
const RACINE = path.resolve(ICI, "../..");

// Application autonome du labo : elle partage l'alias « @ » et le thème du
// SaaS, mais n'emprunte ni son service worker ni ses réglages de déploiement.
export default defineConfig({
  root: ICI,
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(RACINE, "src") },
  },
  css: {
    postcss: {
      plugins: [
        // Même thème que le SaaS, mais Tailwind doit aussi lire les classes
        // écrites dans le labo, sinon elles ne seraient pas générées.
        tailwindcss({
          ...configTailwindSaaS,
          content: [
            path.join(ICI, "index.html"),
            path.join(ICI, "src/**/*.{ts,tsx}"),
            path.join(RACINE, "src/components/ui/**/*.{ts,tsx}"),
          ],
        }),
        autoprefixer(),
      ],
    },
  },
  server: { port: 8090 },
});
