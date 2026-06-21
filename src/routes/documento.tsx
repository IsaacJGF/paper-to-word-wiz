import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Loader2, GripVertical, X, Download, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AppLayout } from "@/components/AppLayout";
import { generateDocx } from "@/lib/docx.functions";
import { RichText } from "@/components/RichText";
import { fetchDocumentQuestions, type DocumentQuestion } from "@/lib/question-compat";
import { loadSelectedQuestionIds, saveSelectedQuestionIds } from "@/lib/selection-store";
import { toast } from "sonner";

export const Route = createFileRoute("/documento")({
  head: () => ({ meta: [{ title: "Criar documento" }] }),
  component: Page,
});

const REFERENCE_GROUP_COLORS = [
  {
    bar: "bg-sky-500",
    border: "border-sky-300",
    banner: "border-sky-300 bg-sky-50 text-sky-800",
    badge: "bg-sky-100 text-sky-800",
  },
  {
    bar: "bg-emerald-500",
    border: "border-emerald-300",
    banner: "border-emerald-300 bg-emerald-50 text-emerald-800",
    badge: "bg-emerald-100 text-emerald-800",
  },
  {
    bar: "bg-amber-500",
    border: "border-amber-300",
    banner: "border-amber-300 bg-amber-50 text-amber-800",
    badge: "bg-amber-100 text-amber-800",
  },
  {
    bar: "bg-rose-500",
    border: "border-rose-300",
    banner: "border-rose-300 bg-rose-50 text-rose-800",
    badge: "bg-rose-100 text-rose-800",
  },
  {
    bar: "bg-violet-500",
    border: "border-violet-300",
    banner: "border-violet-300 bg-violet-50 text-violet-800",
    badge: "bg-violet-100 text-violet-800",
  },
  {
    bar: "bg-cyan-500",
    border: "border-cyan-300",
    banner: "border-cyan-300 bg-cyan-50 text-cyan-800",
    badge: "bg-cyan-100 text-cyan-800",
  },
] as const;

type ReferenceGroupColor = typeof REFERENCE_GROUP_COLORS[number];
type ReferenceGroupVisual = {
  label: string;
  color: ReferenceGroupColor;
  totalItems: number;
  blockCount: number;
};

