import { useEffect, useState } from "react";
import { Download, Monitor, Apple, Laptop, Info, KeyRound, RefreshCw, CheckCircle2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { VERSIONS, detecterOrdinateur, indicesDuNavigateur, type Ordinateur } from "@/lib/telechargement";

const ICONES: Record<Ordinateur, typeof Monitor> = { windows: Monitor, "mac-arm": Apple, "mac-intel": Laptop };

/**
 * Page publique « Télécharger SenClass » : la version à installer sur
 * l'ordinateur principal de l'école, qui fonctionne sans Internet. Les liens
 * sont fixes (dernière version publiée) et restent de vrais liens <a>.
 */
const Telecharger = () => {
  // `undefined` : détection en cours ; `null` : ordinateur non reconnu.
  const [ordinateur, setOrdinateur] = useState<Ordinateur | null | undefined>(undefined);

  useEffect(() => {
    let annule = false;
    detecterOrdinateur(indicesDuNavigateur())
      .then(o => { if (!annule) setOrdinateur(o); })
      .catch(() => { if (!annule) setOrdinateur(null); });
    return () => { annule = true; };
  }, []);

  const principale = VERSIONS.find(v => v.id === ordinateur);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* ── Titre ── */}
          <section className="text-center mb-10">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4">
              <span className="text-secondary">Télécharger </span>
              <span className="text-primary">SenClass</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              SenClass s'installe sur l'ordinateur principal de l'école. Les autres ordinateurs et les téléphones
              de l'école s'y connectent par le réseau local, sans Internet.
            </p>
          </section>

          {/* ── Bouton principal ── */}
          <section className="flex flex-col items-center mb-14" aria-live="polite">
            {ordinateur === undefined ? (
              <p className="text-sm text-muted-foreground">Recherche de la version adaptée à votre ordinateur…</p>
            ) : principale ? (
              <>
                <a
                  href={principale.lien}
                  className="inline-flex items-center gap-3 px-7 py-4 text-base md:text-lg font-semibold text-primary-foreground bg-primary rounded-lg shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-5 h-5" aria-hidden="true" />
                  Télécharger pour {principale.titre}
                </a>
                <p className="text-sm text-muted-foreground mt-3">{principale.detail} · {principale.fichier}</p>
              </>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-accent/40 px-5 py-4 max-w-xl">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-foreground">
                  SenClass s'installe sur un ordinateur Windows ou Mac. Choisissez la version de l'ordinateur de l'école ci-dessous.
                </p>
              </div>
            )}
          </section>

          {/* ── Les trois versions ── */}
          <section aria-labelledby="titre-versions" className="mb-14">
            <h2 id="titre-versions" className="text-xl md:text-2xl font-bold text-foreground mb-5 text-center">Toutes les versions</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {VERSIONS.map(v => {
                const Icone = ICONES[v.id];
                const actif = v.id === ordinateur;
                return (
                  <div
                    key={v.id}
                    className={`relative flex flex-col rounded-xl border p-5 bg-card transition-colors ${actif ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                  >
                    {actif && (
                      <span className="absolute -top-3 left-5 inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold text-primary-foreground bg-primary rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />Votre ordinateur
                      </span>
                    )}
                    <Icone className="w-8 h-8 text-primary mb-3" aria-hidden="true" />
                    <h3 className="text-lg font-semibold text-foreground">{v.titre}</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">{v.detail}</p>
                    <a
                      href={v.lien}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                        actif ? "text-primary-foreground bg-primary hover:bg-primary/90" : "text-foreground border border-border hover:bg-accent"
                      }`}
                    >
                      <Download className="w-4 h-4" aria-hidden="true" />
                      Télécharger pour {v.titre}
                    </a>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Quel Mac ? ── */}
          <section className="rounded-xl border border-border bg-card p-5 md:p-6 mb-8">
            <h2 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <Apple className="w-5 h-5 text-primary" aria-hidden="true" />Quel Mac avez-vous ?
            </h2>
            <p className="text-sm text-muted-foreground">
              Cliquez sur le menu Apple (en haut à gauche de l'écran), puis sur <strong className="text-foreground">« À propos de ce Mac »</strong>.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>« <strong className="text-foreground">Puce Apple M…</strong> » : choisissez <strong className="text-foreground">Mac puce Apple</strong>.</li>
              <li>« <strong className="text-foreground">Processeur Intel</strong> » : choisissez <strong className="text-foreground">Mac Intel</strong>.</li>
            </ul>
          </section>

          {/* ── Installer ── */}
          <section className="mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">Installer SenClass</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Le logiciel n'est pas encore signé : les avertissements ci-dessous sont normaux.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Monitor className="w-5 h-5 text-primary" aria-hidden="true" />Windows</h3>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>Ouvrez <code className="text-foreground">SenClass-Windows.exe</code>.</li>
                  <li>
                    Si Windows affiche « Windows a protégé votre ordinateur », cliquez sur{" "}
                    <strong className="text-foreground">« Informations complémentaires »</strong>, puis{" "}
                    <strong className="text-foreground">« Exécuter quand même »</strong>.
                  </li>
                  <li>Suivez l'installation.</li>
                  <li>
                    Si Windows demande l'accès au réseau, cliquez sur <strong className="text-foreground">« Autoriser »</strong> :
                    les autres postes de l'école en ont besoin.
                  </li>
                </ol>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Apple className="w-5 h-5 text-primary" aria-hidden="true" />Mac</h3>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>Ouvrez le fichier <code className="text-foreground">.dmg</code>.</li>
                  <li>Glissez SenClass dans le dossier <strong className="text-foreground">Applications</strong>, puis ouvrez-le.</li>
                  <li>
                    Si le Mac refuse de l'ouvrir : <strong className="text-foreground">Réglages Système → Confidentialité et sécurité</strong>,
                    en bas de la page → <strong className="text-foreground">« Ouvrir quand même »</strong>.
                  </li>
                </ol>
              </div>
            </div>
          </section>

          {/* ── Activation et mises à jour ── */}
          <section className="rounded-xl border border-primary/30 bg-accent/40 p-5 md:p-6">
            <div className="flex items-start gap-3 mb-3">
              <KeyRound className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-foreground">
                Au premier lancement, SenClass affiche un <strong>identifiant d'installation</strong>.
                Envoyez-le à SenClass pour recevoir votre <strong>clé d'activation</strong>.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-foreground">
                Les mises à jour se font ensuite depuis le logiciel, avec le bouton <strong>« Mettre à jour »</strong>.
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Telecharger;
