import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { modeDeLEcole } from '@/lib/modeGestion';
import { toast } from '@/hooks/use-toast';
import {
  avanceSeule, chapitreSuivant, etapeApresPasser, etapeApresSignal, etapeDeReprise, etapePrecedente, etapeSuivante,
  lireEtat, marquerTermine, pageOuAller, parcoursPour, rang, reunir,
  type Boite, type Chapitre, type Etape, type EtatEtape, type Progression,
} from '@/lib/guide';
import { EVENEMENT_OUVRIR, EVENEMENT_SIGNAL, type SignalGuide } from '@/lib/signauxGuide';
import { CHAPITRES } from './parcours';
import { chargerProgression, garderDansLeCompte, garderSurAppareil } from './progressionGuide';
import { BulleGuide, Projecteur } from './BulleGuide';
import { FenetreBilan, FenetreChapitres, FenetreProposition } from './FenetresGuide';

/** L'écran est relu plusieurs fois par seconde : les pages ne savent rien du guide. */
const RYTHME_MS = 200;
/** Temps laissé à une page pour s'afficher avant de dire « cet élément n'est pas là ». */
const PATIENCE_MS = 1500;
const DUREE_BRAVO_MS = 1100;

interface Ecran {
  etat: EtatEtape;
  boites: Boite[];
  /** La liste déroulante ouverte : la bulle ne doit pas la cacher. */
  liste: Boite | null;
  /** Pas de voile : une liste est ouverte par-dessus, il faut pouvoir la lire. */
  sansVoile: boolean;
  /** Une fenêtre ouverte cache l'élément à utiliser. */
  cachee: boolean;
  /** Absente depuis assez longtemps pour le dire. */
  introuvable: boolean;
}

const dialogueOuvert = (): Element | null => {
  const ouverts = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))
    .filter(d => !d.closest('[data-guide-ui]'));
  return ouverts[ouverts.length - 1] ?? null;
};

const boiteDe = (el: Element): Boite => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

const amenerAlEcran = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  if (r.top >= 70 && r.bottom <= window.innerHeight - 20) return;
  el.scrollIntoView({ block: r.height > window.innerHeight * 0.7 ? 'start' : 'center', behavior: 'smooth' });
};

