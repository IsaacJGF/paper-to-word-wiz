import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Trash2,
  Copy,
  FileText,
  Image as ImageIcon,
  Sigma,
  Loader2,
  ScanLine,
  Pencil,
  ChevronDown,
  ListChecks,
  Table as TableIcon,
  Layers,
  Filter,
  Save,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { RichText } from "@/components/RichText";
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
type AdvancedFilters = {
  area_geral: string;
  conteudo_principal: string;
  subconteudo_principal: string;
  conteudos_relacionados: string[];
  prova: string;
  instituicao: string;
  ano: string;
};
type EditDraft = {
  numero: string;
  enunciado: string;
  alternativas: { letra: string; texto: string; imagem?: string | null }[];
  tipo: string;
  resposta: string;
  fonte: string;
  area_geral: string;
  conteudo_principal: string;
  subconteudo_principal: string;
  conteudos_relacionados: string[];
  tags_livres: string[];
  ano: string;
  prova: string;
  instituicao: string;
  observacoes: string;
};

type ReferenceGroupState = { items: Q[]; selected: Set<string> };

const PAGE_SIZE = 24;
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const EMPTY_ADVANCED_FILTERS: AdvancedFilters = {
  area_geral: "",
  conteudo_principal: "",
  subconteudo_principal: "",
  conteudos_relacionados: [],
  prova: "",
  instituicao: "",
  ano: "",
};

