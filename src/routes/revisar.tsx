import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Trash2, Plus, GripVertical, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/AppLayout";
import { loadDraft, clearDraft, LETRAS, reletter, DraftDigitization, DraftQuestion } from "@/lib/draft-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/revisar")({
  head: () => ({ meta: [{ title: "Revisar questão" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftDigitization | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    if (!d) {
      navigate({ to: "/" });
      return;
    }
    setDraft(d);
  }, [navigate]);

  if (!draft) return null;
  const active = draft.questoes[Math.min(activeIndex, draft.questoes.length - 1)];

  const updateDraft = <K extends keyof DraftDigitization>(k: K, v: DraftDigitization[K]) => setDraft({ ...draft, [k]: v });
  const updateQuestion = (idx: number, updater: (q: DraftQuestion) => DraftQuestion) => {
    const questoes = draft.questoes.map((q, i) => i === idx ? updater(q) : q);
    setDraft({ ...draft, questoes });
  };
  const update = <K extends keyof DraftQuestion>(k: K, v: DraftQuestion[K]) => {
    updateQuestion(activeIndex, (q) => ({ ...q, [k]: v }));
  };

  const updateAlt = (i: number, key: "letra" | "texto", v: string) => {
    const copy = [...active.alternativas];
    copy[i] = { ...copy[i], [key]: v };
    update("alternativas", copy);
  };
  const addAlt = () => {
    const next = [...active.alternativas, { letra: LETRAS[active.alternativas.length] ?? "X", texto: "" }];
    update("alternativas", reletter(next));
  };
  const removeAlt = (i: number) => {
    const next = active.alternativas.filter((_, idx) => idx !== i);
    update("alternativas", reletter(next));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const hasReference = !!draft.referencia_texto.trim();
      const grupoId = hasReference || draft.questoes.length > 1 ? crypto.randomUUID() : null;
      const rows = draft.questoes.map((q) => ({
        numero: q.numero || null,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        tipo: q.tipo,
        resposta: q.resposta || null,
        fonte: q.fonte || draft.referencia_fonte || null,
        disciplina: q.disciplina || null,
        conteudo: q.conteudo || null,
        dificuldade: q.dificuldade || null,
        ano: q.ano || null,
        prova: q.prova || null,
        instituicao: q.instituicao || null,
        observacoes: q.observacoes || null,
        referencia_texto: draft.referencia_texto || null,
        referencia_fonte: draft.referencia_fonte || null,
        grupo_id: grupoId,
        tem_equacao: q.tem_equacao,
        tem_imagem: q.tem_imagem || hasReference,
        imagem_original_url: draft.imageDataUrl ?? null,
      }));
      const { error } = await supabase.from("questions").insert(rows);
      if (error) throw error;
      clearDraft();
      toast.success(draft.questoes.length > 1 ? "Itens salvos com sucesso!" : "Questão salva com sucesso!");
      navigate({ to: "/questoes" });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao salvar a questão.");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    if (confirm("Descartar esta digitalização?")) {
      clearDraft();
      navigate({ to: "/" });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><ArrowLeft className="size-4" /> Voltar</Link>
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">Revisar digitalização</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving} className="gap-2">
              <Save className="size-4" /> {saving ? "Salvando…" : `Salvar ${draft.questoes.length} item${draft.questoes.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>

        {active.baixa_confianca && active.baixa_confianca.length > 0 && (
          <div className="mb-4 rounded-lg border border-accent bg-accent/30 p-3 flex gap-2 text-sm">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <strong>Trechos com baixa confiança no item atual — revise:</strong>
              <ul className="list-disc pl-5 mt-1">
                {active.baixa_confianca.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-3 border-b text-sm font-medium">Imagem original</div>
            <div className="p-4 bg-muted/30 flex items-center justify-center min-h-[300px] max-h-[80vh] overflow-auto">
              {draft.imageDataUrl ? (
                <img src={draft.imageDataUrl} alt="Original" className="max-w-full object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground">Imagem indisponível</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Referência / texto-base comum</Label>
                <span className="text-xs text-muted-foreground">{draft.questoes.length} item{draft.questoes.length > 1 ? "s" : ""}</span>
              </div>
              <Textarea
                value={draft.referencia_texto}
                onChange={(e) => updateDraft("referencia_texto", e.target.value)}
                rows={5}
                placeholder="Texto, imagem descrita, tabela ou comando geral que vale para todos os itens."
                className="text-sm"
              />
              <div>
                <Label>Fonte da referência</Label>
                <Input value={draft.referencia_fonte} onChange={(e) => updateDraft("referencia_fonte", e.target.value)} placeholder="Internet, banca, prova, ano..." />
              </div>
            </div>

            {draft.questoes.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {draft.questoes.map((q, i) => (
                  <Button
                    key={i}
                    type="button"
                    size="sm"
                    variant={i === activeIndex ? "default" : "outline"}
                    onClick={() => setActiveIndex(i)}
                  >
                    {q.numero ? `Item ${q.numero}` : `Item ${i + 1}`}
                  </Button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Número</Label>
                <Input value={active.numero ?? ""} onChange={(e) => update("numero", e.target.value)} placeholder="1" />
              </div>
              <div className="col-span-2">
                <Label>Tipo</Label>
                <Select value={active.tipo} onValueChange={(v) => update("tipo", v as DraftQuestion["tipo"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multipla_escolha">Múltipla escolha</SelectItem>
                    <SelectItem value="certo_errado">Certo ou errado</SelectItem>
                    <SelectItem value="numerica">Numérica</SelectItem>
                    <SelectItem value="discursiva">Discursiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Enunciado</Label>
              <Textarea
                value={active.enunciado}
                onChange={(e) => update("enunciado", e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Equações em LaTeX: <code>$x^2$</code>, <code>$\\frac{`{a}`}{`{b}`}$</code></p>
            </div>

            {active.tipo === "multipla_escolha" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Alternativas</Label>
                  <Button size="sm" variant="outline" onClick={addAlt} className="gap-1"><Plus className="size-3" /> Adicionar</Button>
                </div>
                <div className="space-y-2">
                  {active.alternativas.map((a, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <GripVertical className="size-4 mt-3 text-muted-foreground" />
                      <Input className="w-14 text-center font-bold" value={a.letra} onChange={(e) => updateAlt(i, "letra", e.target.value)} />
                      <Textarea
                        className="flex-1 text-sm"
                        rows={2}
                        value={a.texto}
                        onChange={(e) => updateAlt(i, "texto", e.target.value)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeAlt(i)}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Resposta / Gabarito</Label>
                <Input value={active.resposta ?? ""} onChange={(e) => update("resposta", e.target.value)} placeholder="A" />
              </div>
              <div>
                <Label>Fonte</Label>
                <Input value={active.fonte ?? ""} onChange={(e) => update("fonte", e.target.value)} placeholder="ENEM 2023" />
              </div>
            </div>

            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">Metadados opcionais</summary>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div><Label>Disciplina</Label><Input value={active.disciplina ?? ""} onChange={(e) => update("disciplina", e.target.value)} /></div>
                <div><Label>Conteúdo</Label><Input value={active.conteudo ?? ""} onChange={(e) => update("conteudo", e.target.value)} /></div>
                <div><Label>Dificuldade</Label>
                  <Select value={active.dificuldade ?? ""} onValueChange={(v) => update("dificuldade", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facil">Fácil</SelectItem>
                      <SelectItem value="medio">Médio</SelectItem>
                      <SelectItem value="dificil">Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ano</Label><Input value={active.ano ?? ""} onChange={(e) => update("ano", e.target.value)} /></div>
                <div><Label>Prova</Label><Input value={active.prova ?? ""} onChange={(e) => update("prova", e.target.value)} /></div>
                <div><Label>Instituição</Label><Input value={active.instituicao ?? ""} onChange={(e) => update("instituicao", e.target.value)} /></div>
                <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={active.observacoes ?? ""} onChange={(e) => update("observacoes", e.target.value)} /></div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
