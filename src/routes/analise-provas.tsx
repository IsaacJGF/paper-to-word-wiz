import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, BookOpenCheck, FileSearch, Image as ImageIcon, Layers, ListChecks, Loader2, Sigma, Tags, TextSearch } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { AnalysisLanguagePanel } from "@/components/AnalysisLanguagePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const EMPTY_FILTERS: AnalysisFilters = {
  prova: "",
  instituicao: "",
  anoInicial: "",
  anoFinal: "",
  areaGeral: "",
  conteudoPrincipal: "",
  subconteudoPrincipal: "",
  tipo: "",
};

const TYPE_OPTIONS = [
  { value: "multipla_escolha", label: "Múltipla escolha" },
  { value: "certo_errado", label: "Certo ou errado" },
  { value: "numerica", label: "Numérica" },
  { value: "discursiva", label: "Discursiva" },
];

const ANALYSIS_COLUMNS = [
  "id",
  "numero",
  "enunciado",
  "tipo",
  "ano",
  "prova",
  "instituicao",
  "area_geral",
  "conteudo_principal",
  "subconteudo_principal",
  "conteudos_relacionados",
  "tags_livres",
  "tags",
  "referencia_texto",
  "referencia_texto_apos",
  "referencia_imagem",
  "enunciado_imagem",
  "tem_imagem",
  "tem_equacao",
  "alternativas",
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

  const updateFilter = <K extends keyof AnalysisFilters>(key: K, value: AnalysisFilters[K]) => {
    if (key === "areaGeral") {
      setFilters((current) => ({ ...current, areaGeral: value, conteudoPrincipal: "", subconteudoPrincipal: "" }));
      return;
    }
    if (key === "conteudoPrincipal") {
      setFilters((current) => ({ ...current, conteudoPrincipal: value, subconteudoPrincipal: "" }));
      return;
    }
    setFilters((current) => ({ ...current, [key]: value }));
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

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Análise de Provas</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Analise provas antigas cadastradas no banco de questões para identificar padrões de cobrança, tipos de item e características gerais da base selecionada.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Termos e comandos
          </div>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Filtros da análise</h2>
              <p className="text-xs text-muted-foreground">Selecione a base de questões que será analisada. Os filtros são combinados entre si.</p>
            </div>
            {activeFilterCount > 0 && <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""}</span>}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="Prova" value={filters.prova} onChange={(value) => updateFilter("prova", value)} options={provas} placeholder="Todas as provas" />
            <FilterSelect label="Instituição" value={filters.instituicao} onChange={(value) => updateFilter("instituicao", value)} options={instituicoes} placeholder="Todas as instituições" />
            <div className="space-y-1.5">
              <Label>Ano inicial</Label>
              <Input value={filters.anoInicial} onChange={(event) => updateFilter("anoInicial", onlyYearDigits(event.target.value))} placeholder="Ex.: 2018" inputMode="numeric" maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Ano final</Label>
              <Input value={filters.anoFinal} onChange={(event) => updateFilter("anoFinal", onlyYearDigits(event.target.value))} placeholder="Ex.: 2024" inputMode="numeric" maxLength={4} />
            </div>
            <FilterSelect label="Área geral" value={filters.areaGeral} onChange={(value) => updateFilter("areaGeral", value)} options={areas} placeholder="Todas as áreas" />
            <FilterSelect label="Conteúdo principal" value={filters.conteudoPrincipal} onChange={(value) => updateFilter("conteudoPrincipal", value)} options={conteudoOptions} placeholder={filters.areaGeral ? "Todos os conteúdos da área" : "Todos os conteúdos"} disabled={Boolean(filters.areaGeral) && conteudoOptions.length === 0} />
            <FilterSelect label="Subconteúdo principal" value={filters.subconteudoPrincipal} onChange={(value) => updateFilter("subconteudoPrincipal", value)} options={subconteudoOptions} placeholder={filters.conteudoPrincipal ? "Todos os subconteúdos do conteúdo" : "Todos os subconteúdos"} disabled={Boolean(filters.conteudoPrincipal) && subconteudoOptions.length === 0} />
            <div className="space-y-1.5">
              <Label>Tipo de questão</Label>
              <select value={filters.tipo} onChange={(event) => updateFilter("tipo", event.target.value)} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
                <option value="">Todos os tipos</option>
                {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={clearFilters}>Limpar</Button>
            <Button type="button" onClick={analyze} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}
              {loading ? "Analisando..." : "Analisar prova"}
            </Button>
          </div>
        </section>

        <section className="mt-4">
          {!hasAnalyzed && <EmptyState text="Selecione os filtros e clique em Analisar prova para visualizar os padrões da prova." />}

          {hasAnalyzed && loading && (
            <div className="flex items-center justify-center rounded-xl border bg-card py-16 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" /> Analisando questões...
            </div>
          )}

          {hasAnalyzed && !loading && summary && summary.total === 0 && (
            <EmptyState text="Nenhuma questão encontrada para os filtros selecionados. Revise os filtros ou verifique se as questões possuem metadados cadastrados." />
          )}

          {hasAnalyzed && !loading && summary && summary.total > 0 && <AnalysisResult summary={summary} filters={appliedFilters} />}
        </section>
      </div>
    </AppLayout>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder, disabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: CatalogItem[];
  placeholder: string;
  disabled?: boolean;
}) {
  const visibleOptions = options.filter((item) => item.ativo || item.nome === value);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">
        <option value="">{placeholder}</option>
        {visibleOptions.map((item) => <option key={item.id} value={item.nome}>{item.nome}{item.ativo ? "" : " (inativo)"}</option>)}
      </select>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card px-4 py-14 text-center">
      <BarChart3 className="mx-auto mb-3 size-10 text-muted-foreground" />
      <p className="mx-auto max-w-xl text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function AnalysisResult({ summary, filters }: { summary: ProvaAnalysisSummary; filters: AnalysisFilters }) {
  const period = formatPeriod(filters, summary.years);
  return (
    <div className="space-y-4">
      {summary.total < 10 && <SmallSampleAlert total={summary.total} />}
      <SummaryCards summary={summary} period={period} />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <SearchSummary filters={filters} period={period} />
          <TopContentCards summary={summary} />
        </div>
        <TypeBreakdownCard summary={summary} />
      </div>

      <ChartsPanel summary={summary} />
      <AnalysisLanguagePanel summary={summary} />

      <div className="grid gap-4 xl:grid-cols-2">
        <VisualFrequencyTable title="Conteúdos mais cobrados" rows={summary.contentFrequency} total={summary.total} highlightFirst />
        <VisualFrequencyTable title="Subconteúdos mais cobrados" rows={summary.subcontentFrequency} total={summary.total} highlightFirst />
        <VisualFrequencyTable title="Tags mais frequentes" rows={summary.tagFrequency} total={summary.total} emptyText="Nenhuma tag cadastrada nas questões analisadas." />
        <VisualFrequencyTable title="Áreas gerais mais cobradas" rows={summary.areaFrequency} total={summary.total} />
        <VisualFrequencyTable title="Conteúdos relacionados mais frequentes" rows={summary.relatedContentFrequency} total={summary.total} emptyText="Nenhum conteúdo relacionado cadastrado nas questões analisadas." />
        <VisualFrequencyTable title="Questões por ano" rows={summary.questionsByYear.map((row) => ({ value: row.year, count: row.count, percent: summary.total > 0 ? Math.round((row.count / summary.total) * 1000) / 10 : 0, years: [row.year] }))} total={summary.total} />
      </div>

      <MetadataQuality summary={summary} />
      <QuestionList questions={summary.questions} />
    </div>
  );
}

