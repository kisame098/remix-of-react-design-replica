import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, Node, mergeAttributes, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Clapperboard, Heading2, Heading3, Highlighter, ImagePlus,
  Italic, Link2, List, ListOrdered, Loader2, Minus, Pilcrow, Quote, Redo2, Strikethrough, Underline as IconeSouligne, Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { reduireImage, useEdition } from './edition';
import { integrationDepuisUrl } from './utilitaires';

/* ─────────── Blocs propres au site : intégration, vidéo, carte d'aperçu ─────────── */

/** Vidéo ou publication intégrée (YouTube, Facebook, TikTok, Instagram). */
const Integration = Node.create({
  name: 'integration', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ src: { default: '' }, ratio: { default: '16/9' }, fournisseur: { default: '' } }),
  parseHTML: () => [{
    tag: 'div[data-integration]',
    getAttrs: el => ({
      src: (el as HTMLElement).querySelector('iframe')?.getAttribute('src') ?? '',
      ratio: (el as HTMLElement).dataset.ratio ?? '16/9',
      fournisseur: (el as HTMLElement).dataset.fournisseur ?? '',
    }),
  }],
  renderHTML: ({ node }) => ['div', {
    'data-integration': '', 'data-ratio': node.attrs.ratio, 'data-fournisseur': node.attrs.fournisseur,
    class: `integration integration-${String(node.attrs.fournisseur).toLowerCase()}`, style: `aspect-ratio:${node.attrs.ratio}`,
  }, ['iframe', {
    src: node.attrs.src, loading: 'lazy', allowfullscreen: 'true', frameborder: '0',
    allow: 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share',
  }]],
});

/** Fichier vidéo (lien direct .mp4). */
const Video = Node.create({
  name: 'video', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ src: { default: '' } }),
  parseHTML: () => [{ tag: 'video[src]' }],
  renderHTML: ({ HTMLAttributes }) => ['video', mergeAttributes(HTMLAttributes, { controls: 'true', preload: 'metadata', class: 'video' })],
});

/** Lien affiché en carte d'aperçu (image, titre, description), comme sur WhatsApp ou Facebook. */
const CarteLien = Node.create({
  name: 'carteLien', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ url: { default: '' }, titre: { default: '' }, description: { default: '' }, image: { default: '' }, site: { default: '' } }),
  parseHTML: () => [{
    tag: 'a[data-carte-lien]',
    getAttrs: el => {
      const d = (el as HTMLElement).dataset;
      return { url: el.getAttribute('href') ?? '', titre: d.titre ?? '', description: d.description ?? '', image: d.image ?? '', site: d.site ?? '' };
    },
  }],
  renderHTML: ({ node }) => {
    const a = node.attrs as Record<string, string>;
    const texte: unknown[] = ['span', { class: 'carte-lien-texte' }, ['strong', {}, a.titre || a.url]];
    if (a.description) texte.push(['span', { class: 'carte-lien-description' }, a.description]);
    texte.push(['small', {}, a.site || new URL(a.url, location.href).hostname]);
    const enfants: unknown[] = a.image ? [['img', { src: a.image, alt: '' }], texte] : [texte];
    return ['a', {
      href: a.url, target: '_blank', rel: 'noopener noreferrer', class: 'carte-lien',
      'data-carte-lien': '', 'data-titre': a.titre, 'data-description': a.description, 'data-image': a.image, 'data-site': a.site,
    }, ...enfants] as never;
  },
});

/* ─────────────────────────── Éditeur ─────────────────────────── */

export default function EditeurArticle({ valeur, onChange }: { valeur: string; onChange: (html: string) => void }) {
  const editeur = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline, TextStyle, Color, Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: 'Écrivez votre article ici… Utilisez la barre ci-dessus pour mettre en forme, ajouter des photos, des vidéos ou des liens.' }),
      Integration, Video, CarteLien,
    ],
    content: valeur,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: 'article min-h-[320px] focus:outline-none' } },
  });

  if (!editeur) return null;
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-white font-sans">
      <BarreOutils editeur={editeur} />
      <div className="px-5 md:px-8 py-6"><EditorContent editor={editeur} /></div>
    </div>
  );
}

