import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, Trash2, Copy, FileText, Image as ImageIcon, Sigma, Loader2, ScanLine, Pencil, AlertTriangle, ChevronDown, ListChecks, Table as TableIcon, Layers, Filter } from "lucide-react";
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
import { CatalogMultiSelect } from "@/components/CatalogSelect";
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
  "referencia_imagem_pos" |
  "referencia_imagem_layout"
>;

type CatalogItem = { id: string; nome: string; ativo: boolean; area_id?: string | null; conteudo_id?: string | null };
type PedagogicalEntry = { label: string; value: string };
type MathSegment = { type: "text"; value: string } | { type: "math"; value: string; display: boolean };
type AdvancedFilters = {
  area_geral: string;
  conteudo_principal: string;
  subconteudo_principal: string;
  conteudos_relacionados: string[];
  prova: string;
  instituicao: string;
  ano: string;
};

const EMPTY_ADVANCED_FILTERS: AdvancedFilters = {
  area_geral: "",
  conteudo_principal: "",
  subconteudo_principal: "",
  conteudos_relacionados: [],
  prova: "",
  instituicao: "",
  ano: "",
};

const MATH_SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", varepsilon: "ε",
  theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", phi: "φ", varphi: "φ",
  omega: "ω", Omega: "Ω", nabla: "∇", times: "×", cdot: "·", pm: "±", mp: "∓",
  le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", approx: "≈", sim: "∼", propto: "∝",
  infty: "∞", rightarrow: "→", to: "→", leftarrow: "←", leftrightarrow: "↔", degree: "°", circ: "°",
  ohm: "Ω", partial: "∂", sum: "Σ", int: "∫", div: "÷",
};

const MATH_WORDS = new Set(["sin", "cos", "tan", "sen", "log", "ln", "lim", "min", "max"]);