function SmallSampleAlert({ total }: { total: number }) {
  return (
    <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <strong>Amostra pequena:</strong> a análise foi feita com {total} questão{total === 1 ? "" : "ões"}. As visualizações podem indicar tendências, mas ainda não representam um padrão sólido da prova.
      </div>
    </div>
  );
}

function SummaryCards({ summary, period }: { summary: ProvaAnalysisSummary; period: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <SummaryCard title="Total de questões" value={summary.total} icon={<FileSearch className="size-5" />} />
      <SummaryCard title="Total de anos" value={summary.years.length} description={period} icon={<BarChart3 className="size-5" />} />
      <SummaryCard title="Com referência" value={summary.withReference} description={percentage(summary.withReference, summary.total)} icon={<TextSearch className="size-5" />} />
      <SummaryCard title="Com imagem" value={summary.withImage} description={percentage(summary.withImage, summary.total)} icon={<ImageIcon className="size-5" />} />
      <SummaryCard title="Com alternativas" value={summary.withAlternatives} description={percentage(summary.withAlternatives, summary.total)} icon={<ListChecks className="size-5" />} />
      <SummaryCard title="Com equação" value={summary.withEquation} description={percentage(summary.withEquation, summary.total)} icon={<Sigma className="size-5" />} />
    </div>
  );
}