function Page() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const debouncedQuery = useDebouncedValue(q, 450);
  const [sel, setSel] = useState<Set<string>>(() => new Set(loadSelectedQuestionIds()));
  const [editing, setEditing] = useState<Q | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [expanded, setExpanded] = useState<Q | null>(null);
  const [referenceGroup, setReferenceGroup] = useState<ReferenceGroupState | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [areas, setAreas] = useState<CatalogItem[]>([]);
  const [catalogConteudos, setCatalogConteudos] = useState<CatalogItem[]>([]);
  const [subconteudos, setSubconteudos] = useState<CatalogItem[]>([]);
  const [relacionados, setRelacionados] = useState<CatalogItem[]>([]);
  const [tagsCat, setTagsCat] = useState<CatalogItem[]>([]);
  const [provas, setProvas] = useState<CatalogItem[]>([]);
  const [instituicoes, setInstituicoes] = useState<CatalogItem[]>([]);
  const [anos, setAnos] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const commitSelection = (next: Set<string>) => {
    setSel(next);
    saveSelectedQuestionIds([...next]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      let query = db.from("questions").select("*", { count: "exact" });
      query = applySupabaseFilters(query, debouncedQuery, advancedFilters);
      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) {
        console.error(error);
        toast.error("Falha ao carregar questões.");
        return;
      }
      setItems((data ?? []) as Q[]);
      setTotalCount(count ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(0); }, [debouncedQuery, advancedFilters]);
  useEffect(() => { load(); }, [page, debouncedQuery, advancedFilters]);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const tables = [
        ["catalog_areas", setAreas],
        ["catalog_conteudos", setCatalogConteudos],
        ["catalog_subconteudos", setSubconteudos],
        ["catalog_relacionados", setRelacionados],
        ["catalog_tags", setTagsCat],
        ["catalog_provas", setProvas],
        ["catalog_instituicoes", setInstituicoes],
      ] as const;
      for (const [table, setter] of tables) {
        const { data, error } = await db.from(table).select("*").order("nome");
        if (!error) setter((data ?? []) as CatalogItem[]);
      }
      const { data: yearRows } = await db.from("questions").select("ano").not("ano", "is", null).limit(2000);
      setAnos(uniqueYears((yearRows ?? []) as Array<{ ano?: string | null }>));
    })();
  }, []);

  const activeFilterCount = useMemo(() => countActiveFilters(advancedFilters), [advancedFilters]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const visibleReferenceGroups = useMemo(() => {
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

  const fetchReferenceItems = async (question: Q) => {
    if (!getReferenceKey(question)) return [question];
    if (question.grupo_id?.trim()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("questions")
        .select("*")
        .eq("grupo_id", question.grupo_id)
        .order("numero", { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) return (data as Q[]).sort(compareReferenceItems);
    }
    const key = getReferenceKey(question);
    return (key ? visibleReferenceGroups.get(key) : null) ?? [question];
  };

  const openReferenceGroup = async (question: Q) => {
    const group = await fetchReferenceItems(question);
    const selectedIds = group.filter((item) => sel.has(item.id)).map((item) => item.id);
    setReferenceGroup({ items: group, selected: new Set(selectedIds.length > 0 ? selectedIds : [question.id]) });
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
    setReferenceGroup((current) => current ? { ...current, selected: new Set(current.items.map((item) => item.id)) } : current);
  };

  const clearReferenceGroupItems = () => setReferenceGroup((current) => current ? { ...current, selected: new Set() } : current);

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

  const selectWholeReferenceGroup = async (question: Q) => {
    const group = await fetchReferenceItems(question);
    if (group.length === 0) return;
    const next = new Set(sel);
    group.forEach((item) => next.add(item.id));
    commitSelection(next);
    toast.success(`${group.length} item${group.length > 1 ? "s" : ""} da mesma referência selecionado${group.length > 1 ? "s" : ""}.`);
  };

  const openDocument = () => {
    saveSelectedQuestionIds([...sel]);
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
    const clean = cloneAdvancedFilters(EMPTY_ADVANCED_FILTERS);
    setDraftFilters(clean);
    setAdvancedFilters(clean);
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta questão? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) toast.error("Falha ao excluir");
    else {
      toast.success("Questão excluída");
      setItems((current) => current.filter((x) => x.id !== id));
      setTotalCount((current) => Math.max(0, current - 1));
      const ns = new Set(sel);
      ns.delete(id);
      commitSelection(ns);
    }
  };

  const onDuplicate = async (q: Q) => {
    const duplicated = buildDuplicatePayload(q);
    try {
      const { removedColumns } = await insertQuestionsWithCompatibility([duplicated]);
      if (removedColumns.length > 0) toast.warning("Questão duplicada. Alguns campos novos não foram gravados porque o banco ainda precisa da atualização.");
      else toast.success("Questão duplicada");
      load();
    } catch (error) {
      console.error(error);
      toast.error("Falha ao duplicar");
    }
  };

  const openQuestionEditor = (question: Q) => {
    setEditing(question);
    setEditDraft(toEditDraft(question));
  };

  const saveQuestionEdit = async () => {
    if (!editing || !editDraft) return;
    setSavingEdit(true);
    try {
      const payload = editDraftToPayload(editDraft, editing);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("questions")
        .update(payload)
        .eq("id", editing.id)
        .select("*")
        .single();
      if (error) {
        console.error(error);
        toast.error("Falha ao salvar edição.");
        return;
      }
      const updated = (data ?? { ...editing, ...payload }) as Q;
      setItems((current) => current.map((item) => item.id === editing.id ? updated : item));
      setExpanded((current) => current?.id === editing.id ? updated : current);
      setEditing(null);
      setEditDraft(null);
      toast.success("Questão atualizada.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Questões salvas</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount} questão{totalCount === 1 ? "" : "ões"} encontrada{totalCount === 1 ? "" : "s"}
              {sel.size > 0 ? ` · ${sel.size} selecionada${sel.size > 1 ? "s" : ""}` : ""}
            </p>
          </div>
          <Button asChild className="gap-2"><Link to="/"><ScanLine className="size-4" /> Nova questão</Link></Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Pesquisar por palavra ou trecho da questão..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button type="button" variant={activeFilterCount > 0 ? "default" : "outline"} onClick={openAdvancedFilters} className="gap-2 sm:w-auto">
            <Filter className="size-4" />
            {activeFilterCount > 0 ? `Filtro avançado • ${activeFilterCount} ativo${activeFilterCount > 1 ? "s" : ""}` : "Filtro avançado"}
          </Button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Busca com debounce e filtros aplicados no banco.</span>
          <span>Página {Math.min(page + 1, totalPages)} de {totalPages}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <FileText className="size-10 mx-auto text-muted-foreground mb-2" />
            <p className="font-medium">Nenhuma questão {totalCount > 0 ? "nesta página" : "encontrada"}</p>
            <p className="text-sm text-muted-foreground">Ajuste a pesquisa, limpe os filtros ou digitalize uma nova questão.</p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((it) => {
              const isSel = sel.has(it.id);
              const source = formatQuestionSource(it) || "Fonte não informada";
              const hasAlternativas = Array.isArray(it.alternativas) && it.alternativas.length > 0;
              const hasImagem = !!(it.tem_imagem || it.enunciado_imagem || it.referencia_imagem);
              const chips = getCardChips(it);
              const chipsShown = chips.slice(0, 3);
              const chipsExtra = chips.length - chipsShown.length;
              const referenceKey = getReferenceKey(it);
              const visibleReferenceItems = referenceKey ? visibleReferenceGroups.get(referenceKey) ?? [] : [];
              const hasReferenceGroup = Boolean(referenceKey);
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
                      <p className="mt-0.5 truncate text-xs font-semibold text-foreground">{source}</p>
                    </div>
                    <div className="flex shrink-0 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openQuestionEditor(it)} title="Editar questão"><Pencil className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDuplicate(it)} title="Duplicar"><Copy className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(it.id)} title="Excluir"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </div>

                  {(chipsShown.length > 0 || hasReferenceGroup) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {chipsShown.map((t) => <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{t}</Badge>)}
                      {chipsExtra > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">+{chipsExtra}</Badge>}
                      {hasReferenceGroup && <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 font-normal"><Layers className="size-3" /> {visibleReferenceItems.length > 1 ? `${visibleReferenceItems.length} visíveis` : "mesma referência"}</Badge>}
                    </div>
                  )}

                  <RichText text={it.enunciado} className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm text-foreground/90" />

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
                    <button type="button" onClick={() => setExpanded(it)} className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                      Detalhes <ChevronDown className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="outline" disabled={loading || page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Página anterior</Button>
          <span className="text-sm text-muted-foreground">{totalCount === 0 ? "0" : `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, totalCount)}`} de {totalCount}</span>
          <Button variant="outline" disabled={loading || page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima página</Button>
        </div>

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
        <QuestionDetailsDialog question={expanded} onClose={() => setExpanded(null)} onEdit={openQuestionEditor} />
        <ReferenceGroupDialog
          group={referenceGroup?.items ?? []}
          selectedIds={referenceGroup?.selected ?? new Set()}
          assessmentIds={sel}
          onToggle={toggleReferenceGroupItem}
          onSelectAll={selectAllReferenceGroupItems}
          onClear={clearReferenceGroupItems}
          onAdd={addReferenceGroupSelection}
          onClose={() => setReferenceGroup(null)}
        />
        <EditQuestionDialog
          question={editing}
          draft={editDraft}
          saving={savingEdit}
          areas={areas}
          conteudos={catalogConteudos}
          subconteudos={subconteudos}
          relacionados={relacionados}
          tags={tagsCat}
          provas={provas}
          instituicoes={instituicoes}
          onDraftChange={setEditDraft}
          onClose={() => { setEditing(null); setEditDraft(null); }}
          onSave={saveQuestionEdit}
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
            <Label htmlFor="filtro-area">Área geral</Label>
            <FilterSelect id="filtro-area" value={filters.area_geral} onChange={updateArea} options={areas} placeholder="Todas as áreas" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-conteudo">Conteúdo principal</Label>
            <FilterSelect id="filtro-conteudo" value={filters.conteudo_principal} onChange={updateConteudo} options={conteudoOptions} placeholder={filters.area_geral ? "Todos os conteúdos" : "Selecione uma área primeiro"} disabled={!filters.area_geral} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-subconteudo">Subconteúdo principal</Label>
            <FilterSelect id="filtro-subconteudo" value={filters.subconteudo_principal} onChange={(value) => update({ subconteudo_principal: value })} options={subconteudoOptions} placeholder={filters.conteudo_principal ? "Todos os subconteúdos" : "Selecione um conteúdo primeiro"} disabled={!filters.conteudo_principal} />
          </div>
          <div className="space-y-2">
            <Label>Conteúdos relacionados</Label>
            <CatalogMultiSelect values={filters.conteudos_relacionados} onChange={(values) => update({ conteudos_relacionados: values })} options={relacionados} placeholder="Buscar e adicionar conteúdos" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-prova">Prova</Label>
            <FilterSelect id="filtro-prova" value={filters.prova} onChange={(value) => update({ prova: value })} options={provas} placeholder="Todas as provas" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-instituicao">Instituição</Label>
            <FilterSelect id="filtro-instituicao" value={filters.instituicao} onChange={(value) => update({ instituicao: value })} options={instituicoes} placeholder="Todas as instituições" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-ano">Ano</Label>
            <Input id="filtro-ano" list="anos-questoes" value={filters.ano} onChange={(event) => update({ ano: event.target.value })} placeholder="Digite ou selecione o ano" />
            <datalist id="anos-questoes">{anos.map((ano) => <option key={ano} value={ano} />)}</datalist>
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

function FilterSelect({ id, value, onChange, options, placeholder, disabled }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: CatalogItem[];
  placeholder: string;
  disabled?: boolean;
}) {
  const visibleOptions = options.filter((item) => item.ativo || item.nome === value);
  return (
    <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">
      <option value="">{placeholder}</option>
      {visibleOptions.map((item) => <option key={item.id} value={item.nome}>{item.nome}{item.ativo ? "" : " (inativo)"}</option>)}
    </select>
  );
}

function EditQuestionDialog({
  question,
  draft,
  saving,
  areas,
  conteudos,
  subconteudos,
  relacionados,
  tags,
  provas,
  instituicoes,
  onDraftChange,
  onClose,
  onSave,
}: {
  question: Q | null;
  draft: EditDraft | null;
  saving: boolean;
  areas: CatalogItem[];
  conteudos: CatalogItem[];
  subconteudos: CatalogItem[];
  relacionados: CatalogItem[];
  tags: CatalogItem[];
  provas: CatalogItem[];
  instituicoes: CatalogItem[];
  onDraftChange: (draft: EditDraft | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!question || !draft) return null;
  const area = areas.find((item) => item.nome === draft.area_geral);
  const conteudoOptions = area ? conteudos.filter((item) => item.area_id === area.id) : [];
  const conteudo = conteudoOptions.find((item) => item.nome === draft.conteudo_principal);
  const subOptions = conteudo ? subconteudos.filter((item) => item.conteudo_id === conteudo.id) : [];
  const patch = (partial: Partial<EditDraft>) => onDraftChange({ ...draft, ...partial });
  const updateAlt = (index: number, partial: Partial<EditDraft["alternativas"][number]>) => {
    const next = [...draft.alternativas];
    next[index] = { ...next[index], ...partial };
    patch({ alternativas: next });
  };
  const addAlt = () => patch({ alternativas: reletterAlternatives([...draft.alternativas, { letra: LETTERS[draft.alternativas.length] ?? "X", texto: "" }]) });
  const removeAlt = (index: number) => patch({ alternativas: reletterAlternatives(draft.alternativas.filter((_, i) => i !== index)) });

  return (
    <Dialog open={!!question} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar questão</DialogTitle>
          <DialogDescription>
            Edite enunciado, alternativas, gabarito e metadados. A referência/texto-base não é alterada aqui.
          </DialogDescription>
        </DialogHeader>

        {(question.referencia_texto || question.referencia_imagem) && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Esta questão possui referência vinculada. Para evitar quebrar grupos de itens, a referência fica bloqueada nesta edição.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <select value={draft.tipo} onChange={(event) => patch({ tipo: event.target.value })} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
              <option value="multipla_escolha">Múltipla escolha</option>
              <option value="certo_errado">Certo ou errado</option>
              <option value="numerica">Numérica</option>
              <option value="discursiva">Discursiva</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Número do item</Label>
            <Input value={draft.numero} onChange={(event) => patch({ numero: event.target.value })} placeholder="Ex.: 68" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Enunciado</Label>
          <Textarea value={draft.enunciado} onChange={(event) => patch({ enunciado: event.target.value })} rows={8} className="font-mono text-sm" />
          <div className="rounded-md border bg-muted/20 p-3 text-sm"><RichText text={draft.enunciado} /></div>
        </div>

        {draft.tipo === "multipla_escolha" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Alternativas</Label>
              <Button type="button" size="sm" variant="outline" onClick={addAlt} className="gap-1"><Plus className="size-3" /> Adicionar</Button>
            </div>
            <div className="space-y-2">
              {draft.alternativas.map((alt, index) => (
                <div key={index} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[60px_1fr_auto]">
                  <Input value={alt.letra} onChange={(event) => updateAlt(index, { letra: event.target.value })} className="text-center font-bold" />
                  <Textarea value={alt.texto} onChange={(event) => updateAlt(index, { texto: event.target.value })} rows={2} />
                  <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeAlt(index)}><X className="size-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Gabarito</Label>
            <Input value={draft.resposta} onChange={(event) => patch({ resposta: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Fonte específica do item</Label>
            <Input value={draft.fonte} onChange={(event) => patch({ fonte: event.target.value })} placeholder="Ex.: banca/ano, se houver" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Área geral</Label>
            <FilterSelect id="edit-area" value={draft.area_geral} onChange={(value) => patch({ area_geral: value, conteudo_principal: "", subconteudo_principal: "" })} options={areas} placeholder="Selecione" />
          </div>
          <div className="space-y-2">
            <Label>Conteúdo principal</Label>
            <FilterSelect id="edit-conteudo" value={draft.conteudo_principal} onChange={(value) => patch({ conteudo_principal: value, subconteudo_principal: "" })} options={conteudoOptions} placeholder={draft.area_geral ? "Selecione" : "Escolha área"} disabled={!draft.area_geral} />
          </div>
          <div className="space-y-2">
            <Label>Subconteúdo principal</Label>
            <FilterSelect id="edit-sub" value={draft.subconteudo_principal} onChange={(value) => patch({ subconteudo_principal: value })} options={subOptions} placeholder={draft.conteudo_principal ? "Selecione" : "Escolha conteúdo"} disabled={!draft.conteudo_principal} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Conteúdos relacionados</Label>
            <CatalogMultiSelect values={draft.conteudos_relacionados} onChange={(values) => patch({ conteudos_relacionados: values })} options={relacionados} placeholder="Buscar conteúdos relacionados" />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <CatalogMultiSelect values={draft.tags_livres} onChange={(values) => patch({ tags_livres: values })} options={tags} placeholder="Buscar tags" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Prova</Label>
            <FilterSelect id="edit-prova" value={draft.prova} onChange={(value) => patch({ prova: value })} options={provas} placeholder="Selecione" />
          </div>
          <div className="space-y-2">
            <Label>Instituição</Label>
            <FilterSelect id="edit-instituicao" value={draft.instituicao} onChange={(value) => patch({ instituicao: value })} options={instituicoes} placeholder="Selecione" />
          </div>
          <div className="space-y-2">
            <Label>Ano</Label>
            <Input value={draft.ano} onChange={(event) => patch({ ano: event.target.value })} placeholder="Ex.: 2024" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={draft.observacoes} onChange={(event) => patch({ observacoes: event.target.value })} rows={3} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar edição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionDetailsDialog({ question, onClose, onEdit }: { question: Q | null; onClose: () => void; onEdit: (question: Q) => void }) {
  if (!question) return null;
  const hasReference = Boolean(question.referencia_texto || question.referencia_texto_apos || question.referencia_imagem);
  return (
    <Dialog open={!!question} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formatQuestionSource(question) || "Questão"}</DialogTitle>
          <DialogDescription>{formatTipo(question.tipo)}{question.numero ? ` · Item ${question.numero}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {hasReference && (
            <section className="rounded-lg border bg-muted/20 p-3">
              <h3 className="mb-2 text-sm font-semibold">Referência</h3>
              {question.referencia_texto && <RichText text={question.referencia_texto} className="text-sm" />}
              {question.referencia_imagem && <img src={question.referencia_imagem} alt="Referência" className="my-2 max-h-96 max-w-full rounded border object-contain" />}
              {question.referencia_texto_apos && <RichText text={question.referencia_texto_apos} className="text-sm" />}
              {question.referencia_fonte && <p className="mt-2 text-right text-xs text-muted-foreground">{question.referencia_fonte}</p>}
            </section>
          )}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Enunciado</h3>
            <RichText text={question.enunciado} className="text-sm" />
            {question.enunciado_imagem && <img src={question.enunciado_imagem} alt="Enunciado" className="my-2 max-h-96 max-w-full rounded border object-contain" />}
          </section>
          {question.alternativas?.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Alternativas</h3>
              <div className="space-y-2">
                {question.alternativas.map((alt) => (
                  <div key={alt.letra} className="rounded-md border p-2 text-sm">
                    <strong>{alt.letra}) </strong><RichText text={alt.texto} className="inline" />
                    {alt.imagem && <img src={alt.imagem} alt={`Alternativa ${alt.letra}`} className="mt-2 max-h-60 max-w-full rounded border object-contain" />}
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:grid-cols-2">
            <p><strong>Área:</strong> {question.area_geral || "—"}</p>
            <p><strong>Conteúdo:</strong> {question.conteudo_principal || "—"}</p>
            <p><strong>Subconteúdo:</strong> {question.subconteudo_principal || "—"}</p>
            <p><strong>Gabarito:</strong> {question.resposta || "—"}</p>
            <p><strong>Prova:</strong> {question.prova || "—"}</p>
            <p><strong>Instituição:</strong> {question.instituicao || "—"}</p>
            <p><strong>Ano:</strong> {question.ano || "—"}</p>
            <p><strong>Tags:</strong> {(question.tags_livres ?? question.tags ?? []).join(", ") || "—"}</p>
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => { onClose(); onEdit(question); }} className="gap-2"><Pencil className="size-4" /> Editar questão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReferenceGroupDialog({ group, selectedIds, assessmentIds, onToggle, onSelectAll, onClear, onAdd, onClose }: {
  group: Q[];
  selectedIds: Set<string>;
  assessmentIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const first = group[0];
  return (
    <Dialog open={group.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Itens da mesma referência</DialogTitle>
          <DialogDescription>Selecione itens individuais ou adicione todo o grupo à avaliação.</DialogDescription>
        </DialogHeader>
        {first && (
          <div className="rounded-lg border bg-muted/20 p-3">
            {first.referencia_texto && <RichText text={first.referencia_texto} className="text-sm" />}
            {first.referencia_imagem && <img src={first.referencia_imagem} alt="Referência" className="my-2 max-h-96 max-w-full rounded border object-contain" />}
            {first.referencia_texto_apos && <RichText text={first.referencia_texto_apos} className="text-sm" />}
            {first.referencia_fonte && <p className="mt-2 text-right text-xs text-muted-foreground">{first.referencia_fonte}</p>}
          </div>
        )}
        <div className="space-y-3">
          {group.map((item) => (
            <div key={item.id} className="rounded-lg border p-3" title={metadataTooltip(item)}>
              <div className="mb-2 flex items-start gap-2">
                <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={(value) => onToggle(item.id, Boolean(value))} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{item.numero ? `Item ${item.numero}` : "Item"}</strong>
                    {assessmentIds.has(item.id) && <Badge variant="secondary">já selecionado</Badge>}
                    <CompactPedagogicalInfo question={item} />
                  </div>
                  <RichText text={item.enunciado} className="mt-2 text-sm" />
                  {item.enunciado_imagem && <img src={item.enunciado_imagem} alt="Imagem do item" className="mt-2 max-h-80 max-w-full rounded border object-contain" />}
                  {item.alternativas?.length > 0 && (
                    <div className="mt-2 space-y-1 text-sm">
                      {item.alternativas.map((alt) => <div key={alt.letra}><strong>{alt.letra}) </strong><RichText text={alt.texto} className="inline" /></div>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onSelectAll}>Selecionar todos</Button>
            <Button type="button" variant="ghost" onClick={onClear}>Limpar</Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
            <Button type="button" onClick={onAdd}>Adicionar selecionados</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompactPedagogicalInfo({ question }: { question: Q }) {
  const entries = getPedagogicalEntries(question);
  const shown = entries.slice(0, 2);
  const hidden = entries.length - shown.length;
  const title = metadataTooltip(question);
  if (entries.length === 0 && !question.resposta) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">Sem conteúdo vinculado</Badge>;
  return (
    <div className="flex flex-wrap gap-1" title={title}>
      {shown.map((entry) => <Badge key={`${entry.label}-${entry.value}`} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{entry.value}</Badge>)}
      {hidden > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">+{hidden}</Badge>}
    </div>
  );
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySupabaseFilters(query: any, term: string, filters: AdvancedFilters) {
  const search = sanitizeSearchTerm(term);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or([
      `enunciado.ilike.${pattern}`,
      `referencia_texto.ilike.${pattern}`,
      `referencia_texto_apos.ilike.${pattern}`,
      `observacoes.ilike.${pattern}`,
      `fonte.ilike.${pattern}`,
      `prova.ilike.${pattern}`,
      `instituicao.ilike.${pattern}`,
    ].join(","));
  }
  if (filters.area_geral) query = query.eq("area_geral", filters.area_geral);
  if (filters.conteudo_principal) query = query.eq("conteudo_principal", filters.conteudo_principal);
  if (filters.subconteudo_principal) query = query.eq("subconteudo_principal", filters.subconteudo_principal);
  if (filters.conteudos_relacionados.length > 0) query = query.contains("conteudos_relacionados", filters.conteudos_relacionados);
  if (filters.prova) query = query.eq("prova", filters.prova);
  if (filters.instituicao) query = query.eq("instituicao", filters.instituicao);
  if (filters.ano) query = query.eq("ano", filters.ano.trim());
  return query;
}

function sanitizeSearchTerm(value: string) {
  return value.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ");
}

function cloneAdvancedFilters(filters: AdvancedFilters): AdvancedFilters {
  return { ...filters, conteudos_relacionados: [...filters.conteudos_relacionados] };
}

function countActiveFilters(filters: AdvancedFilters) {
  return [filters.area_geral, filters.conteudo_principal, filters.subconteudo_principal, filters.conteudos_relacionados.length > 0 ? "relacionados" : "", filters.prova, filters.instituicao, filters.ano].filter(Boolean).length;
}

function getConteudos(question: Q) {
  const principal = (question.conteudo_principal ?? "").trim();
  const sub = (question.subconteudo_principal ?? "").trim();
  const related = (question.conteudos_relacionados ?? []).map((s) => s.trim()).filter(Boolean);
  const direct = splitConteudos(question.conteudo);
  const all = [principal, sub, ...related, ...direct].filter(Boolean);
  return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function splitConteudos(value: string | null | undefined) {
  return (value ?? "").split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
}

function formatTipo(tipo: string) {
  const labels: Record<string, string> = { multipla_escolha: "Múltipla escolha", certo_errado: "Certo ou errado", numerica: "Numérica", discursiva: "Discursiva" };
  return labels[tipo] ?? tipo;
}

function formatQuestionSource(question: Pick<Q, "prova" | "instituicao" | "ano">) {
  return [question.prova, question.instituicao, question.ano].map((item) => item?.trim()).filter(Boolean).join(" - ");
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
  for (const value of question.conteudos_relacionados ?? []) if (value?.trim()) entries.push({ label: "Relacionado", value: value.trim() });
  for (const value of question.tags_livres ?? question.tags ?? []) if (value?.trim()) entries.push({ label: "Tag", value: value.trim() });
  if (entries.length === 0) for (const value of splitConteudos(question.conteudo)) entries.push({ label: "Conteúdo", value });
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

function getReferenceKey(question: ReferenceLike) {
  const hasReference = Boolean(question.referencia_texto?.trim() || question.referencia_texto_apos?.trim() || question.referencia_imagem);
  if (!hasReference) return null;
  if (question.grupo_id?.trim()) return `grupo:${question.grupo_id.trim()}`;
  const imageKey = question.referencia_imagem ? `${question.referencia_imagem.length}:${question.referencia_imagem.slice(0, 32)}:${question.referencia_imagem.slice(-32)}` : "";
  return [question.referencia_texto?.trim() ?? "", question.referencia_texto_apos?.trim() ?? "", question.referencia_fonte?.trim() ?? "", imageKey].join("|");
}

function compareReferenceItems(a: Q, b: Q) {
  const na = Number.parseInt(a.numero ?? "", 10);
  const nb = Number.parseInt(b.numero ?? "", 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function uniqueYears(rows: Array<{ ano?: string | null }>) {
  const set = new Set<string>();
  rows.forEach((row) => { if (row.ano?.trim()) set.add(row.ano.trim()); });
  return [...set].sort((a, b) => b.localeCompare(a, "pt-BR", { numeric: true }));
}

function toEditDraft(question: Q): EditDraft {
  return {
    numero: question.numero ?? "",
    enunciado: question.enunciado ?? "",
    alternativas: Array.isArray(question.alternativas) ? question.alternativas.map((alt) => ({ letra: alt.letra ?? "", texto: alt.texto ?? "", imagem: alt.imagem ?? null })) : [],
    tipo: question.tipo ?? "discursiva",
    resposta: question.resposta ?? "",
    fonte: question.fonte ?? "",
    area_geral: question.area_geral ?? "",
    conteudo_principal: question.conteudo_principal ?? "",
    subconteudo_principal: question.subconteudo_principal ?? "",
    conteudos_relacionados: question.conteudos_relacionados ?? [],
    tags_livres: question.tags_livres ?? question.tags ?? [],
    ano: question.ano ?? "",
    prova: question.prova ?? "",
    instituicao: question.instituicao ?? "",
    observacoes: question.observacoes ?? "",
  };
}

function editDraftToPayload(draft: EditDraft, original: Q) {
  const alternativas = draft.tipo === "multipla_escolha" ? reletterAlternatives(draft.alternativas) : [];
  const textForMath = [draft.enunciado, ...alternativas.map((alt) => alt.texto)].join("\n");
  const hasImage = Boolean(original.referencia_imagem || original.enunciado_imagem || alternativas.some((alt) => alt.imagem));
  return {
    numero: draft.numero.trim() || null,
    enunciado: draft.enunciado,
    alternativas,
    tipo: draft.tipo,
    resposta: draft.resposta.trim() || null,
    fonte: draft.fonte.trim() || null,
    disciplina: draft.area_geral || null,
    conteudo: draft.conteudo_principal || null,
    area_geral: draft.area_geral || null,
    conteudo_principal: draft.conteudo_principal || null,
    subconteudo_principal: draft.subconteudo_principal || null,
    conteudos_relacionados: draft.conteudos_relacionados,
    tags_livres: draft.tags_livres,
    tags: draft.tags_livres,
    ano: draft.ano.trim() || null,
    prova: draft.prova || null,
    instituicao: draft.instituicao || null,
    observacoes: draft.observacoes.trim() || null,
    tem_equacao: containsMath(textForMath),
    tem_imagem: hasImage,
  };
}

function reletterAlternatives(alts: EditDraft["alternativas"]) {
  return alts.map((alt, index) => ({ ...alt, letra: alt.letra?.trim() || LETTERS[index] || String(index + 1), texto: alt.texto ?? "" }));
}

function containsMath(value: string) {
  return /\$[^$]+\$|\\frac|\\sqrt|\^\{|_\{|[=≈≤≥]/.test(value);
}

function buildDuplicatePayload(q: Q) {
  return {
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
}
