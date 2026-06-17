import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Trash2, Plus, GripVertical, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/AppLayout";
import { loadDraft, clearDraft, LETRAS, reletter, DraftQuestion } from "@/lib/draft-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/revisar")({
  head: () => ({ meta: [{ title: "Revisar questão" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftQuestion | null>(null);
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

  const update = <K extends keyof DraftQuestion>(k: K, v: DraftQuestion[K]) => setDraft({ ...draft, [k]: v });

  const updateAlt = (i: number, key: "letra" | "texto", v: string) => {
    const copy = [...draft.alternativas];
    copy[i] = { ...copy[i], [key]: v };
    setDraft({ ...draft, alternativas: copy });
  };
  const addAlt = () => {
    const next = [...draft.alternativas, { letra: LETRAS[draft.alternativas.length] ?? "X", texto: "" }];
    setDraft({ ...draft, alternativas: reletter(next) });
  };
  const removeAlt = (i: number) => {
    const next = draft.alternativas.filter((_, idx) => idx !== i);
    setDraft({ ...draft, alternativas: reletter(next) });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("questions").insert({
        numero: draft.numero || null,
        enunciado: draft.enunciado,
        alternativas: draft.alternativas,
        tipo: draft.tipo,
        resposta: draft.resposta || null,
        fonte: draft.fonte || null,
        disciplina: draft.disciplina || null,
        conteudo: draft.conteudo || null,
        dificuldade: draft.dificuldade || null,
        ano: draft.ano || null,
        prova: draft.prova || null,
        instituicao: draft.instituicao || null,
        observacoes: draft.observacoes || null,
        tem_equacao: draft.tem_equacao,
        tem_imagem: draft.tem_imagem,
        imagem_original_url: draft.imageDataUrl ?? null,
      });
      if (error) throw error;
      clearDraft();
      toast.success("Questão salva com sucesso!");
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
            <h1 className="text-xl sm:text-2xl font-bold">Revisar questão</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving} className="gap-2">
              <Save className="size-4" /> {saving ? "Salvando…" : "Salvar questão"}
            </Button>
          </div>
        </div>

        {draft.baixa_confianca && draft.baixa_confianca.length > 0 && (
          <div className="mb-4 rounded-lg border border-accent bg-accent/30 p-3 flex gap-2 text-sm">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <strong>Trechos com baixa confiança — revise:</strong>
              <ul className="list-disc pl-5 mt-1">
                {draft.baixa_confianca.map((t, i) => <li key={i}>{t}</li>)}
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
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Número</Label>
                <Input value={draft.numero ?? ""} onChange={(e) => update("numero", e.target.value)} placeholder="1" />
              </div>
              <div className="col-span-2">
                <Label>Tipo</Label>
                <Select value={draft.tipo} onValueChange={(v) => update("tipo", v as DraftQuestion["tipo"])}>
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
                value={draft.enunciado}
                onChange={(e) => update("enunciado", e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Equações em LaTeX: <code>$x^2$</code>, <code>$\\frac{`{a}`}{`{b}`}$</code></p>
            </div>

            {draft.tipo === "multipla_escolha" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Alternativas</Label>
                  <Button size="sm" variant="outline" onClick={addAlt} className="gap-1"><Plus className="size-3" /> Adicionar</Button>
                </div>
                <div className="space-y-2">
                  {draft.alternativas.map((a, i) => (
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
                <Input value={draft.resposta ?? ""} onChange={(e) => update("resposta", e.target.value)} placeholder="A" />
              </div>
              <div>
                <Label>Fonte</Label>
                <Input value={draft.fonte ?? ""} onChange={(e) => update("fonte", e.target.value)} placeholder="ENEM 2023" />
              </div>
            </div>

            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">Metadados opcionais</summary>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div><Label>Disciplina</Label><Input value={draft.disciplina ?? ""} onChange={(e) => update("disciplina", e.target.value)} /></div>
                <div><Label>Conteúdo</Label><Input value={draft.conteudo ?? ""} onChange={(e) => update("conteudo", e.target.value)} /></div>
                <div><Label>Dificuldade</Label>
                  <Select value={draft.dificuldade ?? ""} onValueChange={(v) => update("dificuldade", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facil">Fácil</SelectItem>
                      <SelectItem value="medio">Médio</SelectItem>
                      <SelectItem value="dificil">Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ano</Label><Input value={draft.ano ?? ""} onChange={(e) => update("ano", e.target.value)} /></div>
                <div><Label>Prova</Label><Input value={draft.prova ?? ""} onChange={(e) => update("prova", e.target.value)} /></div>
                <div><Label>Instituição</Label><Input value={draft.instituicao ?? ""} onChange={(e) => update("instituicao", e.target.value)} /></div>
                <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={draft.observacoes ?? ""} onChange={(e) => update("observacoes", e.target.value)} /></div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