function SearchSummary({ filters, period }: { filters: AnalysisFilters; period: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Resumo da busca</h2>
        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Filtros aplicados</span>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Prova" value={filters.prova || "Todas"} />
        <Info label="Instituição" value={filters.instituicao || "Todas"} />
        <Info label="Período" value={period} />
        <Info label="Tipo" value={filters.tipo ? formatType(filters.tipo) : "Todos"} />
        <Info label="Área geral" value={filters.areaGeral || "Todas"} />
        <Info label="Conteúdo principal" value={filters.conteudoPrincipal || "Todos"} />
        <Info label="Subconteúdo principal" value={filters.subconteudoPrincipal || "Todos"} />
      </div>
    </div>
  );
}

function TopContentCards({ summary }: { summary: ProvaAnalysisSummary }) {
  const topContent = summary.contentFrequency[0];
  const topSubcontent = summary.subcontentFrequency[0];
  const topTag = summary.tagFrequency[0];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <TopMetricCard title="Conteúdo líder" row={topContent} icon={<BookOpenCheck className="size-4" />} empty="Sem conteúdo principal" />
      <TopMetricCard title="Subconteúdo líder" row={topSubcontent} icon={<Layers className="size-4" />} empty="Sem subconteúdo" />
      <TopMetricCard title="Tag líder" row={topTag} icon={<Tags className="size-4" />} empty="Sem tags" />
    </div>
  );
}

