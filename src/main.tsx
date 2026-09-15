import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Après un déploiement ───────────────────────────────────────────────────
// Les écrans sont chargés à la demande. Un onglet resté ouvert pendant une
// mise en ligne peut réclamer un morceau de l'ANCIENNE version, qui n'existe
// plus sur le serveur : sans rien faire, l'écran planterait. On recharge une
// fois pour récupérer la nouvelle version — une seule, jamais en boucle.
const CLE_RECHARGEMENT = "teranga.rechargement-apres-deploiement";

window.addEventListener("vite:preloadError", (evenement) => {
  try {
    if (sessionStorage.getItem(CLE_RECHARGEMENT)) return;
    sessionStorage.setItem(CLE_RECHARGEMENT, "1");
  } catch {
    return;   // stockage indisponible : mieux vaut l'erreur qu'une boucle
  }
  evenement.preventDefault();
  window.location.reload();
});

// Le verrou ne vaut que pour ce chargement : un déploiement ultérieur, dans
// la même session, doit pouvoir déclencher son propre rechargement.
setTimeout(() => {
  try { sessionStorage.removeItem(CLE_RECHARGEMENT); } catch { /* rien */ }
}, 10_000);

createRoot(document.getElementById("root")!).render(<App />);
