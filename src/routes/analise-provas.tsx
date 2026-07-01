import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  FileSearch,
  Filter,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Sigma,
  Sparkles,
  TextSearch,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { AnalysisCrossPanel } from "@/components/AnalysisCrossPanel";
import { AnalysisDataQualityPanel } from "@/components/AnalysisDataQualityPanel";
import { AnalysisDeepAIPanel } from "@/components/AnalysisDeepAIPanel";
import { AnalysisGeneralSummaryPanel } from "@/components/AnalysisAISummaryPanel";
import { AnalysisLanguagePanel } from "@/components/AnalysisLanguagePanel";
import { AnalysisReferencePanel } from "@/components/AnalysisReferencePanel";
import { AnalysisSimulationSuggestionPanel } from "@/components/AnalysisSimulationSuggestionPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { analyzeProvaQuestions, type FrequencyRow, type ProvaAnalysisQuestion, type ProvaAnalysisSummary } from "@/lib/prova-analysis";
import { toast } from "sonner";

export const Route = createFileRoute("/analise-provas")({
  head: () => ({ meta: [{ title: "Análise de Provas" }] }),
  component: Page,
});

type CatalogItem = { id: string; nome: string; ativo: boolean; area_id?: string | null; conteudo_id?: string | null };
type AnalysisFilters = {
  prova: string;
  instituicao: string;
  anoInicial: string;
  anoFinal: string;
  areaGeral: string;
  conteudoPrincipal: string;
  subconteudoPrincipal: string;
  tipo: string;
};
type QuestionRow = ProvaAnalysisQuestion;
type MatrixRow = { content: string; byYear: Record<string, number>; total: number };
type AnalysisTab = "geral" | "conteudos" | "linguagem" | "referencias" | "cruzamentos" | "ia" | "qualidade";

const EMPTY_FILTERS: AnalysisFilters = {
  prova: "", instituicao: "", anoInicial: "", anoFinal: "",
  areaGeral: "", conteudoPrincipal: "", subconteudoPrincipal: "", tipo: "",
};

const TYPE_OPTIONS = [
  { value: "multipla_escolha", label: "Múltipla escolha" },
  { value: "certo_errado", label: "Certo ou errado" },
  { value: "numerica", label: "Numérica" },
  { value: "discursiva", label: "Discursiva" },
];

const ANALYSIS_COLUMNS = [
  "id", "numero", "enunciado", "tipo", "resposta", "ano", "prova", "instituicao",
  "area_geral", "conteudo_principal", "subconteudo_principal", "conteudos_relacionados",
  "tags_livres", "tags", "grupo_id", "referencia_texto", "referencia_texto_apos",
  "referencia_imagem", "enunciado_imagem", "tem_imagem", "tem_equacao", "alternativas",
].join(",");

const DONUT_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#64748b"];

