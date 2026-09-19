import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { genererPaireVapid } from '../../supabase/functions/send-notifications/vapid';

// ════════════════════════════════════════════════════════════════════════════
// La fonction fabrique ses propres clés VAPID : personne ne les saisit ni ne les
// voit. Il faut donc PROUVER qu'elles sont valides — une clé mal formée serait
// refusée par tous les services de push, sans message utile.
// ════════════════════════════════════════════════════════════════════════════

// Le navigateur simulé n'a pas WebCrypto : on lui donne celui de Node, qui est
// exactement celui que la fonction trouvera sous Deno.
beforeAll(() => { vi.stubGlobal('crypto', webcrypto); });
afterAll(() => { vi.unstubAllGlobals(); });

const depuis = (t: string) => Uint8Array.from(Buffer.from(t, 'base64url'));

describe('genererPaireVapid', () => {
  it('publique : point P-256 non compressé, 65 octets commençant par 0x04', async () => {
    const { publique } = await genererPaireVapid();
    const octets = depuis(publique);
    expect(octets).toHaveLength(65);
    expect(octets[0]).toBe(4);
  });

  it('privée : scalaire de 32 octets', async () => {
    const { privee } = await genererPaireVapid();
    expect(depuis(privee)).toHaveLength(32);
  });

  it('en base64 « URL-safe » sans remplissage — le format attendu par web-push et par pushManager', async () => {
    const { publique, privee } = await genererPaireVapid();
    for (const cle of [publique, privee]) expect(cle).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('les deux moitiés vont ensemble : ce que signe la privée, la publique le vérifie', async () => {
    const { publique, privee } = await genererPaireVapid();
    const brute = depuis(publique);

    const jwkPrivee = {
      kty: 'EC', crv: 'P-256', d: privee,
      x: Buffer.from(brute.subarray(1, 33)).toString('base64url'),
      y: Buffer.from(brute.subarray(33, 65)).toString('base64url'),
    };
    const clePrivee = await crypto.subtle.importKey('jwk', jwkPrivee, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const clePublique = await crypto.subtle.importKey('raw', brute, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);

    const message = new TextEncoder().encode('en-tête.charge');
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clePrivee, message);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, clePublique, signature, message)).toBe(true);
  });

  it('deux appels donnent deux paires différentes', async () => {
    const [a, b] = await Promise.all([genererPaireVapid(), genererPaireVapid()]);
    expect(a.privee).not.toBe(b.privee);
    expect(a.publique).not.toBe(b.publique);
  });
});