function Page() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editingContent, setEditingContent] = useState<Q | null>(null);
  const [editingContentValue, setEditingContentValue] = useState("");
  const [expanded, setExpanded] = useState<Q | null>(null);
  const [referenceGroup, setReferenceGroup] = useState<{ key: string; selected: Set<string> } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [areas, setAreas] = useState<CatalogItem[]>([]);
  const [catalogConteudos, setCatalogConteudos] = useState<CatalogItem[]>([]);
  const [subconteudos, setSubconteudos] = useState<CatalogItem[]>([]);
  const [relacionados, setRelacionados] = useState<CatalogItem[]>([]);
  const [provas, setProvas] = useState<CatalogItem[]>([]);
  const [instituicoes, setInstituicoes] = useState<CatalogItem[]>([]);

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

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const tables = [
        ["catalog_areas", setAreas],
        ["catalog_conteudos", setCatalogConteudos],
        ["catalog_subconteudos", setSubconteudos],
        ["catalog_relacionados", setRelacionados],
        ["catalog_provas", setProvas],
        ["catalog_instituicoes", setInstituicoes],
      ] as const;
      for (const [table, setter] of tables) {
        const { data, error } = await db.from(table).select("*").order("nome");
        if (!error) setter((data ?? []) as CatalogItem[]);
      }
    })();
  }, []);

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

  const anos = useMemo(() => {
    const s = new Set<string>();
    items.forEach((item) => { if (item.ano?.trim()) s.add(item.ano.trim()); });
    return [...s].sort((a, b) => b.localeCompare(a, "pt-BR", { numeric: true }));
  }, [items]);

  const activeFilterCount = useMemo(() => countActiveFilters(advancedFilters), [advancedFilters]);

  const filtered = useMemo(() => items.filter((i) => {
    if (q.trim() && !matchesSearch(i, q)) return false;
    if (!matchesAdvancedFilters(i, advancedFilters)) return false;
    return true;
  }), [items, q, advancedFilters]);

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

  const openAdvancedFilters = () => {
    setDraftFilters(cloneAdvancedFilters(advancedFilters));
    setAdvancedOpen(true);
  };

  const applyAdvancedFilters = () => {
    setAdvancedFilters(cloneAdvancedFilters(draftFilters));
    setAdvancedOpen(false);
  };

  const clearAdvancedFilters = () => {
    setDraftFilters(cloneAdvancedFilters(EMPTY_ADVANCED_FILTERS));
    setAdvancedFilters(cloneAdvancedFilters(EMPTY_ADVANCED_FILTERS));
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

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Pesquisar por palavra ou trecho da questão..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button type="button" variant={activeFilterCount > 0 ? "default" : "outline"} onClick={openAdvancedFilters} className="gap-2 sm:w-auto">
            <Filter className="size-4" />
            {activeFilterCount > 0 ? `Filtro avançado • ${activeFilterCount} ativo${activeFilterCount > 1 ? "s" : ""}` : "Filtro avançado"}
          </Button>
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
              const source = formatQuestionSource(it);
              const hasAlternativas = Array.isArray(it.alternativas) && it.alternativas.length > 0;
              const hasImagem = !!(it.tem_imagem || it.enunciado_imagem || it.referencia_imagem);
              const chips = getCardChips(it);
              const chipsShown = chips.slice(0, 3);
              const chipsExtra = chips.length - chipsShown.length;
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
                      {source && <p className="mt-0.5 truncate text-xs font-semibold text-foreground">{source}</p>}
                    </div>
                    <div className="flex shrink-0 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openContentEditor(it)} title="Alterar conteúdo"><Pencil className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDuplicate(it)} title="Duplicar"><Copy className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(it.id)} title="Excluir"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </div>

                  {(chipsShown.length > 0 || hasReferenceGroup) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {chipsShown.map((t) => <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{t}</Badge>)}
                      {chipsExtra > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">+{chipsExtra}</Badge>}
                      {hasReferenceGroup && <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 font-normal"><Layers className="size-3" /> {referenceItems.length} itens na mesma referência</Badge>}
                    </div>
                  )}

                  <MathText text={it.enunciado} className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm text-foreground/90" />

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

        <AdvancedFiltersDialog
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          activeCount={activeFilterCount}
          areas={areas}
          conteudos={catalogConteudos}
          subconteudos={subconteudos}
          relacionados={relacionados}
          provas={provas}
          instituicoes={instituicoes}
          anos={anos}
          onApply={applyAdvancedFilters}
          onClear={clearAdvancedFilters}
        />
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

function AdvancedFiltersDialog({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  activeCount,
  areas,
  conteudos,
  subconteudos,
  relacionados,
  provas,
  instituicoes,
  anos,
  onApply,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  activeCount: number;
  areas: CatalogItem[];
  conteudos: CatalogItem[];
  subconteudos: CatalogItem[];
  relacionados: CatalogItem[];
  provas: CatalogItem[];
  instituicoes: CatalogItem[];
  anos: string[];
  onApply: () => void;
  onClear: () => void;
}) {
  const area = areas.find((item) => item.nome === filters.area_geral);
  const conteudoOptions = area ? conteudos.filter((item) => item.area_id === area.id) : [];
  const conteudo = conteudoOptions.find((item) => item.nome === filters.conteudo_principal);
  const subconteudoOptions = conteudo ? subconteudos.filter((item) => item.conteudo_id === conteudo.id) : [];

  const update = (patch: Partial<AdvancedFilters>) => onFiltersChange({ ...filters, ...patch });
  const updateArea = (value: string) => update({ area_geral: value, conteudo_principal: "", subconteudo_principal: "" });
  const updateConteudo = (value: string) => update({ conteudo_principal: value, subconteudo_principal: "" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-full max-w-md translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none p-0 sm:rounded-none">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>Filtro avançado</DialogTitle>
          <DialogDescription>
            {activeCount > 0 ? `${activeCount} filtro${activeCount > 1 ? "s" : ""} ativo${activeCount > 1 ? "s" : ""}.` : "Combine filtros do catálogo com a busca principal."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="filtro-area">Área geral</label>
            <FilterSelect
              id="filtro-area"
              value={filters.area_geral}
              onChange={updateArea}
              options={areas}
              placeholder="Todas as áreas"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="filtro-conteudo">Conteúdo principal</label>
            <FilterSelect
              id="filtro-conteudo"
              value={filters.conteudo_principal}
              onChange={updateConteudo}
              options={conteudoOptions}
              placeholder={filters.area_geral ? "Todos os conteúdos" : "Selecione uma área primeiro"}
              disabled={!filters.area_geral}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="filtro-subconteudo">Subconteúdo principal</label>
            <FilterSelect
              id="filtro-subconteudo"
              value={filters.subconteudo_principal}
              onChange={(value) => update({ subconteudo_principal: value })}
              options={subconteudoOptions}
              placeholder={filters.conteudo_principal ? "Todos os subconteúdos" : "Selecione um conteúdo primeiro"}
              disabled={!filters.conteudo_principal}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Conteúdos relacionados</label>
            <CatalogMultiSelect
              values={filters.conteudos_relacionados}
              onChange={(values) => update({ conteudos_relacionados: values })}
              options={relacionados}
              placeholder="Buscar e adicionar conteúdos"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="filtro-prova">Prova</label>
            <FilterSelect
              id="filtro-prova"
              value={filters.prova}
              onChange={(value) => update({ prova: value })}
              options={provas}
              placeholder="Todas as provas"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="filtro-instituicao">Instituição</label>
            <FilterSelect
              id="filtro-instituicao"
              value={filters.instituicao}
              onChange={(value) => update({ instituicao: value })}
              options={instituicoes}
              placeholder="Todas as instituições"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="filtro-ano">Ano</label>
            <Input
              id="filtro-ano"
              list="anos-questoes"
              value={filters.ano}
              onChange={(event) => update({ ano: event.target.value })}
              placeholder="Digite ou selecione o ano"
            />
            <datalist id="anos-questoes">
              {anos.map((ano) => <option key={ano} value={ano} />)}
            </datalist>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t p-4 sm:justify-between sm:space-x-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClear}>Limpar filtros</Button>
            <Button type="button" onClick={onApply}>Aplicar filtros</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: CatalogItem[];
  placeholder: string;
  disabled?: boolean;
}) {
  const visibleOptions = options.filter((item) => item.ativo || item.nome === value);
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      <option value="">{placeholder}</option>
      {visibleOptions.map((item) => (
        <option key={item.id} value={item.nome}>{item.nome}{item.ativo ? "" : " (inativo)"}</option>
      ))}
    </select>
  );
}

function cloneAdvancedFilters(filters: AdvancedFilters): AdvancedFilters {
  return { ...filters, conteudos_relacionados: [...filters.conteudos_relacionados] };
}

function countActiveFilters(filters: AdvancedFilters) {
  return [
    filters.area_geral,
    filters.conteudo_principal,
    filters.subconteudo_principal,
    filters.conteudos_relacionados.length > 0 ? "relacionados" : "",
    filters.prova,
    filters.instituicao,
    filters.ano,
  ].filter(Boolean).length;
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

function matchesSearch(question: Q, term: string) {
  const needle = normalizeFilterText(term);
  if (!needle) return true;
  return [
    question.enunciado,
    question.referencia_texto ?? "",
    question.referencia_texto_apos ?? "",
    question.observacoes ?? "",
    ...((question.alternativas ?? []).map((alt) => alt.texto ?? "")),
  ].some((value) => normalizeFilterText(value).includes(needle));
}

function matchesAdvancedFilters(question: Q, filters: AdvancedFilters) {
  if (filters.area_geral && !sameFilterValue(question.area_geral, filters.area_geral)) return false;
  if (filters.conteudo_principal && !matchesAnyFilterValue([question.conteudo_principal, question.conteudo], filters.conteudo_principal)) return false;
  if (filters.subconteudo_principal && !sameFilterValue(question.subconteudo_principal, filters.subconteudo_principal)) return false;
  if (filters.conteudos_relacionados.length > 0) {
    const related = [...(question.conteudos_relacionados ?? []), ...splitConteudos(question.conteudo)];
    const hasRelated = filters.conteudos_relacionados.some((filter) => matchesAnyFilterValue(related, filter));
    if (!hasRelated) return false;
  }
  if (filters.prova && !sameFilterValue(question.prova, filters.prova)) return false;
  if (filters.instituicao && !sameFilterValue(question.instituicao, filters.instituicao)) return false;
  if (filters.ano && !sameFilterValue(question.ano, filters.ano)) return false;
  return true;
}

function matchesAnyFilterValue(values: Array<string | null | undefined>, expected: string) {
  return values.some((value) => sameFilterValue(value, expected));
}

function sameFilterValue(value: string | null | undefined, expected: string) {
  return normalizeFilterText(value ?? "") === normalizeFilterText(expected);
}

function normalizeFilterText(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function formatQuestionSource(question: Pick<Q, "prova" | "instituicao" | "ano">) {
  return [question.prova, question.instituicao, question.ano]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(" - ");
}

function getCardChips(question: Q) {
  const entries = getPedagogicalEntries(question);
  if (entries.length === 0) return getConteudos(question).slice(0, 3);
  return entries.map((entry) => entry.value);
}

function getPedagogicalEntries(question: Q): PedagogicalEntry[] {
  const entries: PedagogicalEntry[] = [];
  if (question.area_geral?.trim()) entries.push({ label: "Área", value: question.area_geral.trim() });
  if (question.conteudo_principal?.trim()) entries.push({ label: "Conteúdo", value: question.conteudo_principal.trim() });
  if (question.subconteudo_principal?.trim()) entries.push({ label: "Subconteúdo", value: question.subconteudo_principal.trim() });
  for (const value of question.conteudos_relacionados ?? []) {
    if (value?.trim()) entries.push({ label: "Relacionado", value: value.trim() });
  }
  for (const value of question.tags_livres ?? question.tags ?? []) {
    if (value?.trim()) entries.push({ label: "Tag", value: value.trim() });
  }
  if (entries.length === 0) {
    for (const value of splitConteudos(question.conteudo)) entries.push({ label: "Conteúdo", value });
  }
  return entries;
}

function metadataTooltip(question: Q) {
  const parts = getPedagogicalEntries(question).map((entry) => `${entry.label}: ${entry.value}`);
  if (question.resposta?.trim()) parts.push(`Gabarito: ${question.resposta.trim()}`);
  if (question.prova?.trim()) parts.push(`Prova: ${question.prova.trim()}`);
  if (question.instituicao?.trim()) parts.push(`Instituição: ${question.instituicao.trim()}`);
  if (question.ano?.trim()) parts.push(`Ano: ${question.ano.trim()}`);
  return parts.join("\n");
}

function CompactPedagogicalInfo({ question }: { question: Q }) {
  const entries = getPedagogicalEntries(question);
  const shown = entries.slice(0, 2);
  const hidden = entries.length - shown.length;
  const title = metadataTooltip(question);

  if (entries.length === 0 && !question.resposta) {
    return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">Sem conteúdo vinculado</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-1" title={title || undefined}>
      {shown.map((entry) => (
        <Badge key={`${entry.label}-${entry.value}`} variant="secondary" className="max-w-44 truncate text-[10px] px-1.5 py-0 font-normal">
          {entry.value}
        </Badge>
      ))}
      {hidden > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">+{hidden}</Badge>}
      {question.resposta && <Badge className="text-[10px] px-1.5 py-0 font-normal">Gabarito: {question.resposta}</Badge>}
    </div>
  );
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
  const source = formatQuestionSource(it);
  return (
    <Dialog open={!!question} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">#{it.id.slice(0, 6)}</span>
            {it.numero && <Badge variant="outline">Q{it.numero}</Badge>}
            {source && <span>{source}</span>}
          </DialogTitle>
          <DialogDescription>
            {formatTipo(it.tipo)} · {new Date(it.created_at).toLocaleDateString("pt-BR")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CompactPedagogicalInfo question={it} />

          <ReferenceBlock question={it} />
          <QuestionStatement question={it} />
          <AlternativesList question={it} />

          {it.resposta && (
            <div className="text-sm"><span className="font-medium">Gabarito: </span><Badge>{it.resposta}</Badge></div>
          )}
          {it.observacoes && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium mb-1">Observações / Resolução</p>
              <MathText text={it.observacoes} className="whitespace-pre-wrap" />
            </div>
          )}

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 border-t pt-3">
            {it.area_geral && <span>Área: {it.area_geral}</span>}
            {it.conteudo_principal && <span>Conteúdo principal: {it.conteudo_principal}</span>}
            {it.subconteudo_principal && <span>Subconteúdo: {it.subconteudo_principal}</span>}
            {(it.conteudos_relacionados ?? []).length > 0 && <span>Relacionados: {(it.conteudos_relacionados ?? []).join(", ")}</span>}
            {(it.tags_livres ?? []).length > 0 && <span>Tags: {(it.tags_livres ?? []).join(", ")}</span>}
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
              <ReferenceBlock question={reference} compact />
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-medium">Itens da referência</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{selectedCount} de {group.length} selecionado{selectedCount === 1 ? "" : "s"}</span>
                <Button type="button" size="sm" variant="outline" onClick={onSelectAll}>Selecionar todos</Button>
                <Button type="button" size="sm" variant="ghost" onClick={onClear}>Limpar</Button>
              </div>
            </div>

            <div className="space-y-3">
              {group.map((item, index) => {
                const source = formatQuestionSource(item);
                return (
                  <div key={item.id} className={`rounded-lg border p-3 ${selectedIds.has(item.id) ? "border-primary bg-primary/5" : "bg-background"}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(checked) => onToggle(item.id, checked === true)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{item.numero ? `Item ${item.numero}` : `Item ${index + 1}`}</span>
                              {assessmentIds.has(item.id) && <Badge variant="secondary">Já na avaliação</Badge>}
                              {item.tem_equacao && <Sigma className="size-3.5 text-muted-foreground" />}
                              {(item.tem_imagem || item.enunciado_imagem) && <ImageIcon className="size-3.5 text-muted-foreground" />}
                            </div>
                            {source && <p className="text-xs font-medium text-muted-foreground">{source}</p>}
                          </div>
                          <CompactPedagogicalInfo question={item} />
                        </div>

                        <QuestionStatement question={item} />
                        <AlternativesList question={item} />
                      </div>
                    </div>
                  </div>
                );
              })}
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

function ReferenceBlock({ question, compact = false }: { question: Q; compact?: boolean }) {
  if (!hasReference(question)) return null;
  const image = question.referencia_imagem;
  const pos = question.referencia_imagem_pos ?? "depois";
  const imageClass = compact ? "max-h-72 max-w-full rounded-md border bg-background object-contain" : "max-w-full rounded-md border bg-background";
  return (
    <div className={compact ? "space-y-3" : "rounded-md border bg-muted/40 p-3 space-y-3"}>
      {(pos === "antes" || pos === "livre") && image && <img src={image} alt="Referência" className={imageClass} />}
      {question.referencia_texto && <MathText text={question.referencia_texto} className="text-sm whitespace-pre-wrap leading-relaxed" />}
      {pos === "entre" && image && <img src={image} alt="Referência" className={imageClass} />}
      {question.referencia_texto_apos && <MathText text={question.referencia_texto_apos} className="text-sm whitespace-pre-wrap leading-relaxed" />}
      {image && !["antes", "entre", "livre"].includes(pos) && <img src={image} alt="Referência" className={imageClass} />}
      {question.referencia_fonte && <p className="text-xs text-right text-muted-foreground">{question.referencia_fonte}</p>}
    </div>
  );
}

function QuestionStatement({ question }: { question: Q }) {
  return (
    <div className="space-y-2">
      {question.enunciado_imagem && question.enunciado_imagem_pos === "antes" && (
        <img src={question.enunciado_imagem} alt="Enunciado" className="max-w-full rounded-md border" />
      )}
      <MathText text={question.enunciado} className="text-sm whitespace-pre-wrap leading-relaxed" />
      {question.enunciado_imagem && question.enunciado_imagem_pos !== "antes" && (
        <img src={question.enunciado_imagem} alt="Enunciado" className="max-w-full rounded-md border" />
      )}
    </div>
  );
}

function AlternativesList({ question }: { question: Q }) {
  if (!Array.isArray(question.alternativas) || question.alternativas.length === 0) return null;
  return (
    <div className="space-y-2">
      {question.alternativas.map((a) => (
        <div key={a.letra} className={`flex gap-2 rounded-md border p-2 text-sm ${question.resposta === a.letra ? "border-primary bg-primary/5" : ""}`}>
          <span className="font-semibold">{a.letra})</span>
          <div className="min-w-0 flex-1 space-y-2">
            <MathText text={a.texto} className="whitespace-pre-wrap leading-relaxed" />
            {a.imagem && <img src={a.imagem} alt={`Alternativa ${a.letra}`} className="max-w-full rounded border" />}
          </div>
        </div>
      ))}
    </div>
  );
}

function MathText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const segments = splitMathSegments(text ?? "");
  return (
    <div className={className}>
      {segments.map((segment, index) => segment.type === "text"
        ? <PlainText key={index} text={segment.value} />
        : <MathExpression key={index} latex={segment.value} display={segment.display} />)}
    </div>
  );
}

function PlainText({ text }: { text: string }) {
  const parts = text.split("\n");
  return <>{parts.map((part, index) => <span key={index}>{index > 0 && <br />}{part}</span>)}</>;
}

function MathExpression({ latex, display }: { latex: string; display: boolean }) {
  const content = renderLatexNodes(latex.trim(), "m");
  if (display) {
    return (
      <span className="my-2 flex max-w-full justify-center overflow-x-auto rounded-md bg-muted/40 px-2 py-1 font-serif text-base">
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">{content}</span>
      </span>
    );
  }
  return <span className="inline-flex items-center gap-0.5 whitespace-nowrap align-middle font-serif">{content}</span>;
}

function splitMathSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let i = 0;
  let plain = "";
  const flush = () => {
    if (plain) {
      segments.push({ type: "text", value: plain });
      plain = "";
    }
  };

  while (i < text.length) {
    if (text.startsWith("$$", i)) {
      const end = text.indexOf("$$", i + 2);
      if (end !== -1) {
        flush();
        segments.push({ type: "math", value: text.slice(i + 2, end), display: true });
        i = end + 2;
        continue;
      }
    }
    if (text.startsWith("\\[", i)) {
      const end = text.indexOf("\\]", i + 2);
      if (end !== -1) {
        flush();
        segments.push({ type: "math", value: text.slice(i + 2, end), display: true });
        i = end + 2;
        continue;
      }
    }
    if (text.startsWith("\\(", i)) {
      const end = text.indexOf("\\)", i + 2);
      if (end !== -1) {
        flush();
        segments.push({ type: "math", value: text.slice(i + 2, end), display: false });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "$") {
      const end = text.indexOf("$", i + 1);
      if (end !== -1) {
        flush();
        segments.push({ type: "math", value: text.slice(i + 1, end), display: false });
        i = end + 1;
        continue;
      }
    }
    plain += text[i];
    i++;
  }

  flush();
  return segments;
}

function renderLatexNodes(input: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let text = "";
  const pushText = () => {
    if (text) {
      nodes.push(<span key={`${prefix}-t-${nodes.length}`}>{text}</span>);
      text = "";
    }
  };

  for (let i = 0; i < input.length;) {
    const char = input[i];

    if (char === "\\") {
      if (input[i + 1] === "\\") {
        text += " ";
        i += 2;
        continue;
      }

      const commandMatch = input.slice(i + 1).match(/^[A-Za-z]+/);
      const command = commandMatch?.[0] ?? input[i + 1] ?? "";
      const commandEnd = i + 1 + command.length;

      if (command === "frac" || command === "dfrac" || command === "tfrac") {
        const numerator = readLatexGroup(input, commandEnd);
        const denominator = numerator ? readLatexGroup(input, numerator.end) : null;
        if (numerator && denominator) {
          pushText();
          nodes.push(
            <span key={`${prefix}-f-${nodes.length}`} className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.95em] leading-tight">
              <span className="border-b border-current px-0.5">{renderLatexNodes(numerator.value, `${prefix}-fn-${nodes.length}`)}</span>
              <span className="px-0.5">{renderLatexNodes(denominator.value, `${prefix}-fd-${nodes.length}`)}</span>
            </span>,
          );
          i = denominator.end;
          continue;
        }
      }

      if (command === "sqrt") {
        const radicand = readLatexGroup(input, commandEnd);
        if (radicand) {
          pushText();
          nodes.push(
            <span key={`${prefix}-sqrt-${nodes.length}`} className="inline-flex items-start align-middle">
              <span className="pr-0.5 text-[1.15em] leading-none">√</span>
              <span className="border-t border-current px-0.5">{renderLatexNodes(radicand.value, `${prefix}-sqrtc-${nodes.length}`)}</span>
            </span>,
          );
          i = radicand.end;
          continue;
        }
      }

      if (command === "text" || command === "mathrm") {
        const group = readLatexGroup(input, commandEnd);
        if (group) {
          pushText();
          nodes.push(<span key={`${prefix}-text-${nodes.length}`} className="font-sans">{group.value}</span>);
          i = group.end;
          continue;
        }
      }

      if (command === "vec") {
        const group = readLatexGroup(input, commandEnd);
        if (group) {
          pushText();
          nodes.push(
            <span key={`${prefix}-vec-${nodes.length}`} className="inline-flex flex-col items-center align-middle leading-none">
              <span className="text-[0.65em] leading-none">→</span>
              <span>{renderLatexNodes(group.value, `${prefix}-vecc-${nodes.length}`)}</span>
            </span>,
          );
          i = group.end;
          continue;
        }
      }

      if (command === "bar" || command === "overline") {
        const group = readLatexGroup(input, commandEnd);
        if (group) {
          pushText();
          nodes.push(<span key={`${prefix}-bar-${nodes.length}`} className="decoration-solid" style={{ textDecoration: "overline" }}>{renderLatexNodes(group.value, `${prefix}-barc-${nodes.length}`)}</span>);
          i = group.end;
          continue;
        }
      }

      if (command === "hat") {
        const group = readLatexGroup(input, commandEnd);
        if (group) {
          pushText();
          nodes.push(
            <span key={`${prefix}-hat-${nodes.length}`} className="inline-flex flex-col items-center align-middle leading-none">
              <span className="text-[0.75em] leading-none">^</span>
              <span>{renderLatexNodes(group.value, `${prefix}-hatc-${nodes.length}`)}</span>
            </span>,
          );
          i = group.end;
          continue;
        }
      }

      if (command === "left" || command === "right" || command === "begin" || command === "end") {
        i = commandEnd;
        if (input[i] === "{") {
          const group = readLatexGroup(input, i);
          i = group?.end ?? i;
        }
        continue;
      }

      if (command === "," || command === ";" || command === "quad" || command === "qquad") {
        text += " ";
        i = commandEnd;
        continue;
      }

      const symbol = MATH_SYMBOLS[command];
      const word = MATH_WORDS.has(command) ? command : null;
      text += symbol ?? word ?? command;
      i = commandEnd;
      continue;
    }

    if ((char === "^" || char === "_") && i + 1 < input.length) {
      pushText();
      const script = readLatexScript(input, i + 1);
      nodes.push(char === "^"
        ? <sup key={`${prefix}-sup-${nodes.length}`} className="text-[0.7em] leading-none">{renderLatexNodes(script.value, `${prefix}-supc-${nodes.length}`)}</sup>
        : <sub key={`${prefix}-sub-${nodes.length}`} className="text-[0.7em] leading-none">{renderLatexNodes(script.value, `${prefix}-subc-${nodes.length}`)}</sub>);
      i = script.end;
      continue;
    }

    if (char === "{" || char === "}") {
      i++;
      continue;
    }

    if (char === "&") {
      text += " ";
      i++;
      continue;
    }

    text += char === "~" ? " " : char;
    i++;
  }

  pushText();
  return nodes.length > 0 ? nodes : [input];
}

function readLatexGroup(input: string, start: number): { value: string; end: number } | null {
  let i = start;
  while (input[i] === " ") i++;
  if (input[i] !== "{") return null;
  let depth = 1;
  let cursor = i + 1;
  while (cursor < input.length && depth > 0) {
    if (input[cursor] === "{") depth++;
    else if (input[cursor] === "}") depth--;
    cursor++;
  }
  return { value: input.slice(i + 1, Math.max(i + 1, cursor - 1)), end: cursor };
}

function readLatexScript(input: string, start: number): { value: string; end: number } {
  const group = readLatexGroup(input, start);
  if (group) return group;
  if (input[start] === "\\") {
    const command = input.slice(start + 1).match(/^[A-Za-z]+/)?.[0];
    if (command) return { value: `\\${command}`, end: start + command.length + 1 };
  }
  return { value: input[start] ?? "", end: start + 1 };
}
