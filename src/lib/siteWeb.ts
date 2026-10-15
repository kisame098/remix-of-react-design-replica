import { supabase } from '@/integrations/supabase/client';
import type { School } from '@/lib/supabase';
import { CONTENU_DEFAUT, MODELES_SITE, type Contenu, type ModeleSite } from '@/siteEcole/contenu';
import { contenuDepuis } from '@/siteEcole/edition';
import { ecrire } from '@/siteEcole/chemin';

// ═══════════════════════════════════════════════════════════════════════════
// SITE WEB DE L'ÉCOLE (bêta)
//
// Ouvert aux seules écoles que le chef du système a déclarées « bêta-testeuses »
// (schools.beta_testeur). Le directeur modifie un BROUILLON enregistré au fil de
// l'eau ; « Publier » le copie en version publique, lisible par tous à
// /site/<slug>. Voir docs/sql/site_web_beta.sql.
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export const BUCKET_SITES = 'sites-ecoles';

/** La rubrique « Site web » n'existe que pour le directeur d'une école bêta (règle dans lib/modeGestion, chargée par le menu). */
export { accesSiteWeb } from '@/lib/modeGestion';

export interface SiteEnregistre {
  brouillon: unknown;
  publie_le: string | null;
}

/**
 * Le site de départ d'une école qui ouvre l'éditeur pour la première fois :
 * le modèle qu'elle a choisi (Campus par défaut), avec ses couleurs, et tout ce que SenClass sait déjà de
 * l'école à la place des exemples — nom, logo, téléphone, e-mail, ville.
 */
export function siteDeDepart(school: Pick<School, 'name' | 'logo_url' | 'phone' | 'email' | 'city' | 'country'>, modele: ModeleSite = 'campus'): Contenu {
  const [c1, c2] = MODELES_SITE[modele].couleurs;
  let c: Contenu = ecrire(CONTENU_DEFAUT, 'identite.modele', modele);
  c = ecrire(c, 'identite.couleur1', c1);
  c = ecrire(c, 'identite.couleur2', c2);
  if (school.name) {
    c = ecrire(c, 'identite.nom', school.name);
    // Le grand mot de l'ouverture : le dernier mot du nom (« EXCELLENCE » pour « Groupe Scolaire Excellence »).
    const mots = school.name.trim().split(/\s+/);
    c = ecrire(c, 'campus.motGeant', (mots[mots.length - 1] ?? '').toUpperCase());
    c = ecrire(c, 'accueil.diapos.0.surtitre', `Bienvenue au ${school.name}`);
  }
  if (school.logo_url) c = ecrire(c, 'identite.logo', school.logo_url);
  if (school.phone) {
    c = ecrire(c, 'identite.telephone', school.phone);
    c = ecrire(c, 'identite.whatsapp', school.phone);
  }
  if (school.email) c = ecrire(c, 'identite.email', school.email);
  const lieu = [school.city, school.country].filter(Boolean).join(', ');
  if (lieu) c = ecrire(c, 'identite.adresse', lieu);
  return c;
}

/** Ce que montre la page « Site web » : le travail en cours, la version en ligne (null = hors ligne) et sa date. */
export interface EtatSite {
  brouillon: unknown;
  publie: unknown;
  publie_le: string | null;
}

export async function etatDuSite(schoolId: string): Promise<EtatSite | null> {
  const { data, error } = await sb.from('school_sites').select('brouillon, publie, publie_le').eq('school_id', schoolId).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Des modifications attendent d'être mises en ligne. Les deux versions sortent
 * du même type de colonne (jsonb, clés toujours rangées pareil) : le texte suffit à les comparer.
 */
export const modificationsNonPubliees = (site: EtatSite): boolean =>
  site.publie != null && JSON.stringify(site.brouillon) !== JSON.stringify(site.publie);

export async function chargerSite(schoolId: string): Promise<SiteEnregistre | null> {
  const { data, error } = await sb.from('school_sites').select('brouillon, publie_le').eq('school_id', schoolId).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Enregistre le brouillon. Pas d'« upsert » : il réécrirait aussi school_id,
 * que le directeur n'a volontairement pas le droit de modifier.
 */
export async function enregistrerBrouillon(schoolId: string, contenu: Contenu, existe: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const ligne = { brouillon: contenu, updated_at: new Date().toISOString(), updated_by: user?.id ?? null };
  const { error } = existe
    ? await sb.from('school_sites').update(ligne).eq('school_id', schoolId)
    : await sb.from('school_sites').insert({ school_id: schoolId, ...ligne });
  if (error) throw error;
}

/**
 * Publie le brouillon à l'adresse choisie (ou à l'adresse actuelle, ou à une
 * adresse tirée du nom si l'école n'en a pas) ; rend l'adresse retenue.
 */
export async function publierSite(adresse?: string): Promise<string> {
  const { data, error } = await sb.rpc('site_publier', adresse ? { p_slug: adresse } : {});
  if (error) throw error;
  return data as string;
}

export type EtatAdresse = 'libre' | 'actuelle' | 'prise' | 'reservee' | 'format';

/** Vérifie auprès du serveur si l'adresse est libre pour cette école. */
export async function verifierAdresse(adresse: string): Promise<EtatAdresse> {
  const { data, error } = await sb.rpc('site_verifier_adresse', { p_slug: adresse });
  if (error) throw error;
  return data as EtatAdresse;
}

export async function depublierSite(): Promise<void> {
  const { error } = await sb.rpc('site_depublier');
  if (error) throw error;
}

/** Le site publié d'une école (lecture ouverte à tous), ou null. */
export async function sitePublic(slug: string): Promise<Contenu | null> {
  const { data, error } = await sb.rpc('site_public', { p_slug: slug });
  if (error) throw error;
  return data ? contenuDepuis(data) : null;
}

/** Le slug déjà attribué à l'école (null tant qu'elle n'a jamais publié). */
export async function slugDeLEcole(schoolId: string): Promise<string | null> {
  const { data } = await sb.from('schools').select('slug').eq('id', schoolId).maybeSingle();
  return data?.slug ?? null;
}

/** Réduit une photo (1 600 px au plus) avant de l'envoyer : un site doit rester rapide sur un téléphone. */
export function compresserPhoto(f: File, cote = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const echelle = Math.min(1, cote / Math.max(img.width, img.height));
      const toile = document.createElement('canvas');
      toile.width = Math.round(img.width * echelle);
      toile.height = Math.round(img.height * echelle);
      toile.getContext('2d')!.drawImage(img, 0, 0, toile.width, toile.height);
      const type = f.type === 'image/png' ? 'image/png' : 'image/jpeg';
      toile.toBlob(b => (b ? resolve(b) : reject(new Error('Photo illisible'))), type, 0.84);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Photo illisible')); };
    img.src = url;
  });
}

/** Envoie une photo dans le dossier de l'école et rend son adresse publique. */
export async function televerserPhoto(schoolId: string, f: File): Promise<string> {
  const blob = await compresserPhoto(f);
  const extension = blob.type === 'image/png' ? 'png' : 'jpg';
  const chemin = `${schoolId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await sb.storage.from(BUCKET_SITES).upload(chemin, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return sb.storage.from(BUCKET_SITES).getPublicUrl(chemin).data.publicUrl as string;
}