function TopMetricCard({ title, row, icon, empty }: { title: string; row?: FrequencyRow; icon: ReactNode; empty: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {row ? (
        <>
          <p className="mt-3 line-clamp-2 text-lg font-semibold">{row.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{row.count} questão{row.count === 1 ? "" : "ões"} · {formatPercent(row.percent)} · {row.years.length > 0 ? `anos: ${row.years.join(", ")}` : "sem ano"}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function TypeBreakdownCard({ summary }: { summary: ProvaAnalysisSummary }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Questões por tipo</h2>
        <span className="text-xs text-muted-foreground">{summary.total} no total</span>
      </div>
      <div className="space-y-3">
        {summary.typeCounts.map((item) => (
          <div key={item.value}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span>{formatType(item.value)}</span>
              <strong>{item.count}</strong>
            </div>
            <ProgressBar percent={item.percent} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartsPanel({ summary }: { summary: ProvaAnalysisSummary }) {
  const matrix = buildContentYearMatrix(summary);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <HorizontalBarChart title="Barras horizontais: conteúdos mais cobrados" rows={summary.contentFrequency} emptyText="Nenhum conteúdo principal encontrado." />
      <VerticalBarChart title="Barras verticais: questões por ano" rows={summary.questionsByYear} />
      <DonutChart title="Distribuição por área geral" rows={summary.areaFrequency} total={summary.total} />
      <HeatmapChart title="Mapa simples Ano × Conteúdo" years={matrix.years} rows={matrix.rows} />
    </div>
  );
}

function HorizontalBarChart({ title, rows, emptyText }: { title: string; rows: FrequencyRow[]; emptyText: string }) {
  const visible = rows.filter((row) => row.count > 0).slice(0, 10);
  const max = Math.max(...visible.map((row) => row.count), 0);
  return (
    <ChartCard title={title} description="Mostra os conteúdos com maior presença na base filtrada.">
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : (
        <div className="space-y-3">
          {visible.map((row) => (
            <div key={row.value} className="grid gap-2 sm:grid-cols-[180px_1fr_72px] sm:items-center">
              <span className="line-clamp-1 text-sm font-medium" title={row.value}>{row.value}</span>
              <ProgressBar percent={max > 0 ? (row.count / max) * 100 : 0} />
              <span className="text-right text-xs text-muted-foreground">{row.count} · {formatPercent(row.percent)}</span>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function VerticalBarChart({ title, rows }: { title: string; rows: Array<{ year: string; count: number }> }) {
  const visible = rows.filter((row) => row.count > 0).slice(-12);
  const max = Math.max(...visible.map((row) => row.count), 0);
  return (
    <ChartCard title={title} description="Mostra a distribuição temporal das questões analisadas.">
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum ano informado nas questões analisadas.</p> : (
        <div className="flex h-64 items-end gap-2 overflow-x-auto rounded-lg bg-muted/30 p-3">
          {visible.map((row) => (
            <div key={row.year} className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-semibold">{row.count}</span>
              <div className="w-full rounded-t-md bg-primary/70" style={{ height: `${Math.max(8, max > 0 ? (row.count / max) * 180 : 0)}px` }} />
              <span className="text-xs text-muted-foreground">{row.year}</span>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function DonutChart({ title, rows, total }: { title: string; rows: FrequencyRow[]; total: number }) {
  const visible = rows.filter((row) => row.count > 0).slice(0, 6);
  const gradient = buildDonutGradient(visible, total);
  return (
    <ChartCard title={title} description="Mostra a participação das áreas gerais na base analisada.">
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma área geral encontrada.</p> : (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
          <div className="relative mx-auto size-40 rounded-full" style={{ background: gradient }}>
            <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-card text-center">
              <strong className="text-2xl">{total}</strong>
              <span className="text-[10px] text-muted-foreground">questões</span>
            </div>
          </div>
          <div className="space-y-2">
            {visible.map((row, index) => (
              <div key={row.value} className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                  <span className="line-clamp-1">{row.value}</span>
                </span>
                <strong>{formatPercent(row.percent)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function HeatmapChart({ title, years, rows }: { title: string; years: string[]; rows: MatrixRow[] }) {
  const max = Math.max(...rows.flatMap((row) => Object.values(row.byYear)), 0);
  return (
    <ChartCard title={title} description="Cruzamento visual simples entre ano e conteúdo principal.">
      {years.length === 0 || rows.length === 0 ? <p className="text-sm text-muted-foreground">Não há anos ou conteúdos suficientes para montar o mapa.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="sticky left-0 bg-card py-2 pr-2 text-left font-medium">Conteúdo</th>
                {years.map((year) => <th key={year} className="px-2 py-2 text-center font-medium">{year}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.content} className="border-b last:border-0">
                  <td className="sticky left-0 max-w-52 bg-card py-2 pr-2 font-medium"><span className="line-clamp-1" title={row.content}>{row.content}</span></td>
                  {years.map((year) => {
                    const value = row.byYear[year] ?? 0;
                    return (
                      <td key={year} className="p-1 text-center">
                        <span className="inline-flex h-8 w-full items-center justify-center rounded-md text-xs font-semibold" style={{ backgroundColor: heatmapCellColor(value, max) }}>
                          {value || ""}
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

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ title, value, description, icon }: { title: string; value: number; description?: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-wide">{title}</span>
        {icon}
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function VisualFrequencyTable({ title, rows, total, emptyText = "Sem dados suficientes.", highlightFirst }: { title: string; rows: FrequencyRow[]; total: number; emptyText?: string; highlightFirst?: boolean }) {
  const visible = rows.slice(0, 12);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">Quantidade, porcentagem e anos em que apareceu.</p>
        </div>
        <span className="text-xs text-muted-foreground">Base: {total} questão{total === 1 ? "" : "ões"}</span>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="min-w-56 py-2 pr-2 font-medium">Item</th>
                <th className="py-2 pr-2 text-right font-medium">Qtd.</th>
                <th className="py-2 pr-2 text-right font-medium">%</th>
                <th className="min-w-32 py-2 font-medium">Anos</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={row.value} className="border-b last:border-0">
                  <td className="py-2 pr-2 align-top">
                    <div className="flex items-center gap-2">
                      {highlightFirst && index === 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">mais cobrado</span>}
                      <span className="font-medium">{row.value}</span>
                    </div>
                    <div className="mt-2 max-w-xs"><ProgressBar percent={row.percent} /></div>
                  </td>
                  <td className="py-2 pr-2 text-right align-top font-semibold">{row.count}</td>
                  <td className="py-2 pr-2 text-right align-top">{formatPercent(row.percent)}</td>
                  <td className="py-2 align-top text-xs text-muted-foreground">{row.years.length > 0 ? row.years.join(", ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
    </div>
  );
}

function MetadataQuality({ summary }: { summary: ProvaAnalysisSummary }) {
  const missing = summary.missingMetadata;
  const totalMissing = missing.area + missing.content + missing.subcontent + missing.year + missing.type;
  if (totalMissing === 0) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <h2 className="font-semibold">Qualidade dos dados</h2>
      <p className="mt-1 text-sm">Algumas questões estão incompletas. Isso pode reduzir a precisão da análise.</p>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <Info label="Sem área" value={String(missing.area)} />
        <Info label="Sem conteúdo" value={String(missing.content)} />
        <Info label="Sem subconteúdo" value={String(missing.subcontent)} />
        <Info label="Sem ano" value={String(missing.year)} />
        <Info label="Sem tipo" value={String(missing.type)} />
      </div>
    </div>
  );
}

function QuestionList({ questions }: { questions: ProvaAnalysisQuestion[] }) {
  const visible = questions.slice(0, 80);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Questões usadas na análise</h2>
          <p className="text-xs text-muted-foreground">Lista compacta para conferir se a busca retornou a base correta.</p>
        </div>
        {questions.length > visible.length && <span className="text-xs text-muted-foreground">Mostrando {visible.length} de {questions.length}</span>}
      </div>
      <div className="space-y-2">
        {visible.map((question) => (
          <div key={question.id} className="rounded-lg border bg-background p-3">
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-1.5 py-0.5">{question.prova || "Prova não informada"}</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5">{question.instituicao || "Instituição não informada"}</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5">{question.ano || "Ano não informado"}</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5">{formatType(question.tipo || "Sem tipo")}</span>
            </div>
            <div className="mb-1 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">{question.area_geral || "Sem área"}</span>
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">{question.conteudo_principal || "Sem conteúdo"}</span>
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">{question.subconteudo_principal || "Sem subconteúdo"}</span>
            </div>
            <p className="line-clamp-2 text-sm text-foreground/90">
              {question.numero ? `Item ${question.numero}. ` : ""}{plainText(question.enunciado) || "Sem enunciado cadastrado."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
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

function normalizeFilters(filters: AnalysisFilters): AnalysisFilters {
  return {
    prova: filters.prova.trim(),
    instituicao: filters.instituicao.trim(),
    anoInicial: filters.anoInicial.trim(),
    anoFinal: filters.anoFinal.trim(),
    areaGeral: filters.areaGeral.trim(),
    conteudoPrincipal: filters.conteudoPrincipal.trim(),
    subconteudoPrincipal: filters.subconteudoPrincipal.trim(),
    tipo: filters.tipo.trim(),
  };
}

function isValidYearRange(filters: AnalysisFilters) {
  const start = filters.anoInicial ? Number(filters.anoInicial) : null;
  const end = filters.anoFinal ? Number(filters.anoFinal) : null;
  if (filters.anoInicial && (!Number.isFinite(start) || filters.anoInicial.length !== 4)) return false;
  if (filters.anoFinal && (!Number.isFinite(end) || filters.anoFinal.length !== 4)) return false;
  if (start && end && start > end) return false;
  return true;
}

function buildContentYearMatrix(summary: ProvaAnalysisSummary) {
  const years = summary.years.slice(-10);
  const topContents = summary.contentFrequency.slice(0, 8).map((row) => row.value);
  const rows = topContents.map((content) => ({ content, byYear: {} as Record<string, number>, total: 0 }));
  const rowMap = new Map(rows.map((row) => [row.content, row]));

  for (const question of summary.questions) {
    const content = question.conteudo_principal || "Sem conteúdo principal";
    const year = question.ano;
    if (!year || !years.includes(year)) continue;
    const row = rowMap.get(content);
    if (!row) continue;
    row.byYear[year] = (row.byYear[year] ?? 0) + 1;
    row.total += 1;
  }

  return { years, rows: rows.filter((row) => row.total > 0) };
}

function buildDonutGradient(rows: FrequencyRow[], total: number) {
  if (rows.length === 0 || total === 0) return "#e5e7eb";
  let current = 0;
  const parts: string[] = [];
  rows.forEach((row, index) => {
    const start = current;
    const end = current + (row.count / total) * 100;
    parts.push(`${DONUT_COLORS[index % DONUT_COLORS.length]} ${start}% ${end}%`);
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

function formatPeriod(filters: AnalysisFilters, years: string[]) {
  if (filters.anoInicial && filters.anoFinal) return `${filters.anoInicial}–${filters.anoFinal}`;
  if (filters.anoInicial) return `A partir de ${filters.anoInicial}`;
  if (filters.anoFinal) return `Até ${filters.anoFinal}`;
  if (years.length > 0) return `${years[0]}–${years[years.length - 1]}`;
  return "Todos os anos";
}

function onlyYearDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function plainText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\$+/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
