import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Copy, FileText, Image as ImageIcon, Sigma, Loader2, ScanLine, Pencil, AlertTriangle, ChevronDown, ListChecks, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { insertQuestionsWithCompatibility } from "@/lib/question-compat";
import { loadSelectedQuestionIds, saveSelectedQuestionIds } from "@/lib/selection-store";
import type { ImagePlacementLayout } from "@/lib/image-layout";
import { toast } from "sonner";

export const Route = createFileRoute("/questoes")({
  head: () => ({ meta: [{ title: "Questões salvas" }] }),
  component: Page,
});

type Q = {
  id: string; numero: string | null; enunciado: string;
  alternativas: { letra: string; texto: string; imagem?: string | null }[];
  tipo: string; resposta: string | null; fonte: string | null;
  disciplina: string | null; conteudo: string | null;
  area_geral?: string | null; conteudo_principal?: string | null; subconteudo_principal?: string | null;
  conteudos_relacionados?: string[] | null; tags_livres?: string[] | null; tags?: string[] | null;
  ano?: string | null; prova?: string | null; instituicao?: string | null; observacoes?: string | null;
  referencia_texto?: string | null; referencia_fonte?: string | null; grupo_id?: string | null;
  referencia_imagem?: string | null; referencia_imagem_pos?: string | null; referencia_imagem_layout?: ImagePlacementLayout | null;
  referencia_texto_apos?: string | null;
  enunciado_imagem?: string | null; enunciado_imagem_pos?: string | null; enunciado_imagem_layout?: ImagePlacementLayout | null;
  imagem_original_url?: string | null;
  tem_equacao: boolean; tem_imagem: boolean;
  created_at: string;
};

const NO_CONTENT_FILTER = "__sem_conteudo__";

