import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ChevronRight, ClipboardList, Users, Languages } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const SubjectSettings = () => {
  const { periodId, classId, subjectId } = useParams();
  const navigate = useNavigate();
  const { 
    gradePeriods, 
    classes, 
    subjects, 
    students,
    subjectSettings,
    updateSubjectSettings,
    getSubjectSettings
  } = useSchool();

  const period = gradePeriods.find(p => p.id === Number(periodId));
  const schoolClass = classes.find(c => c.id === Number(classId));
  const subject = subjects.find(s => s.id === Number(subjectId));
  const classStudents = students.filter(s => s.classId === Number(classId));

  // Get existing settings or create defaults
  const existingSettings = getSubjectSettings(Number(subjectId), Number(periodId));
  
  // Devoirs state
  const [devoir1Active, setDevoir1Active] = useState(existingSettings?.devoir1Active ?? true);
  const [devoir2Active, setDevoir2Active] = useState(existingSettings?.devoir2Active ?? true);
  const [devoir3Active, setDevoir3Active] = useState(existingSettings?.devoir3Active ?? true);
  const [devoir4Active, setDevoir4Active] = useState(existingSettings?.devoir4Active ?? false);
  const [devoir5Active, setDevoir5Active] = useState(existingSettings?.devoir5Active ?? false);

  // LV settings
  const [lvModeActive, setLvModeActive] = useState(existingSettings?.lvModeActive ?? false);
  const [lv1Coefficient, setLv1Coefficient] = useState(existingSettings?.lv1Coefficient?.toString() ?? '');
  const [lv2Coefficient, setLv2Coefficient] = useState(existingSettings?.lv2Coefficient?.toString() ?? '');
  const [lv3Coefficient, setLv3Coefficient] = useState(existingSettings?.lv3Coefficient?.toString() ?? '');

  // Student settings - each student has: active (for this subject), custom coefficient, LV level
  const [studentSettings, setStudentSettings] = useState<Record<number, {
    active: boolean;
    customCoef: string;
    lvLevel: 'none' | 'lv1' | 'lv2' | 'lv3';
  }>>(existingSettings?.studentSettings ?? {});

  // Initialize student settings if not present
  useEffect(() => {
    const newSettings = { ...studentSettings };
    let hasChanges = false;
    
    classStudents.forEach(student => {
      if (!newSettings[student.id]) {
        newSettings[student.id] = {
          active: true,
          customCoef: '',
          lvLevel: 'none'
        };
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setStudentSettings(newSettings);
    }
  }, [classStudents]);

  if (!period || !schoolClass || !subject) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Données non trouvées</p>
        <Button variant="link" onClick={() => navigate('/notes')}>
          Retour à la gestion des notes
        </Button>
      </div>
    );
  }

  // Auto-save functionality
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const autoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      updateSubjectSettings(Number(subjectId), Number(periodId), {
        devoir1Active,
        devoir2Active,
        devoir3Active,
        devoir4Active,
        devoir5Active,
        lvModeActive,
        lv1Coefficient: lv1Coefficient ? Number(lv1Coefficient) : undefined,
        lv2Coefficient: lv2Coefficient ? Number(lv2Coefficient) : undefined,
        lv3Coefficient: lv3Coefficient ? Number(lv3Coefficient) : undefined,
        studentSettings
      });
    }, 500);
  }, [devoir1Active, devoir2Active, devoir3Active, devoir4Active, devoir5Active, lvModeActive, lv1Coefficient, lv2Coefficient, lv3Coefficient, studentSettings, subjectId, periodId, updateSubjectSettings]);

  // Trigger auto-save whenever settings change
  useEffect(() => {
    autoSave();
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [autoSave]);

  const updateStudentSetting = (studentId: number, field: 'active' | 'customCoef' | 'lvLevel', value: any) => {
    setStudentSettings(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const applyLvCoefficients = () => {
    const newSettings = { ...studentSettings };
    
    Object.keys(newSettings).forEach(studentIdStr => {
      const studentId = Number(studentIdStr);
      const setting = newSettings[studentId];
      
      if (setting.lvLevel === 'lv1' && lv1Coefficient) {
        setting.customCoef = lv1Coefficient;
      } else if (setting.lvLevel === 'lv2' && lv2Coefficient) {
        setting.customCoef = lv2Coefficient;
      } else if (setting.lvLevel === 'lv3' && lv3Coefficient) {
        setting.customCoef = lv3Coefficient;
      }
    });
    
    setStudentSettings(newSettings);
    toast({
      title: "Coefficients LV appliqués",
      description: "Les coefficients ont été appliqués à tous les élèves selon leur niveau LV."
    });
  };

  const activeStudentsCount = Object.values(studentSettings).filter(s => s.active).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/notes/${periodId}/${classId}/${subjectId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>{period.name}</span>
            <ChevronRight className="h-4 w-4" />
            <span>{schoolClass.name}</span>
            <ChevronRight className="h-4 w-4" />
            <span>{subject.name}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres de la Matière</h1>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="devoirs" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="devoirs" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Devoirs
          </TabsTrigger>
          <TabsTrigger value="eleves" className="gap-2">
            <Users className="h-4 w-4" />
            Élèves
          </TabsTrigger>
          <TabsTrigger value="lv" className="gap-2">
            <Languages className="h-4 w-4" />
            Mode LV
          </TabsTrigger>
        </TabsList>

        {/* Devoirs Tab */}
        <TabsContent value="devoirs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration des Devoirs</CardTitle>
              <CardDescription>
                Activez ou désactivez les devoirs pour cette matière. La composition est toujours active.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Devoir 1 */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Devoir 1</Label>
                    <p className="text-sm text-muted-foreground">Première évaluation</p>
                  </div>
                  <Switch checked={devoir1Active} onCheckedChange={setDevoir1Active} />
                </div>

                {/* Devoir 2 */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Devoir 2</Label>
                    <p className="text-sm text-muted-foreground">Deuxième évaluation</p>
                  </div>
                  <Switch checked={devoir2Active} onCheckedChange={setDevoir2Active} />
                </div>

                {/* Devoir 3 */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Devoir 3</Label>
                    <p className="text-sm text-muted-foreground">Troisième évaluation</p>
                  </div>
                  <Switch checked={devoir3Active} onCheckedChange={setDevoir3Active} />
                </div>

                {/* Devoir 4 (Optionnel) */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-accent/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-medium">Devoir 4</Label>
                      <Badge variant="secondary" className="text-xs">Optionnel</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Évaluation supplémentaire</p>
                  </div>
                  <Switch checked={devoir4Active} onCheckedChange={setDevoir4Active} />
                </div>

                {/* Devoir 5 (Optionnel) */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-accent/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-medium">Devoir 5</Label>
                      <Badge variant="secondary" className="text-xs">Optionnel</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Évaluation supplémentaire</p>
                  </div>
                  <Switch checked={devoir5Active} onCheckedChange={setDevoir5Active} />
                </div>

                {/* Composition (Always active) */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-primary/10 border-primary/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-medium">Composition</Label>
                      <Badge className="text-xs bg-primary text-primary-foreground">Obligatoire</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Toujours actif</p>
                  </div>
                  <Switch checked={true} disabled className="opacity-50" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Élèves Tab */}
        <TabsContent value="eleves" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Gestion des Élèves</span>
                <Badge variant="outline" className="text-sm">
                  {activeStudentsCount} / {classStudents.length} élèves actifs
                </Badge>
              </CardTitle>
              <CardDescription>
                Gérez la participation et les coefficients personnalisés pour chaque élève.
                Le coefficient par défaut est celui de la matière ({subject.coefficient}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Actif</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead className="w-32">Coefficient</TableHead>
                      {lvModeActive && <TableHead className="w-32">Niveau LV</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classStudents.map(student => {
                      const settings = studentSettings[student.id] || { active: true, customCoef: '', lvLevel: 'none' as const };
                      
                      return (
                        <TableRow key={student.id} className={!settings.active ? 'opacity-50' : ''}>
                          <TableCell>
                            <Switch
                              checked={settings.active}
                              onCheckedChange={(checked) => updateStudentSetting(student.id, 'active', checked)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{student.lastName}</TableCell>
                          <TableCell>{student.firstName}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="10"
                              step="0.5"
                              placeholder={subject.coefficient.toString()}
                              value={settings.customCoef}
                              onChange={(e) => updateStudentSetting(student.id, 'customCoef', e.target.value)}
                              className="w-24"
                              disabled={!settings.active}
                            />
                          </TableCell>
                          {lvModeActive && (
                            <TableCell>
                              <Select
                                value={settings.lvLevel}
                                onValueChange={(value) => updateStudentSetting(student.id, 'lvLevel', value)}
                                disabled={!settings.active}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover">
                                  <SelectItem value="none">—</SelectItem>
                                  <SelectItem value="lv1">LV1</SelectItem>
                                  <SelectItem value="lv2">LV2</SelectItem>
                                  <SelectItem value="lv3">LV3</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LV Mode Tab */}
        <TabsContent value="lv" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mode Langue Vivante (LV)</CardTitle>
              <CardDescription>
                Activez le mode LV pour définir des coefficients différents selon le niveau de langue de chaque élève.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* LV Mode Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Activer le Mode LV</Label>
                  <p className="text-sm text-muted-foreground">
                    Permet de classer les élèves par niveau LV1, LV2, LV3
                  </p>
                </div>
                <Switch checked={lvModeActive} onCheckedChange={setLvModeActive} />
              </div>

              {lvModeActive && (
                <>
                  {/* Coefficients by LV level */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="lv1Coef">Coefficient LV1</Label>
                      <Input
                        id="lv1Coef"
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        placeholder="Ex: 4"
                        value={lv1Coefficient}
                        onChange={(e) => setLv1Coefficient(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Coefficient pour les élèves en LV1</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lv2Coef">Coefficient LV2</Label>
                      <Input
                        id="lv2Coef"
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        placeholder="Ex: 3"
                        value={lv2Coefficient}
                        onChange={(e) => setLv2Coefficient(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Coefficient pour les élèves en LV2</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lv3Coef">Coefficient LV3</Label>
                      <Input
                        id="lv3Coef"
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        placeholder="Ex: 2"
                        value={lv3Coefficient}
                        onChange={(e) => setLv3Coefficient(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Coefficient pour les élèves en LV3</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="secondary" onClick={applyLvCoefficients}>
                      Appliquer les coefficients LV à tous les élèves
                    </Button>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/50 border border-accent-foreground/20">
                    <p className="text-sm text-accent-foreground">
                      <strong>Astuce :</strong> Définissez d'abord le niveau LV de chaque élève dans l'onglet "Élèves", 
                      puis revenez ici et cliquez sur "Appliquer les coefficients LV" pour assigner automatiquement 
                      les coefficients à tous les élèves selon leur niveau.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SubjectSettings;
