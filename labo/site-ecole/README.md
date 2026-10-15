# Laboratoire — Site web de l'école

Fonctionnalité en construction **à l'écart du SaaS** : chaque école crée son
propre site vitrine. Tant qu'elle n'est pas réussie, rien de ce dossier n'est
chargé par l'application en ligne.

## Règles d'isolement

- Tout le code vit dans `labo/site-ecole/`. Il **lit** les composants du SaaS
  (`@/components/ui/...`, styles de `src/index.css`) mais ne modifie jamais
  rien dans `src/`.
- Aucune table SQL en production pendant le labo : les données de l'école sont
  simulées (`src/ecoleEssai.ts`) et le site est gardé dans le navigateur.
- Travail sur la branche `labo/site-ecole`, jamais fusionné tant que ce n'est
  pas validé.

## Lancer

```bash
npm run labo:site
```

Ouvre l'éditeur sur http://localhost:8090. Tests : `npm run labo:site:test`.
Vérification des types : `npm run labo:site:types`.

## Décisions prises (15/10/2026)

| Question | Choix |
|---|---|
| Construction | **Blocs à empiler** : un modèle de départ, puis ajouter / ranger / remplir des blocs prêts |
| Adresse | **Sous-adresse** `<slug>.senclass.com` d'abord, **domaine propre** de l'école plus tard |
| Données du SaaS | **Infos automatiques** : nom, logo, ville, téléphone, e-mail, formations repris du SaaS, jamais ressaisis |

Écartés pour l'instant (non demandés) : préinscription en ligne, actualités,
lien vers le portail.

## Étapes

1. **Éditeur de blocs** (ce dossier) — modèle de site, blocs, aperçu
   ordinateur / téléphone, couleur et police. ← en cours
2. **Images** — envoi des photos (bannière, galerie) vers le stockage Supabase.
3. **Enregistrement** — table `school_sites` (un site par école, contenu JSON,
   brouillon / publié), RLS `school_id = get_my_school_id()` ; lecture publique
   du site publié seulement.
4. **Site public** — page servie à `<slug>.senclass.com` (sous-domaine générique
   Cloudflare → lecture du site publié par `slug`).
5. **Domaine propre** — l'école branche `ecolex.sn` (Cloudflare for SaaS /
   domaines personnalisés), vérification et certificat automatiques.
6. **Intégration au SaaS** — déplacer l'éditeur dans `src/pages/`, bouton au
   menu, interrupteur dans Paramètres.

## Contenu de l'étape 1

- `src/modele.ts` — types des blocs et opérations pures (ajouter, déplacer,
  dupliquer, supprimer, modifier). Testé dans `src/modele.test.ts`.
- `src/RenduSite.tsx` — le site tel que le visiteur le voit (sert aussi au
  futur site public).
- `src/Editeur.tsx` — l'éditeur : liste des blocs à gauche, aperçu à droite.
- `src/ecoleEssai.ts` — une école fictive qui remplace les données du SaaS.