function Page() {
  const [filters, setFilters] = useState<AnalysisFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AnalysisFilters>(EMPTY_FILTERS);
  const [areas, setAreas] = useState<CatalogItem[]>([]);
  const [conteudos, setConteudos] = useState<CatalogItem[]>([]);
  const [subconteudos, setSubconteudos] = useState<CatalogItem[]>([]);
  const [provas, setProvas] = useState<CatalogItem[]>([]);
  const [instituicoes, setInstituicoes] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ProvaAnalysisSummary | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const tables = [
        ["catalog_areas", setAreas],
        ["catalog_conteudos", setConteudos],
        ["catalog_subconteudos", setSubconteudos],
        ["catalog_provas", setProvas],
        ["catalog_instituicoes", setInstituicoes],
      ] as const;
      for (const [table, setter] of tables) {
        const { data, error } = await db.from(table).select("*").order("nome");
        if (!error) setter((data ?? []) as CatalogItem[]);
      }
    })();
  }, []);

  const selectedArea = areas.find((item) => item.nome === filters.areaGeral);
  const conteudoOptions = selectedArea ? conteudos.filter((item) => item.area_id === selectedArea.id) : conteudos;
  const selectedConteudo = conteudoOptions.find((item) => item.nome === filters.conteudoPrincipal);
  const subconteudoOptions = selectedConteudo ? subconteudos.filter((item) => item.conteudo_id === selectedConteudo.id) : subconteudos;
  const activeFilterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);
  const appliedFilterCount = useMemo(() => Object.values(appliedFilters).filter(Boolean).length, [appliedFilters]);

  const updateFilter = <K extends keyof AnalysisFilters>(key: K, value: AnalysisFilters[K]) => {
    if (key === "areaGeral") {
      setFilters((c) => ({ ...c, areaGeral: value, conteudoPrincipal: "", subconteudoPrincipal: "" }));
      return;
    }
    if (key === "conteudoPrincipal") {
      setFilters((c) => ({ ...c, conteudoPrincipal: value, subconteudoPrincipal: "" }));
      return;
    }
    setFilters((c) => ({ ...c, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSummary(null);
    setHasAnalyzed(false);
  };

  const analyze = async () => {
    const normalizedFilters = normalizeFilters(filters);
    if (!isValidYearRange(normalizedFilters)) {
      toast.error("Confira o intervalo de anos antes de analisar.");
      return;
    }
    setLoading(true);
    setHasAnalyzed(true);
    setAppliedFilters(normalizedFilters);
    setFilterOpen(false);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      let query = db.from("questions").select(ANALYSIS_COLUMNS);
      query = applyFiltersToQuery(query, normalizedFilters);
      const { data, error } = await query.order("ano", { ascending: true }).order("created_at", { ascending: true });
      if (error) {
        console.error("Erro ao consultar questões para análise:", error);
        toast.error("Não foi possível carregar as questões para análise.");
        setSummary(null);
        return;
      }
      setSummary(analyzeProvaQuestions((data ?? []) as QuestionRow[]));
    } finally {
      setLoading(false);
    }
  };

  const appliedChips = buildFilterChips(appliedFilters);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Compact header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Análise de Provas</h1>
            <p className="text-sm text-muted-foreground">Padrões de conteúdo, linguagem e cobrança da banca.</p>
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="size-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>Refine a base de questões analisadas.</SheetDescription>
                </SheetHeader>
                <div className="grid gap-3 py-4">
                  <FilterSelect label="Prova" value={filters.prova} onChange={(v) => updateFilter("prova", v)} options={provas} placeholder="Todas" />
                  <FilterSelect label="Instituição" value={filters.instituicao} onChange={(v) => updateFilter("instituicao", v)} options={instituicoes} placeholder="Todas" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Ano inicial</Label>
                      <Input value={filters.anoInicial} onChange={(e) => updateFilter("anoInicial", onlyYearDigits(e.target.value))} placeholder="2018" inputMode="numeric" maxLength={4} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Ano final</Label>
                      <Input value={filters.anoFinal} onChange={(e) => updateFilter("anoFinal", onlyYearDigits(e.target.value))} placeholder="2024" inputMode="numeric" maxLength={4} />
                    </div>
                  </div>
                  <FilterSelect label="Área geral" value={filters.areaGeral} onChange={(v) => updateFilter("areaGeral", v)} options={areas} placeholder="Todas" />
                  <FilterSelect label="Conteúdo principal" value={filters.conteudoPrincipal} onChange={(v) => updateFilter("conteudoPrincipal", v)} options={conteudoOptions} placeholder="Todos" disabled={Boolean(filters.areaGeral) && conteudoOptions.length === 0} />
                  <FilterSelect label="Subconteúdo" value={filters.subconteudoPrincipal} onChange={(v) => updateFilter("subconteudoPrincipal", v)} options={subconteudoOptions} placeholder="Todos" disabled={Boolean(filters.conteudoPrincipal) && subconteudoOptions.length === 0} />
                  <div className="space-y-1.5">
                    <Label>Tipo de questão</Label>
                    <select value={filters.tipo} onChange={(e) => updateFilter("tipo", e.target.value)} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
                      <option value="">Todos</option>
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <SheetFooter className="gap-2 sm:justify-between">
                  <Button variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Limpar campos</Button>
                  <Button onClick={analyze} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}
                    Analisar
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            {hasAnalyzed && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
            )}
            <Button size="sm" onClick={analyze} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}
              Analisar
            </Button>
          </div>
        </div>

        {/* Applied filter chips */}
        {appliedFilterCount > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Filtros:</span>
            {appliedChips.map((chip) => (
              <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
                <span className="text-muted-foreground">{chip.label}:</span>
                <strong className="font-medium">{chip.value}</strong>
              </span>
            ))}
          </div>
        )}

        {/* Results */}
        {!hasAnalyzed && <EmptyState text="Selecione filtros (opcional) e clique em Analisar para ver os padrões da prova." />}

        {hasAnalyzed && loading && (
          <div className="flex items-center justify-center rounded-xl border bg-card py-20 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" /> Analisando questões...
          </div>
        )}

        {hasAnalyzed && !loading && summary && summary.total === 0 && (
          <EmptyState text="Nenhuma questão encontrada. Revise os filtros ou cadastre metadados nas questões." />
        )}

        {hasAnalyzed && !loading && summary && summary.total > 0 && (
          <AnalysisResult summary={summary} filters={appliedFilters} />
        )}
      </div>
    </AppLayout>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: CatalogItem[]; placeholder: string; disabled?: boolean;
}) {
  const visible = options.filter((i) => i.ativo || i.nome === value);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">
        <option value="">{placeholder}</option>
        {visible.map((i) => <option key={i.id} value={i.nome}>{i.nome}{i.ativo ? "" : " (inativo)"}</option>)}
      </select>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card px-4 py-16 text-center">
      <BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground/60" />
      <p className="mx-auto max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function AnalysisResult({ summary, filters }: { summary: ProvaAnalysisSummary; filters: AnalysisFilters }) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("geral");
  const period = formatPeriod(filters, summary.years);

  return (
    <div className="space-y-4">
      {summary.total < 10 && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <strong>Amostra pequena ({summary.total}):</strong> as tendências podem não representar um padrão sólido.
        </div>
      )}

      <SummaryStrip summary={summary} period={period} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AnalysisTab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="conteudos">Conteúdos</TabsTrigger>
          <TabsTrigger value="linguagem">Linguagem</TabsTrigger>
          <TabsTrigger value="referencias">Textos-base</TabsTrigger>
          <TabsTrigger value="cruzamentos">Cruzamentos</TabsTrigger>
          <TabsTrigger value="ia" className="gap-1"><Sparkles className="size-3.5" />IA</TabsTrigger>
          <TabsTrigger value="qualidade">Qualidade</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <HorizontalBarChart title="Conteúdos mais cobrados" rows={summary.contentFrequency} emptyText="Nenhum conteúdo principal encontrado." />
            <TypeBreakdownCard summary={summary} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <VerticalBarChart title="Questões por ano" rows={summary.questionsByYear} />
            <DonutChart title="Distribuição por área" rows={summary.areaFrequency} total={summary.total} />
          </div>
        </TabsContent>

        <TabsContent value="conteudos" className="mt-4 space-y-4">
          <HeatmapChart title="Mapa Ano × Conteúdo" {...buildContentYearMatrix(summary)} />
          <div className="grid gap-4 lg:grid-cols-2">
            <VisualFrequencyTable title="Conteúdos" rows={summary.contentFrequency} total={summary.total} highlightFirst />
            <VisualFrequencyTable title="Subconteúdos" rows={summary.subcontentFrequency} total={summary.total} highlightFirst />
            <VisualFrequencyTable title="Tags" rows={summary.tagFrequency} total={summary.total} emptyText="Nenhuma tag cadastrada." />
            <VisualFrequencyTable title="Conteúdos relacionados" rows={summary.relatedContentFrequency} total={summary.total} emptyText="Nenhum relacionado cadastrado." />
          </div>
        </TabsContent>

        <TabsContent value="linguagem" className="mt-4"><AnalysisLanguagePanel summary={summary} /></TabsContent>
        <TabsContent value="referencias" className="mt-4"><AnalysisReferencePanel summary={summary} /></TabsContent>
        <TabsContent value="cruzamentos" className="mt-4"><AnalysisCrossPanel summary={summary} /></TabsContent>
        <TabsContent value="ia" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <AnalysisGeneralSummaryPanel summary={summary} />
            <AnalysisSimulationSuggestionPanel summary={summary} />
          </div>
          <AnalysisDeepAIPanel summary={summary} filters={filters} />
        </TabsContent>
        <TabsContent value="qualidade" className="mt-4"><AnalysisDataQualityPanel summary={summary} /></TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryStrip({ summary, period }: { summary: ProvaAnalysisSummary; period: string }) {
  const stats = [
    { label: "Questões", value: summary.total, icon: <FileSearch className="size-4" /> },
    { label: "Anos", value: summary.years.length, hint: period, icon: <BarChart3 className="size-4" /> },
    { label: "Com referência", value: summary.withReference, hint: percentage(summary.withReference, summary.total), icon: <TextSearch className="size-4" /> },
    { label: "Com imagem", value: summary.withImage, hint: percentage(summary.withImage, summary.total), icon: <ImageIcon className="size-4" /> },
    { label: "Com alternativas", value: summary.withAlternatives, hint: percentage(summary.withAlternatives, summary.total), icon: <ListChecks className="size-4" /> },
    { label: "Com equação", value: summary.withEquation, hint: percentage(summary.withEquation, summary.total), icon: <Sigma className="size-4" /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-2 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg px-3 py-2 hover:bg-muted/40">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {s.icon}
            {s.label}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{s.value}</span>
            {s.hint && <span className="text-xs text-muted-foreground">{s.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypeBreakdownCard({ summary }: { summary: ProvaAnalysisSummary }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Por tipo de questão</h2>
      <div className="space-y-2.5">
        {summary.typeCounts.map((item) => (
          <div key={item.value}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{formatType(item.value)}</span>
              <span><strong className="tabular-nums">{item.count}</strong> · {formatPercent(item.percent)}</span>
            </div>
            <ProgressBar percent={item.percent} />
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBarChart({ title, rows, emptyText }: { title: string; rows: FrequencyRow[]; emptyText: string }) {
  const visible = rows.filter((r) => r.count > 0).slice(0, 10);
  const max = Math.max(...visible.map((r) => r.count), 0);
  return (
    <ChartCard title={title}>
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : (
        <div className="space-y-2.5">
          {visible.map((row) => (
            <div key={row.value} className="grid gap-2 sm:grid-cols-[160px_1fr_80px] sm:items-center">
              <span className="line-clamp-1 text-sm" title={row.value}>{row.value}</span>
              <ProgressBar percent={max > 0 ? (row.count / max) * 100 : 0} />
              <span className="text-right text-xs text-muted-foreground tabular-nums">{row.count} · {formatPercent(row.percent)}</span>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function VerticalBarChart({ title, rows }: { title: string; rows: Array<{ year: string; count: number }> }) {
  const visible = rows.filter((r) => r.count > 0).slice(-12);
  const max = Math.max(...visible.map((r) => r.count), 0);
  return (
    <ChartCard title={title}>
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum ano informado.</p> : (
        <div className="flex h-56 items-end gap-2 overflow-x-auto rounded-lg bg-muted/20 p-3">
          {visible.map((row) => (
            <div key={row.year} className="flex min-w-10 flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-xs font-semibold tabular-nums">{row.count}</span>
              <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(6, max > 0 ? (row.count / max) * 160 : 0)}px` }} />
              <span className="text-[11px] text-muted-foreground">{row.year}</span>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function DonutChart({ title, rows, total }: { title: string; rows: FrequencyRow[]; total: number }) {
  const visible = rows.filter((r) => r.count > 0).slice(0, 6);
  const gradient = buildDonutGradient(visible, total);
  return (
    <ChartCard title={title}>
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma área encontrada.</p> : (
        <div className="grid gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
          <div className="relative mx-auto size-32 rounded-full" style={{ background: gradient }}>
            <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-card">
              <strong className="text-xl tabular-nums">{total}</strong>
              <span className="text-[10px] text-muted-foreground">questões</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {visible.map((row, i) => (
              <div key={row.value} className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="line-clamp-1">{row.value}</span>
                </span>
                <strong className="tabular-nums">{formatPercent(row.percent)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function HeatmapChart({ title, years, rows }: { title: string; years: string[]; rows: MatrixRow[] }) {
  const max = Math.max(...rows.flatMap((r) => Object.values(r.byYear)), 0);
  return (
    <ChartCard title={title}>
      {years.length === 0 || rows.length === 0 ? <p className="text-sm text-muted-foreground">Dados insuficientes.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="sticky left-0 bg-card py-2 pr-2 text-left font-medium">Conteúdo</th>
                {years.map((y) => <th key={y} className="px-2 py-2 text-center font-medium">{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.content} className="border-b last:border-0">
                  <td className="sticky left-0 max-w-52 bg-card py-2 pr-2 text-sm"><span className="line-clamp-1" title={row.content}>{row.content}</span></td>
                  {years.map((y) => {
                    const v = row.byYear[y] ?? 0;
                    return (
                      <td key={y} className="p-1 text-center">
                        <span className="inline-flex h-7 w-full items-center justify-center rounded text-xs font-semibold tabular-nums" style={{ backgroundColor: heatmapCellColor(v, max) }}>
                          {v || ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function VisualFrequencyTable({ title, rows, total, emptyText = "Sem dados.", highlightFirst }: { title: string; rows: FrequencyRow[]; total: number; emptyText?: string; highlightFirst?: boolean }) {
  const visible = rows.slice(0, 10);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">Base: {total}</span>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {visible.map((row, i) => (
            <div key={row.value} className="group">
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 truncate">
                  {highlightFirst && i === 0 && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">#1</span>}
                  <span className="truncate" title={row.value}>{row.value}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{row.count} · {formatPercent(row.percent)}</span>
              </div>
              <ProgressBar percent={row.percent} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
    </div>
  );
}

function buildFilterChips(f: AnalysisFilters): Array<{ key: string; label: string; value: string }> {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (f.prova) chips.push({ key: "prova", label: "Prova", value: f.prova });
  if (f.instituicao) chips.push({ key: "instituicao", label: "Instituição", value: f.instituicao });
  if (f.anoInicial || f.anoFinal) chips.push({ key: "ano", label: "Período", value: `${f.anoInicial || "…"}–${f.anoFinal || "…"}` });
  if (f.areaGeral) chips.push({ key: "areaGeral", label: "Área", value: f.areaGeral });
  if (f.conteudoPrincipal) chips.push({ key: "conteudoPrincipal", label: "Conteúdo", value: f.conteudoPrincipal });
  if (f.subconteudoPrincipal) chips.push({ key: "subconteudoPrincipal", label: "Subconteúdo", value: f.subconteudoPrincipal });
  if (f.tipo) chips.push({ key: "tipo", label: "Tipo", value: formatType(f.tipo) });
  return chips;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFiltersToQuery(query: any, filters: AnalysisFilters) {
  if (filters.prova) query = query.eq("prova", filters.prova);
  if (filters.instituicao) query = query.eq("instituicao", filters.instituicao);
  if (filters.anoInicial) query = query.gte("ano", filters.anoInicial);
  if (filters.anoFinal) query = query.lte("ano", filters.anoFinal);
  if (filters.areaGeral) query = query.eq("area_geral", filters.areaGeral);
  if (filters.conteudoPrincipal) query = query.eq("conteudo_principal", filters.conteudoPrincipal);
  if (filters.subconteudoPrincipal) query = query.eq("subconteudo_principal", filters.subconteudoPrincipal);
  if (filters.tipo) query = query.eq("tipo", filters.tipo);
  return query;
}

function normalizeFilters(f: AnalysisFilters): AnalysisFilters {
  return {
    prova: f.prova.trim(), instituicao: f.instituicao.trim(),
    anoInicial: f.anoInicial.trim(), anoFinal: f.anoFinal.trim(),
    areaGeral: f.areaGeral.trim(), conteudoPrincipal: f.conteudoPrincipal.trim(),
    subconteudoPrincipal: f.subconteudoPrincipal.trim(), tipo: f.tipo.trim(),
  };
}

function isValidYearRange(f: AnalysisFilters) {
  const s = f.anoInicial ? Number(f.anoInicial) : null;
  const e = f.anoFinal ? Number(f.anoFinal) : null;
  if (f.anoInicial && (!Number.isFinite(s) || f.anoInicial.length !== 4)) return false;
  if (f.anoFinal && (!Number.isFinite(e) || f.anoFinal.length !== 4)) return false;
  if (s && e && s > e) return false;
  return true;
}

function buildContentYearMatrix(summary: ProvaAnalysisSummary) {
  const years = summary.years.slice(-10);
  const topContents = summary.contentFrequency.slice(0, 8).map((r) => r.value);
  const rows = topContents.map((content) => ({ content, byYear: {} as Record<string, number>, total: 0 }));
  const rowMap = new Map(rows.map((r) => [r.content, r]));
  for (const q of summary.questions) {
    const content = q.conteudo_principal || "Sem conteúdo principal";
    const year = q.ano;
    if (!year || !years.includes(year)) continue;
    const row = rowMap.get(content);
    if (!row) continue;
    row.byYear[year] = (row.byYear[year] ?? 0) + 1;
    row.total += 1;
  }
  return { years, rows: rows.filter((r) => r.total > 0) };
}

function buildDonutGradient(rows: FrequencyRow[], total: number) {
  if (rows.length === 0 || total === 0) return "#e5e7eb";
  let current = 0;
  const parts: string[] = [];
  rows.forEach((row, i) => {
    const start = current;
    const end = current + (row.count / total) * 100;
    parts.push(`${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${end}%`);
    current = end;
  });
  if (current < 100) parts.push(`#e5e7eb ${current}% 100%`);
  return `conic-gradient(${parts.join(", ")})`;
}

function heatmapCellColor(value: number, max: number) {
  if (!value || !max) return "hsl(var(--muted))";
  const opacity = 0.15 + (value / max) * 0.65;
  return `rgba(37, 99, 235, ${opacity})`;
}

function percentage(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatPeriod(f: AnalysisFilters, years: string[]) {
  if (f.anoInicial && f.anoFinal) return `${f.anoInicial}–${f.anoFinal}`;
  if (f.anoInicial) return `Desde ${f.anoInicial}`;
  if (f.anoFinal) return `Até ${f.anoFinal}`;
  if (years.length > 0) return `${years[0]}–${years[years.length - 1]}`;
  return "Todos";
}

function onlyYearDigits(v: string) {
  return v.replace(/\D/g, "").slice(0, 4);
}

function formatType(tipo: string) {
  const labels: Record<string, string> = {
    multipla_escolha: "Múltipla escolha",
    certo_errado: "Certo ou errado",
    numerica: "Numérica",
    discursiva: "Discursiva",
    "Sem tipo": "Sem tipo",
  };
  return labels[tipo] ?? tipo;
}