function Page() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filtroDisc, setFiltroDisc] = useState("");
  const [filtroConteudo, setFiltroConteudo] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editingContent, setEditingContent] = useState<Q | null>(null);
  const [editingContentValue, setEditingContentValue] = useState("");

  const commitSelection = (next: Set<string>) => {
    setSel(next);
    saveSelectedQuestionIds([...next]);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Falha ao carregar");
    } else {
      const loaded = (data ?? []) as unknown as Q[];
      setItems(loaded);
      const validIds = new Set(loaded.map((item) => item.id));
      const storedIds = loadSelectedQuestionIds().filter((id) => validIds.has(id));
      commitSelection(new Set(storedIds));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const disciplinas = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => { if (i.disciplina) s.add(i.disciplina); });
    return [...s].sort();
  }, [items]);

  const conteudos = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => getConteudos(i).forEach((c) => s.add(c)));
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const semConteudoCount = useMemo(() => items.filter((i) => getConteudos(i).length === 0).length, [items]);

  const filtered = useMemo(() => items.filter((i) => {
    const itemConteudos = getConteudos(i);
    if (q && !matchesSearch(i, itemConteudos, q)) return false;
    if (filtroDisc && i.disciplina !== filtroDisc) return false;
    if (filtroConteudo === NO_CONTENT_FILTER && itemConteudos.length > 0) return false;
    if (filtroConteudo && filtroConteudo !== NO_CONTENT_FILTER && !itemConteudos.includes(filtroConteudo)) return false;
    return true;
  }), [items, q, filtroDisc, filtroConteudo]);

  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    commitSelection(next);
  };

  const openDocument = () => {
    const ids = [...sel];
    saveSelectedQuestionIds(ids);
    navigate({ to: "/documento" });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta questão? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) toast.error("Falha ao excluir");
    else {
      toast.success("Questão excluída");
      setItems(items.filter((x) => x.id !== id));
      const ns = new Set(sel);
      ns.delete(id);
      commitSelection(ns);
    }
  };

  const onDuplicate = async (q: Q) => {
    const duplicated = {
      numero: q.numero,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      tipo: q.tipo,
      resposta: q.resposta,
      fonte: q.fonte,
      disciplina: q.disciplina,
      conteudo: q.conteudo,
      dificuldade: null,
      area_geral: q.area_geral ?? null,
      conteudo_principal: q.conteudo_principal ?? null,
      subconteudo_principal: q.subconteudo_principal ?? null,
      conteudos_relacionados: q.conteudos_relacionados ?? [],
      tags_livres: q.tags_livres ?? [],
      tags: q.tags ?? q.tags_livres ?? null,
      ano: q.ano ?? null,
      prova: q.prova ?? null,
      instituicao: q.instituicao ?? null,
      observacoes: q.observacoes ?? null,
      referencia_texto: q.referencia_texto ?? null,
      referencia_fonte: q.referencia_fonte ?? null,
      grupo_id: q.grupo_id ?? null,
      referencia_imagem: q.referencia_imagem ?? null,
      referencia_imagem_pos: q.referencia_imagem_pos ?? null,
      referencia_imagem_layout: q.referencia_imagem_layout ?? null,
      referencia_texto_apos: q.referencia_texto_apos ?? null,
      enunciado_imagem: q.enunciado_imagem ?? null,
      enunciado_imagem_pos: q.enunciado_imagem_pos ?? null,
      enunciado_imagem_layout: q.enunciado_imagem_layout ?? null,
      imagem_original_url: q.imagem_original_url ?? null,
      tem_equacao: q.tem_equacao,
      tem_imagem: q.tem_imagem,
    };

    try {
      const { removedColumns } = await insertQuestionsWithCompatibility([duplicated]);
      if (removedColumns.length > 0) {
        toast.warning("Questão duplicada. Alguns campos novos não foram gravados porque o banco ainda precisa da atualização.");
      } else {
        toast.success("Questão duplicada");
      }
      load();
    } catch (error) {
      console.error(error);
      toast.error("Falha ao duplicar");
    }
  };

  const openContentEditor = (question: Q) => {
    setEditingContent(question);
    setEditingContentValue(getConteudos(question)[0] ?? question.conteudo ?? "");
  };

  const updateQuestionContent = async () => {
    if (!editingContent) return;
    const conteudo = editingContentValue.trim() || null;
    const { error } = await supabase.from("questions").update({ conteudo }).eq("id", editingContent.id);
    if (error) {
      toast.error("Falha ao atualizar conteúdo");
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === editingContent.id
          ? { ...item, conteudo }
          : item,
      ),
    );
    setEditingContent(null);
    setEditingContentValue("");
    toast.success("Conteúdo da questão atualizado com sucesso.");
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Questões salvas</h1>
            <p className="text-sm text-muted-foreground">{items.length} questões na sua biblioteca</p>
          </div>
          <Button asChild className="gap-2"><Link to="/"><ScanLine className="size-4" /> Nova questão</Link></Button>
        </div>

        {semConteudoCount > 0 && (
          <button
            type="button"
            onClick={() => setFiltroConteudo(NO_CONTENT_FILTER)}
            className="mb-4 w-full rounded-lg border border-accent bg-accent/30 px-3 py-2 text-left text-sm flex items-center gap-2"
          >
            <AlertTriangle className="size-4 shrink-0" />
            <span>Existem {semConteudoCount} questão{semConteudoCount > 1 ? "ões" : ""} sem conteúdo vinculado. Clique aqui para visualizá-la{semConteudoCount > 1 ? "s" : ""}.</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Pesquisar no enunciado…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {disciplinas.length > 0 && (
            <select className="rounded-md border bg-card px-3 text-sm" value={filtroDisc} onChange={(e) => setFiltroDisc(e.target.value)}>
              <option value="">Todas as disciplinas</option>
              {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {conteudos.length > 0 && (
            <select className="rounded-md border bg-card px-3 text-sm" value={filtroConteudo} onChange={(e) => setFiltroConteudo(e.target.value)}>
              <option value="">Todos os conteúdos</option>
              <option value={NO_CONTENT_FILTER}>Sem conteúdo vinculado</option>
              {conteudos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <FileText className="size-10 mx-auto text-muted-foreground mb-2" />
            <p className="font-medium">Nenhuma questão {items.length > 0 ? "encontrada" : "ainda"}</p>
            <p className="text-sm text-muted-foreground">{items.length > 0 ? "Ajuste a pesquisa ou filtros." : "Comece digitalizando sua primeira questão."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((it) => {
              const isSel = sel.has(it.id);
              const itemConteudos = getConteudos(it);
              return (
                <div key={it.id} className={`rounded-xl border bg-card p-4 transition-colors ${isSel ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex gap-3">
                    <Checkbox checked={isSel} onCheckedChange={() => toggle(it.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-muted-foreground">#{it.id.slice(0, 6)}</span>
                        {it.numero && <Badge variant="outline">Q{it.numero}</Badge>}
                        {it.disciplina && <Badge variant="secondary">{it.disciplina}</Badge>}
                        {itemConteudos.length > 0
                          ? itemConteudos.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)
                          : <Badge variant="destructive">Sem conteúdo vinculado</Badge>}
                        {it.referencia_texto && <Badge variant="outline">referência</Badge>}
                        {it.fonte && <span className="text-xs text-muted-foreground">{it.fonte}</span>}
                        {it.tem_equacao && <Sigma className="size-3.5 text-muted-foreground" />}
                        {it.tem_imagem && <ImageIcon className="size-3.5 text-muted-foreground" />}
                      </div>
                      <p className="text-sm line-clamp-2">{it.enunciado}</p>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                        <span>Conteúdo: {itemConteudos.length > 0 ? itemConteudos.join(", ") : "não vinculado"}</span>
                        <span>Tipo: {formatTipo(it.tipo)}</span>
                        <span>Data de criação: {new Date(it.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-1">
                      <Button size="sm" variant="outline" onClick={() => openContentEditor(it)} className="gap-1">
                        <Pencil className="size-3.5" /> Alterar conteúdo
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => onDuplicate(it)} title="Duplicar"><Copy className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(it.id)} title="Excluir"><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {sel.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground rounded-full px-5 py-3 shadow-lg flex items-center gap-4">
            <span className="font-medium text-sm">{sel.size} questão{sel.size > 1 ? "s" : ""} selecionada{sel.size > 1 ? "s" : ""}</span>
            <Button size="sm" variant="secondary" onClick={openDocument} className="gap-2">
              <FileText className="size-4" /> Criar documento
            </Button>
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary/80" onClick={() => commitSelection(new Set())}>Limpar</Button>
          </div>
        )}

        <Dialog open={!!editingContent} onOpenChange={(open) => !open && setEditingContent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar conteúdo</DialogTitle>
              <DialogDescription>
                Esta ação muda apenas o conteúdo vinculado à questão.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="editar-conteudo">Conteúdo vinculado</label>
              <Input
                id="editar-conteudo"
                list="conteudos-salvos"
                value={editingContentValue}
                onChange={(e) => setEditingContentValue(e.target.value)}
                placeholder="Selecione ou crie um conteúdo"
              />
              <datalist id="conteudos-salvos">
                {conteudos.map((name) => <option key={name} value={name} />)}
              </datalist>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingContent(null)}>Cancelar</Button>
              <Button onClick={updateQuestionContent}>Salvar conteúdo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

function getConteudos(question: Q) {
  const principal = (question.conteudo_principal ?? "").trim();
  const sub = (question.subconteudo_principal ?? "").trim();
  const related = (question.conteudos_relacionados ?? []).map((s) => s.trim()).filter(Boolean);
  const direct = splitConteudos(question.conteudo);
  const all = [principal, sub, ...related, ...direct].filter(Boolean);
  return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function splitConteudos(value: string | null) {
  return (value ?? "")
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesSearch(question: Q, conteudos: string[], term: string) {
  const needle = term.toLowerCase();
  return [
    question.enunciado,
    question.referencia_texto ?? "",
    question.conteudo ?? "",
    ...conteudos,
  ].some((value) => value.toLowerCase().includes(needle));
}

function formatTipo(tipo: string) {
  const labels: Record<string, string> = {
    multipla_escolha: "Múltipla escolha",
    certo_errado: "Certo ou errado",
    numerica: "Numérica",
    discursiva: "Discursiva",
  };
  return labels[tipo] ?? tipo;
}