function BarreOutils({ editeur }: { editeur: Editor }) {
  const [fenetre, setFenetre] = useState<'lien' | 'image' | 'video' | null>(null);
  const b = (actif: boolean) => `h-8 min-w-8 px-1.5 rounded-md flex items-center justify-center gap-1 text-sm [&>svg]:h-4 [&>svg]:w-4 ${actif ? 'bg-amber-100 text-amber-800' : 'hover:bg-gray-100 text-gray-700'}`;
  const ch = () => editeur.chain().focus();

  return (
    <div className="sticky top-[116px] z-30 flex flex-wrap items-center gap-0.5 border-b bg-white/95 backdrop-blur rounded-t-2xl px-2 py-1.5">
      <Bt titre="Texte normal" className={b(editeur.isActive('paragraph'))} onClick={() => ch().setParagraph().run()}><Pilcrow /></Bt>
      <Bt titre="Titre" className={b(editeur.isActive('heading', { level: 2 }))} onClick={() => ch().toggleHeading({ level: 2 }).run()}><Heading2 /></Bt>
      <Bt titre="Sous-titre" className={b(editeur.isActive('heading', { level: 3 }))} onClick={() => ch().toggleHeading({ level: 3 }).run()}><Heading3 /></Bt>
      <Sep />
      <Bt titre="Gras" className={b(editeur.isActive('bold'))} onClick={() => ch().toggleBold().run()}><Bold /></Bt>
      <Bt titre="Italique" className={b(editeur.isActive('italic'))} onClick={() => ch().toggleItalic().run()}><Italic /></Bt>
      <Bt titre="Souligné" className={b(editeur.isActive('underline'))} onClick={() => ch().toggleUnderline().run()}><IconeSouligne /></Bt>
      <Bt titre="Barré" className={b(editeur.isActive('strike'))} onClick={() => ch().toggleStrike().run()}><Strikethrough /></Bt>
      <Couleurs editeur={editeur} classe={b(false)} />
      <Sep />
      <Bt titre="Aligner à gauche" className={b(editeur.isActive({ textAlign: 'left' }))} onClick={() => ch().setTextAlign('left').run()}><AlignLeft /></Bt>
      <Bt titre="Centrer" className={b(editeur.isActive({ textAlign: 'center' }))} onClick={() => ch().setTextAlign('center').run()}><AlignCenter /></Bt>
      <Bt titre="Aligner à droite" className={b(editeur.isActive({ textAlign: 'right' }))} onClick={() => ch().setTextAlign('right').run()}><AlignRight /></Bt>
      <Bt titre="Justifier" className={b(editeur.isActive({ textAlign: 'justify' }))} onClick={() => ch().setTextAlign('justify').run()}><AlignJustify /></Bt>
      <Sep />
      <Bt titre="Liste à puces" className={b(editeur.isActive('bulletList'))} onClick={() => ch().toggleBulletList().run()}><List /></Bt>
      <Bt titre="Liste numérotée" className={b(editeur.isActive('orderedList'))} onClick={() => ch().toggleOrderedList().run()}><ListOrdered /></Bt>
      <Bt titre="Citation" className={b(editeur.isActive('blockquote'))} onClick={() => ch().toggleBlockquote().run()}><Quote /></Bt>
      <Bt titre="Ligne de séparation" className={b(false)} onClick={() => ch().setHorizontalRule().run()}><Minus /></Bt>
      <Sep />
      <Bt titre="Lien" className={`${b(editeur.isActive('link'))} !px-2`} onClick={() => setFenetre('lien')}><Link2 /><span className="text-xs font-medium">Lien</span></Bt>
      <Bt titre="Photo" className={`${b(false)} !px-2`} onClick={() => setFenetre('image')}><ImagePlus /><span className="text-xs font-medium">Photo</span></Bt>
      <Bt titre="Vidéo" className={`${b(false)} !px-2`} onClick={() => setFenetre('video')}><Clapperboard /><span className="text-xs font-medium">Vidéo</span></Bt>
      <Sep />
      <Bt titre="Annuler" className={b(false)} disabled={!editeur.can().undo()} onClick={() => ch().undo().run()}><Undo2 /></Bt>
      <Bt titre="Rétablir" className={b(false)} disabled={!editeur.can().redo()} onClick={() => ch().redo().run()}><Redo2 /></Bt>

      <FenetreLien ouvert={fenetre === 'lien'} editeur={editeur} onFermer={() => setFenetre(null)} />
      <FenetreImageArticle ouvert={fenetre === 'image'} editeur={editeur} onFermer={() => setFenetre(null)} />
      <FenetreVideo ouvert={fenetre === 'video'} editeur={editeur} onFermer={() => setFenetre(null)} />
    </div>
  );
}

