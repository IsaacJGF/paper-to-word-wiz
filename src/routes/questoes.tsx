import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Copy, FileText, Image as ImageIcon, Sigma, Loader2, ScanLine, Pencil, AlertTriangle, ChevronDown, ListChecks, Table as TableIcon, Layers } from "lucide-react";
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

type ReferenceLike = Pick<Q,
  "grupo_id" |
  "referencia_texto" |
  "referencia_texto_apos" |
  "referencia_fonte" |
  "referencia_imagem" |
  "referencia_imagem_layout"
>;

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
  const [expanded, setExpanded] = useState<Q | null>(null);
  const [referenceGroup, setReferenceGroup] = useState<{ key: string; selected: Set<string> } | null>(null);

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

  const referenceGroups = useMemo(() => {
    const groups = new Map<string, Q[]>();
    for (const item of items) {
      const key = getReferenceKey(item);
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    for (const group of groups.values()) group.sort(compareReferenceItems);
    return groups;
  }, [items]);

  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    commitSelection(next);
  };

  const openReferenceGroup = (question: Q) => {
    const key = getReferenceKey(question);
    if (!key) return;
    const group = referenceGroups.get(key) ?? [question];
    const selectedIds = group.filter((item) => sel.has(item.id)).map((item) => item.id);
    setReferenceGroup({ key, selected: new Set(selectedIds.length > 0 ? selectedIds : [question.id]) });
  };

  const toggleReferenceGroupItem = (id: string, checked: boolean) => {
    setReferenceGroup((current) => {
      if (!current) return current;
      const selected = new Set(current.selected);
      if (checked) selected.add(id); else selected.delete(id);
      return { ...current, selected };
    });
  };

  const selectAllReferenceGroupItems = () => {
    setReferenceGroup((current) => {
      if (!current) return current;
      const group = referenceGroups.get(current.key) ?? [];
      return { ...current, selected: new Set(group.map((item) => item.id)) };
    });
  };

  const clearReferenceGroupItems = () => {
    setReferenceGroup((current) => current ? { ...current, selected: new Set() } : current);
  };

  const addReferenceGroupSelection = () => {
    if (!referenceGroup) return;
    if (referenceGroup.selected.size === 0) {
      toast.info("Selecione ao menos um item da referência.");
      return;
    }
    const next = new Set(sel);
    referenceGroup.selected.forEach((id) => next.add(id));
    commitSelection(next);
    toast.success("Itens selecionados adicionados à avaliação.");
    setReferenceGroup(null);
  };

  const selectWholeReferenceGroup = (question: Q) => {
    const key = getReferenceKey(question);
    if (!key) return;
    const group = referenceGroups.get(key) ?? [];
    if (group.length === 0) return;
    const next = new Set(sel);
    group.forEach((item) => next.add(item.id));
    commitSelection(next);
    toast.success(`${group.length} itens da mesma referência selecionados.`);
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
      <div className="max-w-7xl mx-auto px-4 py-6">
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
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((it) => {
              const isSel = sel.has(it.id);
              const itemConteudos = getConteudos(it);
              const source = [it.prova, it.instituicao, it.ano].filter(Boolean).join(" • ");
              const hasAlternativas = Array.isArray(it.alternativas) && it.alternativas.length > 0;
              const hasImagem = !!(it.tem_imagem || it.enunciado_imagem || it.referencia_imagem);
              const tags = [it.disciplina, ...itemConteudos].filter(Boolean) as string[];
              const tagsShown = tags.slice(0, 3);
              const tagsExtra = tags.length - tagsShown.length;
              const referenceKey = getReferenceKey(it);
              const referenceItems = referenceKey ? referenceGroups.get(referenceKey) ?? [] : [];
              const hasReferenceGroup = referenceItems.length > 1;
              return (
                <div
                  key={it.id}
                  className={`group relative flex flex-col rounded-xl border bg-card p-3 transition-all hover:shadow-md ${isSel ? "ring-2 ring-primary" : ""} ${hasReferenceGroup ? "border-primary/30" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox checked={isSel} onCheckedChange={() => toggle(it.id)} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="font-mono">#{it.id.slice(0, 6)}</span>
                        {it.numero && <span>· Q{it.numero}</span>}
                      </div>
                      {source && <p className="mt-0.5 text-xs font-medium text-foreground/80 truncate">{source}</p>}
                    </div>
                    <div className="flex shrink-0 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openContentEditor(it)} title="Alterar conteúdo"><Pencil className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDuplicate(it)} title="Duplicar"><Copy className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(it.id)} title="Excluir"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </div>

                  {(tagsShown.length > 0 || hasReferenceGroup) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tagsShown.map((t) => <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{t}</Badge>)}
                      {tagsExtra > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">+{tagsExtra}</Badge>}
                      {hasReferenceGroup && <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 font-normal"><Layers className="size-3" /> {referenceItems.length} itens na mesma referência</Badge>}
                    </div>
                  )}

                  <p className="mt-2 text-sm text-foreground/90 line-clamp-3 min-h-[3.75rem]">{it.enunciado}</p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {hasImagem && <span title="Possui imagem" className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"><ImageIcon className="size-3" />Imagem</span>}
                    {it.tem_equacao && <span title="Possui fórmula" className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"><Sigma className="size-3" />Fórmula</span>}
                    {hasAlternativas && <span title="Possui alternativas" className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"><ListChecks className="size-3" />Alternativas</span>}
                    {it.referencia_texto && <span title="Possui texto de referência" className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"><TableIcon className="size-3" />Referência</span>}
                  </div>

                  {hasReferenceGroup && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => openReferenceGroup(it)}>
                        <Layers className="size-3.5" /> Ver itens da mesma referência
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => selectWholeReferenceGroup(it)}>
                        Selecionar grupo
                      </Button>
                    </div>
                  )}

                  <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t mt-3">
                    <span>{formatTipo(it.tipo)} · {new Date(it.created_at).toLocaleDateString("pt-BR")}</span>
                    <button
                      type="button"
                      onClick={() => setExpanded(it)}
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      Detalhes <ChevronDown className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <QuestionDetailsDialog question={expanded} onClose={() => setExpanded(null)} />
        <ReferenceGroupDialog
          group={referenceGroup ? referenceGroups.get(referenceGroup.key) ?? [] : []}
          selectedIds={referenceGroup?.selected ?? new Set()}
          assessmentIds={sel}
          onToggle={toggleReferenceGroupItem}
          onSelectAll={selectAllReferenceGroupItems}
          onClear={clearReferenceGroupItems}
          onAdd={addReferenceGroupSelection}
          onClose={() => setReferenceGroup(null)}
        />

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

function hasReference(question: ReferenceLike) {
  return Boolean(
    question.referencia_texto?.trim() ||
    question.referencia_texto_apos?.trim() ||
    question.referencia_imagem,
  );
}

function getReferenceKey(question: ReferenceLike) {
  if (!hasReference(question)) return null;
  const groupId = question.grupo_id?.trim();
  if (groupId) return `grupo:${groupId}`;
  return `ref:${referenceFingerprint(question)}`;
}

function referenceFingerprint(question: ReferenceLike) {
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

function compareReferenceItems(a: Q, b: Q) {
  const aNumber = readItemNumber(a.numero);
  const bNumber = readItemNumber(b.numero);
  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) return aNumber - bNumber;
  if (aNumber !== null && bNumber === null) return -1;
  if (aNumber === null && bNumber !== null) return 1;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function readItemNumber(value: string | null) {
  const raw = value?.match(/\d+/)?.[0];
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function QuestionDetailsDialog({ question, onClose }: { question: Q | null; onClose: () => void }) {
  const it = question;
  if (!it) return null;
  const conteudos = getConteudos(it);
  const source = [it.prova, it.instituicao, it.ano].filter(Boolean).join(" • ");
  return (
    <Dialog open={!!question} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">#{it.id.slice(0, 6)}</span>
            {it.numero && <Badge variant="outline">Q{it.numero}</Badge>}
            <span>{source || "Questão"}</span>
          </DialogTitle>
          <DialogDescription>
            {formatTipo(it.tipo)} · {new Date(it.created_at).toLocaleDateString("pt-BR")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(it.disciplina || conteudos.length > 0 || (it.tags_livres && it.tags_livres.length > 0)) && (
            <div className="flex flex-wrap gap-1">
              {it.disciplina && <Badge variant="secondary">{it.disciplina}</Badge>}
              {conteudos.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
              {(it.tags_livres ?? []).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
            </div>
          )}

          {it.referencia_imagem && (
            <img src={it.referencia_imagem} alt="Referência" className="max-w-full rounded-md border" />
          )}
          {it.referencia_texto && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{it.referencia_texto}</div>
          )}
          {it.referencia_texto_apos && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{it.referencia_texto_apos}</div>
          )}

          {it.enunciado_imagem && (it.enunciado_imagem_pos === "antes") && (
            <img src={it.enunciado_imagem} alt="Enunciado" className="max-w-full rounded-md border" />
          )}
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{it.enunciado}</div>
          {it.enunciado_imagem && it.enunciado_imagem_pos !== "antes" && (
            <img src={it.enunciado_imagem} alt="Enunciado" className="max-w-full rounded-md border" />
          )}

          {Array.isArray(it.alternativas) && it.alternativas.length > 0 && (
            <div className="space-y-2">
              {it.alternativas.map((a) => (
                <div key={a.letra} className={`flex gap-2 rounded-md border p-2 text-sm ${it.resposta === a.letra ? "border-primary bg-primary/5" : ""}`}>
                  <span className="font-semibold">{a.letra})</span>
                  <div className="flex-1">
                    <div>{a.texto}</div>
                    {a.imagem && <img src={a.imagem} alt={`Alternativa ${a.letra}`} className="mt-2 max-w-full rounded border" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {it.resposta && (
            <div className="text-sm"><span className="font-medium">Gabarito: </span><Badge>{it.resposta}</Badge></div>
          )}
          {it.observacoes && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
              <p className="font-medium mb-1">Observações / Resolução</p>
              {it.observacoes}
            </div>
          )}

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 border-t pt-3">
            {it.area_geral && <span>Área: {it.area_geral}</span>}
            {it.conteudo_principal && <span>Conteúdo principal: {it.conteudo_principal}</span>}
            {it.subconteudo_principal && <span>Subconteúdo: {it.subconteudo_principal}</span>}
            {it.fonte && <span>Fonte: {it.fonte}</span>}
            {it.prova && <span>Prova: {it.prova}</span>}
            {it.instituicao && <span>Instituição: {it.instituicao}</span>}
            {it.ano && <span>Ano: {it.ano}</span>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Recolher</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReferenceGroupDialog({
  group,
  selectedIds,
  assessmentIds,
  onToggle,
  onSelectAll,
  onClear,
  onAdd,
  onClose,
}: {
  group: Q[];
  selectedIds: Set<string>;
  assessmentIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const reference = group[0];
  const open = group.length > 0;
  const selectedCount = group.filter((item) => selectedIds.has(item.id)).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-5" /> Itens da mesma referência
          </DialogTitle>
          <DialogDescription>
            Veja a referência comum uma única vez e escolha quais itens entram na avaliação.
          </DialogDescription>
        </DialogHeader>

        {reference && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 text-sm font-medium">
                  <TableIcon className="size-4" /> Referência comum
                </div>
                <Badge variant="outline">{group.length} itens vinculados</Badge>
              </div>
              {(reference.referencia_imagem_pos === "antes" || reference.referencia_imagem_pos === "livre") && reference.referencia_imagem && (
                <img src={reference.referencia_imagem} alt="Referência" className="max-w-full rounded-md border bg-background" />
              )}
              {reference.referencia_texto && (
                <div className="rounded-md border bg-background p-3 text-sm whitespace-pre-wrap leading-relaxed">{reference.referencia_texto}</div>
              )}
              {reference.referencia_imagem_pos === "entre" && reference.referencia_imagem && (
                <img src={reference.referencia_imagem} alt="Referência" className="max-w-full rounded-md border bg-background" />
              )}
              {reference.referencia_texto_apos && (
                <div className="rounded-md border bg-background p-3 text-sm whitespace-pre-wrap leading-relaxed">{reference.referencia_texto_apos}</div>
              )}
              {reference.referencia_imagem && !["antes", "entre", "livre"].includes(reference.referencia_imagem_pos ?? "") && (
                <img src={reference.referencia_imagem} alt="Referência" className="max-w-full rounded-md border bg-background" />
              )}
              {reference.referencia_fonte && <p className="text-xs text-right text-muted-foreground">{reference.referencia_fonte}</p>}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-medium">Itens da referência</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{selectedCount} de {group.length} selecionado{selectedCount === 1 ? "" : "s"}</span>
                <Button type="button" size="sm" variant="outline" onClick={onSelectAll}>Selecionar todos</Button>
                <Button type="button" size="sm" variant="ghost" onClick={onClear}>Limpar</Button>
              </div>
            </div>

            <div className="space-y-2">
              {group.map((item, index) => (
                <div key={item.id} className={`rounded-lg border p-3 ${selectedIds.has(item.id) ? "border-primary bg-primary/5" : "bg-background"}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={(checked) => onToggle(item.id, checked === true)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm">{item.numero ? `Item ${item.numero}` : `Item ${index + 1}`}</span>
                        {assessmentIds.has(item.id) && <Badge variant="secondary">Já na avaliação</Badge>}
                        {item.tem_equacao && <Sigma className="size-3.5 text-muted-foreground" />}
                        {(item.tem_imagem || item.enunciado_imagem) && <ImageIcon className="size-3.5 text-muted-foreground" />}
                      </div>
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap line-clamp-3">{item.enunciado}</p>
                      {Array.isArray(item.alternativas) && item.alternativas.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.alternativas.length} alternativa{item.alternativas.length === 1 ? "" : "s"}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onAdd} disabled={selectedCount === 0}>Adicionar itens selecionados à avaliação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
