import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// La table `published_bulletins` stocke un INSTANTANÉ figé (colonne jsonb) :
// elle se moque de savoir si le bulletin vient du collège (devoirs +
// composition + coefficients) ou de l'élémentaire (barème de points sur 10).
// Seule contrainte : savoir à QUEL élève appartient chaque bulletin.
export interface BulletinPubliable {
  ranking: { studentId: string };
}

export interface BulletinPublishStatus {
  publishedAt: string;
  count: number;
}

/** État de publication des bulletins d'une classe/période — null si jamais publiés. */
export async function getBulletinPublishStatus(periodId: string, classId: string): Promise<BulletinPublishStatus | null> {
  const { data, error } = await supabase
    .from('published_bulletins')
    .select('published_at')
    .eq('period_id', periodId)
    .eq('class_id', classId)
    .order('published_at', { ascending: false });
  if (error || !data || data.length === 0) return null;
  return { publishedAt: data[0].published_at, count: data.length };
}

/**
 * Publie (ou republie) les bulletins d'une classe/période au portail élève —
 * un instantané figé des données au moment de la publication (comme un vrai
 * bulletin remis en main propre : une correction ultérieure des notes ne
 * change pas rétroactivement ce que l'élève a déjà reçu, il faut republier).
 */
export async function publishBulletins(
  schoolId: string, periodId: string, classId: string, dataList: BulletinPubliable[],
): Promise<void> {
  const rows = dataList.map(d => ({
    school_id: schoolId,
    period_id: periodId,
    class_id: classId,
    student_enrollment_id: d.ranking.studentId,
    data: d as unknown as Json,
    published_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('published_bulletins')
    .upsert(rows, { onConflict: 'period_id,class_id,student_enrollment_id' });
  if (error) throw error;
}

/** Retire les bulletins publiés d'une classe/période — l'élève n'y a plus accès. */
export async function unpublishBulletins(periodId: string, classId: string): Promise<void> {
  const { error } = await supabase
    .from('published_bulletins')
    .delete()
    .eq('period_id', periodId)
    .eq('class_id', classId);
  if (error) throw error;
}