function Bt({ titre, className, onClick, disabled, children }: { titre: string; className: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button type="button" title={titre} aria-label={titre} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={onClick} className={`${className} disabled:opacity-30`}>{children}</button>;
}
const Sep = () => <span className="w-px h-6 bg-gray-200 mx-1" />;

function Couleurs({ editeur, classe }: { editeur: Editor; classe: string }) {
  const { contenu } = useEdition();
  const couleurs = [contenu.identite.couleur1, contenu.identite.couleur2, '#111827', '#6B7280', '#DC2626', '#16A34A', '#2563EB', '#9333EA'];
  const surligneurs = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA'];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" title="Couleur" className={classe} onMouseDown={e => e.preventDefault()}>
          <span className="font-bold text-sm leading-none border-b-[3px] px-0.5" style={{ borderColor: editeur.getAttributes('textStyle').color ?? '#111827' }}>A</span>
          <Highlighter className="!h-3.5 !w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 font-sans space-y-3" onOpenAutoFocus={e => e.preventDefault()}>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Couleur du texte</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {couleurs.map(c => <button key={c} type="button" title={c} className="h-7 w-7 rounded-full border" style={{ background: c }} onClick={() => editeur.chain().focus().setColor(c).run()} />)}
            <input type="color" className="h-7 w-7 rounded-full cursor-pointer" title="Autre couleur" onChange={e => editeur.chain().focus().setColor(e.target.value).run()} />
            <button type="button" className="text-xs underline ml-1" onClick={() => editeur.chain().focus().unsetColor().run()}>Aucune</button>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Surligner</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {surligneurs.map(c => <button key={c} type="button" className="h-7 w-7 rounded-md border" style={{ background: c }} onClick={() => editeur.chain().focus().toggleHighlight({ color: c }).run()} />)}
            <button type="button" className="text-xs underline ml-1" onClick={() => editeur.chain().focus().unsetHighlight().run()}>Aucun</button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────── Fenêtres ─────────────────────────── */

type ModeLien = 'texte' | 'carte' | 'integre';

/**
 * Un lien peut s'afficher de trois façons, au choix de l'école : dans le
 * texte, en carte d'aperçu (image + titre), ou intégré (la vidéo / la
 * publication elle-même, quand le site le permet).
 */
function FenetreLien({ ouvert, editeur, onFermer }: { ouvert: boolean; editeur: Editor; onFermer: () => void }) {
  const [url, setUrl] = useState('');
  const [texte, setTexte] = useState('');
  const [mode, setMode] = useState<ModeLien>('texte');
  const [apercu, setApercu] = useState({ titre: '', description: '', image: '', site: '' });
  const [chargement, setChargement] = useState(false);
  const integrable = integrationDepuisUrl(url);

  useEffect(() => {
    if (!ouvert) return;
    const { from, to } = editeur.state.selection;
    setUrl(editeur.getAttributes('link').href ?? '');
    setTexte(editeur.state.doc.textBetween(from, to, ' '));
    setMode('texte');
    setApercu({ titre: '', description: '', image: '', site: '' });
  }, [ouvert, editeur]);

  const chargerApercu = async () => {
    setChargement(true);
    try {
      // Service public de lecture des aperçus (titre, image) : le navigateur ne peut pas lire une autre page lui-même.
      const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`).then(x => x.json());
      const d = r?.data ?? {};
      setApercu({ titre: d.title ?? '', description: d.description ?? '', image: d.image?.url ?? d.logo?.url ?? '', site: d.publisher ?? '' });
    } catch { /* l'école remplit l'aperçu à la main */ }
    setChargement(false);
  };

  const valider = () => {
    const u = /^(https?:|mailto:|tel:|#)/.test(url) ? url : `https://${url}`;
    const ch = editeur.chain().focus();
    if (mode === 'integre' && integrable) {
      if (integrable.type === 'video') ch.insertContent({ type: 'video', attrs: { src: integrable.src } }).run();
      else ch.insertContent({ type: 'integration', attrs: { src: integrable.src, ratio: integrable.ratio, fournisseur: integrable.fournisseur } }).run();
    } else if (mode === 'carte') {
      ch.insertContent({ type: 'carteLien', attrs: { url: u, ...apercu } }).run();
    } else if (editeur.state.selection.empty) {
      ch.insertContent({ type: 'text', text: texte || u, marks: [{ type: 'link', attrs: { href: u } }] }).run();
    } else {
      ch.extendMarkRange('link').setLink({ href: u }).run();
    }
    onFermer();
  };

  return (
    <Dialog open={ouvert} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-lg font-sans">
        <DialogHeader>
          <DialogTitle>Ajouter un lien</DialogTitle>
          <DialogDescription>Collez l'adresse, puis choisissez comment l'afficher.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Adresse</Label>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.facebook.com/… ou https://…" autoFocus />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([['texte', 'Lien simple', 'Dans le texte'], ['carte', 'Aperçu', 'Image et titre'], ['integre', 'Intégré', integrable ? `${integrable.type === 'video' ? 'Vidéo' : integrable.fournisseur} dans la page` : 'YouTube, Facebook…']] as const).map(([m, nom, aide]) => (
            <button key={m} type="button" disabled={m === 'integre' && !integrable} onClick={() => { setMode(m); if (m === 'carte' && !apercu.titre && url) chargerApercu(); }}
              className={`rounded-xl border p-3 text-left disabled:opacity-40 ${mode === m ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}>
              <span className="block text-sm font-semibold">{nom}</span>
              <span className="block text-xs text-muted-foreground">{aide}</span>
            </button>
          ))}
        </div>
        {mode === 'texte' && editeur.state.selection.empty && (
          <div className="space-y-1.5"><Label>Texte affiché</Label><Input value={texte} onChange={e => setTexte(e.target.value)} placeholder="Ex. : Voir la vidéo de la fête" /></div>
        )}
        {mode === 'carte' && (
          <div className="space-y-3">
            {chargement ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Lecture de l'aperçu…</p> : (
              <>
                <div className="flex gap-3 rounded-xl border overflow-hidden">
                  {apercu.image && <img src={apercu.image} alt="" className="w-28 object-cover" />}
                  <div className="p-3 min-w-0 text-sm">
                    <p className="font-semibold truncate">{apercu.titre || 'Titre de l\'aperçu'}</p>
                    <p className="text-muted-foreground line-clamp-2">{apercu.description}</p>
                  </div>
                </div>
                <Input value={apercu.titre} onChange={e => setApercu(a => ({ ...a, titre: e.target.value }))} placeholder="Titre" />
                <Textarea rows={2} value={apercu.description} onChange={e => setApercu(a => ({ ...a, description: e.target.value }))} placeholder="Description" />
                <Button variant="outline" size="sm" onClick={chargerApercu} disabled={!url}>Relire l'aperçu depuis le lien</Button>
              </>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          {editeur.isActive('link') && <Button variant="ghost" className="text-destructive mr-auto" onClick={() => { editeur.chain().focus().extendMarkRange('link').unsetLink().run(); onFermer(); }}>Retirer le lien</Button>}
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={valider} disabled={!url}>Insérer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FenetreImageArticle({ ouvert, editeur, onFermer }: { ouvert: boolean; editeur: Editor; onFermer: () => void }) {
  const [url, setUrl] = useState('');
  const fichier = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ouvert) setUrl(''); }, [ouvert]);
  const inserer = (src: string) => { editeur.chain().focus().setImage({ src }).run(); onFermer(); };
  return (
    <Dialog open={ouvert} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-md font-sans">
        <DialogHeader><DialogTitle>Ajouter une photo</DialogTitle></DialogHeader>
        <input ref={fichier} type="file" accept="image/*" multiple className="hidden" onChange={async e => {
          const fichiers = [...(e.target.files ?? [])]; e.target.value = '';
          for (const f of fichiers) editeur.chain().focus().setImage({ src: await reduireImage(f) }).run();
          if (fichiers.length) onFermer();
        }} />
        <Button className="gap-1.5" onClick={() => fichier.current?.click()}><ImagePlus className="h-4 w-4" />Choisir une ou plusieurs photos</Button>
        <div className="space-y-1.5"><Label>Ou adresse de l'image</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></div>
        <DialogFooter><Button variant="outline" onClick={onFermer}>Annuler</Button><Button disabled={!url} onClick={() => inserer(url.trim())}>Insérer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FenetreVideo({ ouvert, editeur, onFermer }: { ouvert: boolean; editeur: Editor; onFermer: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { if (ouvert) setUrl(''); }, [ouvert]);
  const integration = integrationDepuisUrl(url);
  const inserer = () => {
    if (!integration) return;
    if (integration.type === 'video') editeur.chain().focus().insertContent({ type: 'video', attrs: { src: integration.src } }).run();
    else editeur.chain().focus().insertContent({ type: 'integration', attrs: { src: integration.src, ratio: integration.ratio, fournisseur: integration.fournisseur } }).run();
    onFermer();
  };
  return (
    <Dialog open={ouvert} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-md font-sans">
        <DialogHeader>
          <DialogTitle>Ajouter une vidéo</DialogTitle>
          <DialogDescription>Collez le lien d'une vidéo YouTube, Facebook, TikTok ou Instagram, ou d'un fichier vidéo (.mp4).</DialogDescription>
        </DialogHeader>
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus />
        {url && <p className={`text-sm ${integration ? 'text-green-700' : 'text-destructive'}`}>{integration ? `Reconnu : ${integration.type === 'video' ? 'fichier vidéo' : integration.fournisseur}` : 'Ce lien n\'est pas une vidéo reconnue.'}</p>}
        <DialogFooter><Button variant="outline" onClick={onFermer}>Annuler</Button><Button disabled={!integration} onClick={inserer}>Insérer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