function Page() {
  const [questions, setQuestions] = useState<DocumentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [config, setConfig] = useState({
    titulo: "Avaliação",
    instituicao: "",
    disciplina: "",
    professor: "",
    turma: "",
    data: new Date().toLocaleDateString("pt-BR"),
    instrucoes: "Leia com atenção todas as questões. Marque uma única alternativa por questão.",
    fontSize: 12,
    incluirGabarito: false,
    gabaritoSeparado: false,
    espacamentoQuestoes: 240,
  });

  useEffect(() => {
    (async () => {
      const ids = loadSelectedQuestionIds();
      if (ids.length === 0) { setLoading(false); return; }
      try {
        const data = await fetchDocumentQuestions(ids);
        // preserve order from saved selection
        const map = new Map(data.map((d) => [d.id, d]));
        const ordered = ids.map((i) => map.get(i)).filter((x): x is DocumentQuestion => !!x);
        setQuestions(ordered);
        saveSelectedQuestionIds(ordered.map((x) => x.id));
      } catch (e) {
        console.error(e);
        toast.error("Falha ao carregar as questões selecionadas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const referenceGroupVisuals = useMemo(() => buildReferenceGroupVisuals(questions), [questions]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestions(next);
    saveSelectedQuestionIds(next.map((x) => x.id));
  };
  const remove = (id: string) => {
    const next = questions.filter((q) => q.id !== id);
    setQuestions(next);
    saveSelectedQuestionIds(next.map((x) => x.id));
  };

  const onGenerate = async () => {
    if (questions.length === 0) { toast.error("Selecione ao menos uma questão."); return; }
    if (config.incluirGabarito) {
      const semResp = questions.filter((q) => !q.resposta).length;
      if (semResp > 0 && !confirm(`${semResp} questão(ões) não têm resposta cadastrada. Gerar gabarito assim mesmo?`)) return;
    }
    setGenerating(true);
    try {
      const result = await generateDocx({ data: { questions, config } });
      downloadDocx(result.docxBase64, `${config.titulo || "documento"}.docx`);
      if (result.gabaritoBase64) downloadDocx(result.gabaritoBase64, `${config.titulo || "documento"}-gabarito.docx`);
      toast.success("Documento gerado!");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar o documento.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></div></AppLayout>;

  if (questions.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <FileText className="size-12 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-bold">Nenhuma questão selecionada</h1>
          <p className="text-muted-foreground mt-1">Vá para "Questões salvas" e marque as questões que quer incluir no documento.</p>
          <Button asChild className="mt-4"><Link to="/questoes">Ver questões salvas</Link></Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/questoes"><ArrowLeft className="size-4" /> Voltar</Link></Button>
            <h1 className="text-2xl font-bold">Criar documento</h1>
          </div>
          <Button onClick={onGenerate} disabled={generating} className="gap-2" size="lg">
            {generating ? <><Loader2 className="size-4 animate-spin" /> Gerando…</> : <><Download className="size-4" /> Gerar Word (.docx)</>}
          </Button>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div className="space-y-3">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="font-semibold mb-2">Questões ({questions.length})</h2>
              <p className="text-xs text-muted-foreground mb-3">Use as setas para reorganizar a ordem. Itens consecutivos da mesma referência serão agrupados no Word.</p>
              <div className="space-y-2">
                {questions.map((q, i) => {
                  const referenceKey = getDocumentReferenceKey(q);
                  const previousReferenceKey = i > 0 ? getDocumentReferenceKey(questions[i - 1]) : null;
                  const nextReferenceKey = i + 1 < questions.length ? getDocumentReferenceKey(questions[i + 1]) : null;
                  const startsReferenceBlock = Boolean(referenceKey && referenceKey !== previousReferenceKey);
                  const endsReferenceBlock = Boolean(referenceKey && referenceKey !== nextReferenceKey);
                  const referenceBlockSize = referenceKey ? countReferenceBlockSize(questions, i) : 0;
                  const groupVisual = referenceKey ? referenceGroupVisuals.get(referenceKey) : undefined;
                  const showGroupVisual = Boolean(groupVisual && groupVisual.totalItems > 1);
                  const splitGroup = Boolean(groupVisual && groupVisual.blockCount > 1);
                  const groupTitle = groupVisual
                    ? `${groupVisual.label}: este item pertence à mesma referência de ${groupVisual.totalItems} itens.${splitGroup ? " A referência aparece em blocos separados nesta ordem." : " Itens juntos usarão a referência uma única vez no Word."}`
                    : undefined;
                  return (
                    <div key={q.id} className="space-y-2">
                      {startsReferenceBlock && groupVisual && (
                        <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${showGroupVisual ? groupVisual.color.banner : "border-primary/30 bg-primary/5 text-primary"}`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-2">
                              {showGroupVisual && <span className={`size-2.5 rounded-full ${groupVisual.color.bar}`} />}
                              {showGroupVisual ? groupVisual.label : "Referência"}: {referenceBlockSize} item{referenceBlockSize === 1 ? "" : "s"} neste bloco
                            </span>
                            {splitGroup && <span className="inline-flex items-center gap-1"><Link2 className="size-3" /> também aparece em outro bloco</span>}
                          </div>
                        </div>
                      )}
                      <div
                        className={`relative flex gap-2 items-start overflow-hidden rounded-lg border bg-background p-3 ${showGroupVisual && groupVisual ? groupVisual.color.border : referenceKey ? "border-primary/30" : ""}`}
                        title={groupTitle}
                      >
                        {showGroupVisual && groupVisual && (
                          <div className="absolute inset-y-0 left-0 flex w-4 justify-center">
                            <div className={`w-1.5 ${groupVisual.color.bar} ${startsReferenceBlock ? "rounded-t-full" : ""} ${endsReferenceBlock ? "rounded-b-full" : ""}`} />
                          </div>
                        )}
                        <div className={`flex flex-col ${showGroupVisual ? "ml-3" : ""}`}>
                          <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs px-1 disabled:opacity-30">▲</button>
                          <GripVertical className="size-4 text-muted-foreground" />
                          <button onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="text-xs px-1 disabled:opacity-30">▼</button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-sm">Questão {i + 1}.</span>
                            {q.fonte && <span className="text-xs text-muted-foreground italic">({q.fonte})</span>}
                            {showGroupVisual && groupVisual ? (
                              <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${groupVisual.color.badge}`}>
                                <Link2 className="size-3" /> {groupVisual.label}{splitGroup ? " separado" : ""}
                              </span>
                            ) : referenceKey ? (
                              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                com referência
                              </span>
                            ) : null}
                            {referenceKey && (
                              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                {referenceBlockSize > 1 ? `bloco de ${referenceBlockSize}` : "bloco único"}
                              </span>
                            )}
                          </div>
                          <div className="text-sm line-clamp-2 [&_p]:m-0 [&_p]:inline">
                            <RichText text={q.enunciado} />
                          </div>
                          {q.alternativas.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{q.alternativas.length} alternativas{q.resposta ? ` · gabarito: ${q.resposta}` : ""}</p>
                          )}
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => remove(q.id)}><X className="size-4" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="rounded-xl border bg-card p-4 space-y-3 h-fit lg:sticky lg:top-20">
            <h2 className="font-semibold">Configuração</h2>
            <div><Label>Título</Label><Input value={config.titulo} onChange={(e) => setConfig({ ...config, titulo: e.target.value })} /></div>
            <div><Label>Instituição</Label><Input value={config.instituicao} onChange={(e) => setConfig({ ...config, instituicao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Disciplina</Label><Input value={config.disciplina} onChange={(e) => setConfig({ ...config, disciplina: e.target.value })} /></div>
              <div><Label>Professor</Label><Input value={config.professor} onChange={(e) => setConfig({ ...config, professor: e.target.value })} /></div>
              <div><Label>Turma</Label><Input value={config.turma} onChange={(e) => setConfig({ ...config, turma: e.target.value })} /></div>
              <div><Label>Data</Label><Input value={config.data} onChange={(e) => setConfig({ ...config, data: e.target.value })} /></div>
            </div>
            <div><Label>Instruções</Label><Textarea rows={3} value={config.instrucoes} onChange={(e) => setConfig({ ...config, instrucoes: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Fonte (pt)</Label>
                <Input type="number" min={9} max={18} value={config.fontSize} onChange={(e) => setConfig({ ...config, fontSize: +e.target.value || 12 })} />
              </div>
              <div>
                <Label>Espaço entre questões</Label>
                <Input type="number" min={120} max={600} step={40} value={config.espacamentoQuestoes} onChange={(e) => setConfig({ ...config, espacamentoQuestoes: +e.target.value || 240 })} />
              </div>
            </div>
            <div className="space-y-2 border-t pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={config.incluirGabarito} onCheckedChange={(v) => setConfig({ ...config, incluirGabarito: !!v })} />
                <span className="text-sm">Incluir gabarito</span>
              </label>
              {config.incluirGabarito && (
                <label className="flex items-center gap-2 cursor-pointer pl-6">
                  <Checkbox checked={config.gabaritoSeparado} onCheckedChange={(v) => setConfig({ ...config, gabaritoSeparado: !!v })} />
                  <span className="text-sm">Em arquivo separado</span>
                </label>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function downloadDocx(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type DocumentReferenceLike = Pick<DocumentQuestion,
  "grupo_id" |
  "referencia_texto" |
  "referencia_texto_apos" |
  "referencia_fonte" |
  "referencia_imagem" |
  "referencia_imagem_layout"
>;

function hasDocumentReference(question: DocumentReferenceLike) {
  return Boolean(
    question.referencia_texto?.trim() ||
    question.referencia_texto_apos?.trim() ||
    question.referencia_imagem,
  );
}

function getDocumentReferenceKey(question: DocumentReferenceLike) {
  if (!hasDocumentReference(question)) return null;
  const groupId = question.grupo_id?.trim();
  if (groupId) return `grupo:${groupId}`;
  return `ref:${documentReferenceFingerprint(question)}`;
}

function documentReferenceFingerprint(question: DocumentReferenceLike) {
  const image = question.referencia_imagem
    ? `${question.referencia_imagem.length}:${question.referencia_imagem.slice(0, 64)}:${question.referencia_imagem.slice(-64)}`
    : "";
  return [
    question.referencia_texto?.trim() ?? "",
    question.referencia_texto_apos?.trim() ?? "",
    question.referencia_fonte?.trim() ?? "",
    image,
  ].join("|");
}

function countReferenceBlockSize(questions: DocumentQuestion[], index: number) {
  const key = getDocumentReferenceKey(questions[index]);
  if (!key) return 0;
  let start = index;
  while (start > 0 && getDocumentReferenceKey(questions[start - 1]) === key) start--;
  let end = index;
  while (end + 1 < questions.length && getDocumentReferenceKey(questions[end + 1]) === key) end++;
  return end - start + 1;
}

function buildReferenceGroupVisuals(questions: DocumentQuestion[]) {
  const map = new Map<string, ReferenceGroupVisual>();
  let previousKey: string | null = null;

  questions.forEach((question) => {
    const key = getDocumentReferenceKey(question);
    if (!key) {
      previousKey = null;
      return;
    }

    let visual = map.get(key);
    if (!visual) {
      const index = map.size;
      visual = {
        label: `Ref ${referenceLabel(index)}`,
        color: REFERENCE_GROUP_COLORS[index % REFERENCE_GROUP_COLORS.length],
        totalItems: 0,
        blockCount: 0,
      };
      map.set(key, visual);
    }

    visual.totalItems += 1;
    if (key !== previousKey) visual.blockCount += 1;
    previousKey = key;
  });

  return map;
}

function referenceLabel(index: number) {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}
