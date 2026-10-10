// ═══════════════════════════════════════════════════════════════════════════
// MODÈLES FOURNIS PAR SENCLASS
//
// Livrés avec le logiciel (pas en base) : toutes les écoles les ont, et une
// amélioration ici profite à toutes. Une école qui veut les retoucher en fait
// une COPIE, qui devient son propre modèle.
//
// Ils n'utilisent que des champs du catalogue (un test le vérifie) ; ce qui
// est propre à chaque école sans exister dans SenClass (dénomination, 2e
// téléphone…) n'y figure pas — l'école l'ajoute en clair dans sa copie.
// ═══════════════════════════════════════════════════════════════════════════

export interface ModeleParDefaut {
  /** Identifiant stable, préfixé pour ne jamais croiser un id de la base. */
  id: string;
  nom: string;
  html: string;
}

/** Feuille A4 commune : même rendu à l'écran, à l'impression et dans le PDF. */
const STYLE_PAGE = `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eee; font-family: "Times New Roman", Times, serif; color: #111; }
    .page { width: 210mm; min-height: 297mm; margin: 20px auto; padding: 12mm 16mm 15mm 16mm; background: white; position: relative; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; font-size: 14px; line-height: 1.25; }
    .school-info { width: 60%; display: flex; gap: 10px; align-items: flex-start; }
    .logo { max-width: 22mm; max-height: 22mm; }
    .school-name { font-weight: bold; font-size: 16px; }
    .school-details { margin-top: 3px; }
    .document-info { width: 35%; text-align: right; font-size: 15px; }
    .document-number { margin-top: 15px; }
    .title { margin: 24px auto 12px; width: 80%; border: 1.5px solid #222; padding: 5px 10px; text-align: center;
      font-family: Arial, sans-serif; font-size: 28px; font-style: italic; font-weight: 600; }
    .content { margin-top: 8px; font-size: 17px; line-height: 1.65; }
    .intro { text-align: center; margin-bottom: 5px; }
    .field-line { display: flex; align-items: baseline; margin: 2px 0; }
    .label { white-space: nowrap; }
    .value { flex: 1; margin-left: 8px; border-bottom: 1px dotted #555; min-height: 24px; padding-left: 4px; }
    .inline { border-bottom: 1px dotted #555; }
    .sentence { margin-top: 2px; }
    .signature { width: 38%; margin-left: auto; margin-top: 28px; text-align: center; font-size: 17px; }
    .signature-title { font-weight: bold; text-decoration: underline; margin-bottom: 38px; }
    .signature-name { font-weight: bold; }
    @media print { body { background: white; } .page { margin: 0; } }`;

const entete = (titre: string) => `
  <div class="header">
    <div class="school-info">
      <img class="logo" src="[LOGO DE L'ÉTABLISSEMENT]" alt="">
      <div>
        <div class="school-name">[NOM DE L'ÉTABLISSEMENT]</div>
        <div class="school-details">[ADRESSE DE L'ÉTABLISSEMENT]</div>
        <div class="school-details">Aut. [NUMÉRO D'AUTORISATION]</div>
        <div class="school-details">Tél. : [TÉLÉPHONE DE L'ÉTABLISSEMENT]</div>
      </div>
    </div>
    <div class="document-info">
      <div>[VILLE], le [DATE]</div>
      <div class="document-number">N° ................................</div>
    </div>
  </div>
  <div class="title">${titre}</div>`;

const signature = `
  <div class="signature">
    <div class="signature-title">LE DIRECTEUR</div>
    <div class="signature-name">[NOM DU DIRECTEUR]</div>
  </div>`;

const document = (titre: string, contenu: string) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${titre}</title>
<style>${STYLE_PAGE}
</style>
</head>
<body>
<div class="page">
${entete(titre)}
  <div class="content">
${contenu}
  </div>
${signature}
</div>
</body>
</html>
`;

const identiteEleve = `
    <div class="field-line"><span class="label">Nom et prénom :</span><span class="value">[NOM ET PRÉNOM DE L'ÉLÈVE]</span></div>
    <div class="field-line"><span class="label">Date et lieu de naissance :</span><span class="value">[DATE DE NAISSANCE] &nbsp;&nbsp; à [LIEU DE NAISSANCE]</span></div>
    <div class="field-line"><span class="label">Matricule :</span><span class="value">[MATRICULE]</span></div>`;

export const MODELES_PAR_DEFAUT: readonly ModeleParDefaut[] = [
  {
    id: 'senclass:certificat-scolarite',
    nom: 'Certificat de scolarité',
    html: document('Certificat de Scolarité', `
    <div class="intro">Le Directeur de l'établissement <strong>[NOM DE L'ÉTABLISSEMENT]</strong> certifie que l'élève :</div>
${identiteEleve}
    <div class="sentence">fréquente régulièrement mon établissement en classe de <span class="inline">[CLASSE]</span></div>
    <div class="sentence">pour l'année scolaire <span class="inline">[ANNÉE SCOLAIRE]</span>.</div>
    <div class="sentence" style="margin-top:8px;">En foi de quoi le présent certificat lui est délivré pour servir et valoir ce que de droit.</div>`),
  },
  {
    id: 'senclass:attestation-inscription',
    nom: "Attestation d'inscription",
    html: document("Attestation d'Inscription", `
    <div class="intro">Le Directeur de l'établissement <strong>[NOM DE L'ÉTABLISSEMENT]</strong> atteste que l'élève :</div>
${identiteEleve}
    <div class="sentence">est inscrit(e) dans notre établissement en classe de <span class="inline">[CLASSE]</span></div>
    <div class="sentence">pour l'année scolaire <span class="inline">[ANNÉE SCOLAIRE]</span>, depuis le <span class="inline">[DATE D'INSCRIPTION]</span>.</div>
    <div class="sentence" style="margin-top:8px;">En foi de quoi la présente attestation lui est délivrée pour servir et valoir ce que de droit.</div>`),
  },
];

export const estModeleParDefaut = (id: string): boolean => id.startsWith('senclass:');
