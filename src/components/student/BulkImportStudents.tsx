import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { parseImportedDate, parseImportedSex } from '@/lib/csvExport';
import { useSchool, Tutor } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// ─── Modèle CSV ─────────────────────────────────────────────────────────────
const CSV_HEADERS = [
  'Prenom', 'Nom', 'DateNaissance', 'LieuNaissance', 'Sexe', 'Residence',
  'Telephone', 'Email', 'Classe', 'TuteurNom', 'TuteurTelephone', 'TuteurStatut', 'TuteurEmail',
];

const EXAMPLE_ROW = [
  'Fatou', 'Diop', '15/03/2015', 'Dakar', 'F', 'Parcelles Assainies',
  '771234567', '', '6eme A', 'Mariam Diop', '781234567', 'Mere', '',
];

const TUTOR_STATUS_MAP: Record<string, string> = {
  pere: 'pere', père: 'pere', papa: 'pere',
  mere: 'mere', mère: 'mere', maman: 'mere',
  oncle: 'oncle', tante: 'tante', autre: 'autre',
};

const downloadTemplate = () => {
  const csv = Papa.unparse([CSV_HEADERS, EXAMPLE_ROW]);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele_import_eleves.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Parsing / validation d'une ligne ───────────────────────────────────────
// Les deux lecteurs de colonnes vivent dans src/lib/csvExport.ts, testés par
// csvExport.test.ts (une date mal lue à l'import fausse l'âge de l'élève).
const parseDate = parseImportedDate;
const parseSex = parseImportedSex;

interface StudentDraft {
  firstName: string; lastName: string; dateOfBirth: string; placeOfBirth: string;
  sex: 'homme' | 'femme'; residence: string; phone?: string; email?: string;
  classId: string; className: string;
  tutor1: Tutor; tutor2?: Tutor;
}

interface ParsedRow {
  rowNumber: number;
  errors: string[];
  data?: StudentDraft;
  displayName: string;
}

interface ImportResult {
  rowNumber: number;
  status: 'ok' | 'error' | 'skipped';
  message: string;
}

const BulkImportStudents = () => {
  const { classes, addStudent, getStudentCountByClass } = useSchool();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open,      setOpen]      = useState(false);
  const [rows,      setRows]      = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress,  setProgress]  = useState<{ done: number; total: number } | null>(null);
  const [results,   setResults]   = useState<ImportResult[] | null>(null);

  const reset = () => {
    setRows([]);
    setResults(null);
    setProgress(null);
  };

  // ── Parsing du fichier CSV ──────────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    reset();

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
      complete: (result) => {
        const parsed: ParsedRow[] = result.data.map((raw, i) => {
          const rowNumber = i + 2; // +1 pour l'en-tête, +1 pour index 0-based
          const errors: string[] = [];

          const firstName = (raw.Prenom ?? '').trim();
          const lastName  = (raw.Nom ?? '').trim();
          if (!firstName) errors.push('Prénom manquant');
          if (!lastName)  errors.push('Nom manquant');

          const dateOfBirth = parseDate(raw.DateNaissance ?? '');
          if (!dateOfBirth) errors.push('Date de naissance invalide (attendu JJ/MM/AAAA)');

          const placeOfBirth = (raw.LieuNaissance ?? '').trim();
          if (!placeOfBirth) errors.push('Lieu de naissance manquant');

          const sex = parseSex(raw.Sexe ?? '');
          if (!sex) errors.push('Sexe invalide (attendu M ou F)');

          const residence = (raw.Residence ?? '').trim();
          if (!residence) errors.push('Résidence manquante');

          const className = (raw.Classe ?? '').trim();
          const cls = classes.find(c => c.name.toLowerCase() === className.toLowerCase());
          if (!className) errors.push('Classe manquante');
          else if (!cls) errors.push(`Classe "${className}" introuvable`);

          const tutor1Phone = (raw.TuteurTelephone ?? '').trim();
          if (!tutor1Phone) errors.push('Téléphone du tuteur manquant');

          const tutor1StatusRaw = (raw.TuteurStatut ?? '').trim().toLowerCase();
          const tutor1Status = TUTOR_STATUS_MAP[tutor1StatusRaw];
          if (!tutor1Status) errors.push('Statut du tuteur invalide (Père/Mère/Oncle/Tante/Autre)');

          const displayName = `${firstName || '?'} ${lastName || '?'}`.trim();

          if (errors.length > 0 || !cls) {
            return { rowNumber, errors, displayName };
          }

          return {
            rowNumber,
            errors: [],
            displayName,
            data: {
              firstName, lastName,
              dateOfBirth: dateOfBirth!,
              placeOfBirth,
              sex: sex!,
              residence,
              phone: (raw.Telephone ?? '').trim() || undefined,
              email: (raw.Email ?? '').trim() || undefined,
              classId: cls.id,
              className: cls.name,
              tutor1: {
                fullName: (raw.TuteurNom ?? '').trim() || undefined,
                phone:    tutor1Phone,
                status:   tutor1Status,
                email:    (raw.TuteurEmail ?? '').trim() || undefined,
              },
            },
          };
        });

        setRows(parsed);
        if (parsed.length === 0) {
          toast({ title: 'Fichier vide', description: 'Aucune ligne trouvée dans le fichier.', variant: 'destructive' });
        }
      },
      error: () => {
        toast({ title: 'Erreur de lecture', description: 'Impossible de lire ce fichier CSV.', variant: 'destructive' });
      },
    });
  };

  const validRows   = rows.filter(r => r.data);
  const invalidRows = rows.filter(r => !r.data);

  // ── Import effectif (séquentiel, avec respect des places disponibles) ──────
  const runImport = async () => {
    setImporting(true);
    setResults([]);
    const total = validRows.length;
    setProgress({ done: 0, total });

    // Compteur local de places prises par classe pendant cet import
    // (le state du contexte ne se met à jour qu'après chaque insertion).
    const takenByClass = new Map<string, number>();
    const out: ImportResult[] = [];

    for (const row of validRows) {
      const d = row.data!;
      const limit    = classes.find(c => c.id === d.classId)?.studentLimit ?? Infinity;
      const already  = getStudentCountByClass(d.classId) + (takenByClass.get(d.classId) ?? 0);

      if (already >= limit) {
        out.push({ rowNumber: row.rowNumber, status: 'skipped', message: `Classe "${d.className}" pleine` });
      } else {
        try {
          await addStudent({
            firstName: d.firstName, lastName: d.lastName, dateOfBirth: d.dateOfBirth,
            placeOfBirth: d.placeOfBirth, sex: d.sex, residence: d.residence,
            phone: d.phone, email: d.email, classId: d.classId,
            tutor1: d.tutor1, tutor2: d.tutor2,
          });
          takenByClass.set(d.classId, (takenByClass.get(d.classId) ?? 0) + 1);
          out.push({ rowNumber: row.rowNumber, status: 'ok', message: `${d.firstName} ${d.lastName} inscrit(e)` });
        } catch (err) {
          out.push({ rowNumber: row.rowNumber, status: 'error', message: String(err instanceof Error ? err.message : err) });
        }
      }
      setResults([...out]);
      setProgress({ done: out.length, total });
    }

    setImporting(false);
    const ok = out.filter(r => r.status === 'ok').length;
    toast({
      title: ok === total ? `${ok} élève(s) importé(s) !` : `Import terminé : ${ok}/${total} réussi(s)`,
      description: ok < total ? 'Voir le détail des lignes en erreur ci-dessous.' : undefined,
      variant: ok === total ? 'default' : 'destructive',
    });
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="w-4 h-4" />
        Import en masse
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Import en masse des élèves (CSV)
            </DialogTitle>
            <DialogDescription>
              Téléchargez le modèle, remplissez-le (une ligne par élève), puis importez-le.
              La colonne <strong>Classe</strong> doit correspondre exactement au nom d'une classe déjà créée.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
              <Download className="w-3.5 h-3.5" />
              Télécharger le modèle
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" />
              Choisir un fichier CSV
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </div>

          {rows.length > 0 && !results && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Badge className="gap-1 bg-green-500 hover:bg-green-500">
                  <CheckCircle2 className="w-3 h-3" /> {validRows.length} valide{validRows.length !== 1 ? 's' : ''}
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="w-3 h-3" /> {invalidRows.length} en erreur
                  </Badge>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-14">Ligne</TableHead>
                        <TableHead>Élève</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(r => (
                        <TableRow key={r.rowNumber}>
                          <TableCell className="text-muted-foreground text-xs">{r.rowNumber}</TableCell>
                          <TableCell className="text-sm">{r.displayName}</TableCell>
                          <TableCell>
                            {r.data ? (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Prêt à importer ({r.data.className})
                              </span>
                            ) : (
                              <span className="text-xs text-destructive">{r.errors.join(', ')}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                disabled={validRows.length === 0 || importing}
                onClick={runImport}
              >
                {importing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />}
                Importer {validRows.length} élève{validRows.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}

          {progress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{importing ? 'Import en cours…' : 'Import terminé'}</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-14">Ligne</TableHead>
                      <TableHead>Résultat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map(r => (
                      <TableRow key={r.rowNumber}>
                        <TableCell className="text-muted-foreground text-xs">{r.rowNumber}</TableCell>
                        <TableCell className={
                          r.status === 'ok' ? 'text-xs text-green-600'
                          : r.status === 'skipped' ? 'text-xs text-amber-600'
                          : 'text-xs text-destructive'
                        }>
                          {r.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BulkImportStudents;