export default function Guide() {
  const { user, school, accountRole, staffPermissions } = useAuth();
  const userId = user?.id ?? null;
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const mode = modeDeLEcole(school);
  const chapitres = useMemo(
    () => parcoursPour(CHAPITRES, { mode, accountRole, staffPermissions }),
    [mode, accountRole, staffPermissions],
  );

  const [progression, setProgression] = useState<Progression | null>(null);
  const [plusTard, setPlusTard] = useState(false);
  const [liste, setListe] = useState(false);
  const [bilan, setBilan] = useState<string | null>(null);
  const [reduit, setReduit] = useState(false);
  const [bravo, setBravo] = useState(false);
  const [ecran, setEcran] = useState<Ecran | null>(null);

  // Une fois par compte : le compte (tous appareils) et l'appareil, le plus récent gagne.
  const metadonnees = user?.user_metadata?.guide;
  const charge = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || charge.current === userId) return;
    charge.current = userId;
    setProgression(chargerProgression(userId, metadonnees));
  }, [userId, metadonnees]);

  const progressionRef = useRef(progression);
  progressionRef.current = progression;

  const changer = useCallback((modif: (p: Progression) => Progression, important = false) => {
    const avant = progressionRef.current;
    if (!avant || !userId) return;
    const apres = { ...modif(avant), maj: Date.now() };
    progressionRef.current = apres;
    setProgression(apres);
    garderSurAppareil(userId, apres);
    if (important) void garderDansLeCompte(apres);
  }, [userId]);

  const chapitre: Chapitre | null = chapitres.find(c => c.id === progression?.chapitre) ?? null;
  const etape: Etape | null = chapitre ? chapitre.etapes[rang(chapitre, progression?.etape)] ?? null : null;
  const enCours = !!progression?.actif && !!chapitre && !!etape && bilan === null;

  // Revenu en arrière exprès : on ne rejoue pas l'avance automatique.
  const manuel = useRef(false);
  const absentDepuis = useRef<number | null>(null);

  const allerA = useCallback((suivante: Etape | null, enArriere = false) => {
    manuel.current = enArriere;
    absentDepuis.current = null;
    setEcran(null);
    if (suivante) { changer(p => ({ ...p, etape: suivante.id })); return; }
    const id = progressionRef.current?.chapitre;
    if (!id) return;
    changer(p => ({ ...marquerTermine(p, id), etape: undefined, chapitre: undefined, actif: false }), true);
    setBilan(id);
  }, [changer]);

  const commencer = useCallback((c: Chapitre, reprendre: boolean) => {
    manuel.current = false;
    absentDepuis.current = null;
    setEcran(null); setBilan(null); setListe(false); setReduit(false);
    changer(p => ({
      ...p, choix: 'accepte', actif: true, chapitre: c.id,
      etape: reprendre && p.chapitre === c.id && p.etape ? p.etape : c.etapes[0].id,
    }), true);
  }, [changer]);

  const arreter = () => {
    changer(p => ({ ...p, actif: false }), true);
    toast({ title: 'Guide en pause', description: 'Pour le reprendre : cliquez sur votre nom en bas du menu, puis « Apprendre SenClass ».' });
  };

  // ── Demande d'ouverture (menu du compte) ──────────────────────────────────
  useEffect(() => {
    // Au tour suivant : le menu d'où vient le clic doit d'abord se refermer.
    const ouvrir = () => window.setTimeout(() => setListe(true), 0);
    window.addEventListener(EVENEMENT_OUVRIR, ouvrir);
    return () => window.removeEventListener(EVENEMENT_OUVRIR, ouvrir);
  }, []);

  // ── Un enregistrement a réussi quelque part ───────────────────────────────
  const minuteur = useRef<number>();
  useEffect(() => () => window.clearTimeout(minuteur.current), []);
  useEffect(() => {
    if (!enCours || !chapitre || !etape) return;
    const recevoir = (e: Event) => {
      const signal = (e as CustomEvent<SignalGuide>).detail;
      const suite = etapeApresSignal(chapitre, etape.id, signal);
      if (suite === undefined) return;
      setBravo(true);
      window.clearTimeout(minuteur.current);
      minuteur.current = window.setTimeout(() => { setBravo(false); allerA(suite); }, DUREE_BRAVO_MS);
    };
    window.addEventListener(EVENEMENT_SIGNAL, recevoir);
    return () => window.removeEventListener(EVENEMENT_SIGNAL, recevoir);
  }, [enCours, chapitre, etape, allerA]);

  // ── Lecture de l'écran ────────────────────────────────────────────────────
  useEffect(() => {
    if (!enCours || !chapitre || !etape || bravo) return;
    let amene = false;
    const lire = () => {
      const etat = lireEtat(etape, pathname);
      if (avanceSeule(etape) && etat.satisfaite && !manuel.current) { allerA(etapeSuivante(chapitre, etape.id)); return; }

      const dialogue = dialogueOuvert();
      const joignables = dialogue ? etat.elements.filter(el => dialogue.contains(el) || el.contains(dialogue) || el === dialogue) : etat.elements;

      if (etat.absente) {
        absentDepuis.current ??= Date.now();
        const longtemps = Date.now() - absentDepuis.current > PATIENCE_MS;
        if (longtemps && etape.siAbsent) {
          const reprise = chapitre.etapes.find(x => x.id === etape.siAbsent);
          if (reprise) { allerA(reprise); return; }
        }
      } else absentDepuis.current = null;

      if (!amene && joignables.length > 0) { amene = true; amenerAlEcran(joignables[0]); }

      const listeOuverte = document.querySelector('[data-radix-popper-content-wrapper]');
      const boites = joignables.map(boiteDe);
      const suivant: Ecran = {
        etat: { ...etat, elements: [] },
        boites,
        liste: listeOuverte ? boiteDe(listeOuverte) : null,
        sansVoile: !!listeOuverte || !!dialogue,
        cachee: !!dialogue && etat.elements.length > 0 && joignables.length === 0,
        introuvable: etat.absente && absentDepuis.current !== null && Date.now() - absentDepuis.current > PATIENCE_MS,
      };
      setEcran(avant => (JSON.stringify(avant) === JSON.stringify(suivant) ? avant : suivant));
    };
    lire();
    const horloge = window.setInterval(lire, RYTHME_MS);
    window.addEventListener('scroll', lire, true);
    window.addEventListener('resize', lire);
    return () => {
      window.clearInterval(horloge);
      window.removeEventListener('scroll', lire, true);
      window.removeEventListener('resize', lire);
    };
  }, [enCours, chapitre, etape, pathname, bravo, allerA]);

  const zone = useMemo(() => (ecran && !ecran.etat.horsPage ? reunir(ecran.liste ? [...ecran.boites, ecran.liste] : ecran.boites) : null), [ecran]);

  if (!progression || chapitres.length === 0) return null;

  const proposer = progression.choix === undefined && !plusTard && !liste && !enCours;

  const page = etape ? pageOuAller(etape) : null;
  const rejoindre = () => {
    if (page) { navigate(page); return; }
    if (!chapitre || !etape) return;
    const reprise = etapeDeReprise(chapitre, etape.id);
    if (!reprise) return;
    allerA(reprise);
    const cible = pageOuAller(reprise);
    if (cible) navigate(cible);
  };

  return (
    <>
      {proposer && (
        <FenetreProposition
          ecole={school?.name ?? ''}
          onOui={() => commencer(chapitres[0], false)}
          onNon={() => changer(p => ({ ...p, choix: 'refuse', actif: false }), true)}
          onPlusTard={() => setPlusTard(true)}
        />
      )}

      {liste && (
        <FenetreChapitres
          chapitres={chapitres} progression={progression}
          onFermer={() => setListe(false)} onChoisir={commencer}
        />
      )}

      {bilan !== null && (
        <FenetreBilan
          chapitre={chapitres.find(c => c.id === bilan) ?? null}
          suivant={chapitreSuivant(chapitres, progression.termines, bilan)}
          faits={chapitres.filter(c => progression.termines.includes(c.id)).length} total={chapitres.length}
          onContinuer={c => commencer(c, false)}
          onListe={() => { setBilan(null); setListe(true); }}
          onFermer={() => setBilan(null)}
        />
      )}

      {enCours && chapitre && etape && !liste && createPortal(
        <>
          {!reduit && !bravo && ecran && ecran.boites.length > 0 && !ecran.etat.horsPage && <Projecteur boites={ecran.boites} voile={!ecran.sansVoile} />}
          <BulleGuide
            chapitre={chapitre} etape={etape} numero={rang(chapitre, etape.id) + 1}
            etat={ecran?.etat ?? null} boite={zone}
            introuvable={ecran?.introuvable ?? false} cachee={ecran?.cachee ?? false} bravo={bravo} reduit={reduit}
            peutRejoindre={page !== null || etapeDeReprise(chapitre, etape.id) !== null}
            onContinuer={() => allerA(etapeSuivante(chapitre, etape.id))}
            onPasser={() => allerA(etapeApresPasser(chapitre, etape.id))}
            onPrecedent={etapePrecedente(chapitre, etape.id) ? () => allerA(etapePrecedente(chapitre, etape.id), true) : null}
            onRejoindre={rejoindre}
            onReduire={() => setReduit(r => !r)}
            onArreter={arreter}
          />
        </>,
        document.body,
      )}
    </>
  );
}
