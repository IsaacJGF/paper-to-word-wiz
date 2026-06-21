import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileSearch, Image as ImageIcon, Loader2, Sigma, TextSearch } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
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

type QuestionRow = {
  id: string;
  tipo: string | null;
  ano: string | null;
  prova: string | null;
  instituicao: string | null;
  area_geral: string | null;
  conteudo_principal: string | null;
  subconteudo_principal: string | null;
  referencia_texto: string | null;
  referencia_texto_apos: string | null;
  referencia_imagem: string | null;
  enunciado_imagem: string | null;
  tem_imagem: boolean | null;
  tem_equacao: boolean | null;
  alternativas: { letra?: string; texto?: string; imagem?: string | null }[] | null;
};

type AnalysisSummary = {
  questions: QuestionRow[];
  total: number;
  years: string[];
  typeCounts: Array<{ tipo: string; quantidade: number }>;
  withReference: number;
  withImage: number;
  withEquation: number;
};

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

function Page() {
  const [filters, setFilters] = useState<AnalysisFilters>(EMPTY_FILTERS);
  const [areas, setAreas] = useState<CatalogItem[]>([]);
  const [conteudos, setConteudos] = useState<CatalogItem[]>([]);
  const [subconteudos, setSubconteudos] = useState<CatalogItem[]>([]);
  const [provas, setProvas] = useState<CatalogItem[]>([]);
  const [instituicoes, setInstituicoes] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
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
  const conteudoOptions = selectedArea
    ? conteudos.filter((item) => item.area_id === selectedArea.id)
    : conteudos;
  const selectedConteudo = conteudoOptions.find((item) => item.nome === filters.conteudoPrincipal);
  const subconteudoOptions = selectedConteudo
    ? subconteudos.filter((item) => item.conteudo_id === selectedConteudo.id)
    : subconteudos;

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
    setSummary(null);
    setHasAnalyzed(false);
  };

  const analyze = async () => {
    setLoading(true);
    setHasAnalyzed(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      let query = db
        .from("questions")
        .select("id,tipo,ano,prova,instituicao,area_geral,conteudo_principal,subconteudo_principal,referencia_texto,referencia_texto_apos,referencia_imagem,enunciado_imagem,tem_imagem,tem_equacao,alternativas");

      if (filters.prova) query = query.eq("prova", filters.prova);
      if (filters.instituicao) query = query.eq("instituicao", filters.instituicao);
      if (filters.anoInicial.trim()) query = query.gte("ano", filters.anoInicial.trim());
      if (filters.anoFinal.trim()) query = query.lte("ano", filters.anoFinal.trim());
      if (filters.areaGeral) query = query.eq("area_geral", filters.areaGeral);
      if (filters.conteudoPrincipal) query = query.eq("conteudo_principal", filters.conteudoPrincipal);
      if (filters.subconteudoPrincipal) query = query.eq("subconteudo_principal", filters.subconteudoPrincipal);
      if (filters.tipo) query = query.eq("tipo", filters.tipo);

      const { data, error } = await query.order("ano", { ascending: true });
      if (error) {
        console.error(error);
        toast.error("Falha ao analisar as provas.");
        setSummary(null);
        return;
      }

      setSummary(buildSummary((data ?? []) as QuestionRow[]));
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
            Versão inicial: filtros e resumo simples
          </div>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Filtros da análise</h2>
              <p className="text-xs text-muted-foreground">Selecione a base de questões que será analisada.</p>
            </div>
            {activeFilterCount > 0 && <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""}</span>}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="Prova" value={filters.prova} onChange={(value) => updateFilter("prova", value)} options={provas} placeholder="Todas as provas" />
            <FilterSelect label="Instituição" value={filters.instituicao} onChange={(value) => updateFilter("instituicao", value)} options={instituicoes} placeholder="Todas as instituições" />
            <div className="space-y-1.5">
              <Label>Ano inicial</Label>
              <Input value={filters.anoInicial} onChange={(event) => updateFilter("anoInicial", event.target.value)} placeholder="Ex.: 2015" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Ano final</Label>
              <Input value={filters.anoFinal} onChange={(event) => updateFilter("anoFinal", event.target.value)} placeholder="Ex.: 2024" inputMode="numeric" />
            </div>
            <FilterSelect label="Área geral" value={filters.areaGeral} onChange={(value) => updateFilter("areaGeral", value)} options={areas} placeholder="Todas as áreas" />
            <FilterSelect label="Conteúdo principal" value={filters.conteudoPrincipal} onChange={(value) => updateFilter("conteudoPrincipal", value)} options={conteudoOptions} placeholder="Todos os conteúdos" disabled={Boolean(filters.areaGeral) && conteudoOptions.length === 0} />
            <FilterSelect label="Subconteúdo principal" value={filters.subconteudoPrincipal} onChange={(value) => updateFilter("subconteudoPrincipal", value)} options={subconteudoOptions} placeholder="Todos os subconteúdos" disabled={Boolean(filters.conteudoPrincipal) && subconteudoOptions.length === 0} />
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
              Analisar prova
            </Button>
          </div>
        </section>

        <section className="mt-4">
          {!hasAnalyzed && (
            <EmptyState text="Selecione os filtros e clique em Analisar prova para visualizar os padrões da prova." />
          )}

          {hasAnalyzed && loading && (
            <div className="flex items-center justify-center rounded-xl border bg-card py-16 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" /> Analisando questões...
            </div>
          )}

          {hasAnalyzed && !loading && summary && summary.total === 0 && (
            <EmptyState text="Nenhuma questão encontrada para os filtros selecionados." />
          )}

          {hasAnalyzed && !loading && summary && summary.total > 0 && (
            <AnalysisResult summary={summary} filters={filters} />
          )}
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

function AnalysisResult({ summary, filters }: { summary: AnalysisSummary; filters: AnalysisFilters }) {
  const period = [filters.anoInicial || summary.years[0], filters.anoFinal || summary.years[summary.years.length - 1]].filter(Boolean).join("–") || "Todos os anos";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Questões analisadas" value={summary.total} icon={<FileSearch className="size-5" />} />
        <SummaryCard title="Anos analisados" value={summary.years.length} description={period} icon={<BarChart3 className="size-5" />} />
        <SummaryCard title="Com referência" value={summary.withReference} description={percentage(summary.withReference, summary.total)} icon={<TextSearch className="size-5" />} />
        <SummaryCard title="Com imagem" value={summary.withImage} description={percentage(summary.withImage, summary.total)} icon={<ImageIcon className="size-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Resumo da base analisada</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Prova" value={filters.prova || "Todas"} />
            <Info label="Instituição" value={filters.instituicao || "Todas"} />
            <Info label="Período" value={period} />
            <Info label="Questões com equação" value={`${summary.withEquation} (${percentage(summary.withEquation, summary.total)})`} />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Quantidade por tipo</h2>
          <div className="mt-3 space-y-2">
            {summary.typeCounts.map((item) => (
              <div key={item.tipo} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span>{formatType(item.tipo)}</span>
                <strong>{item.quantidade}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Próximas análises</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta primeira versão prepara a base da aba. Os próximos PRs podem adicionar conteúdos mais cobrados, tabelas com porcentagem, gráficos, análise de termos, comandos frequentes, referências/textos-base, cruzamentos e resumo inteligente com IA.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, description, icon }: { title: string; value: number; description?: string; icon: React.ReactNode }) {
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

function buildSummary(questions: QuestionRow[]): AnalysisSummary {
  const years = Array.from(new Set(questions.map((q) => q.ano?.trim()).filter((ano): ano is string => Boolean(ano)))).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const typeMap = new Map<string, number>();
  let withReference = 0;
  let withImage = 0;
  let withEquation = 0;

  for (const question of questions) {
    const type = question.tipo?.trim() || "sem_tipo";
    typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
    if (hasReference(question)) withReference += 1;
    if (hasImage(question)) withImage += 1;
    if (question.tem_equacao) withEquation += 1;
  }

  return {
    questions,
    total: questions.length,
    years,
    typeCounts: Array.from(typeMap.entries())
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    withReference,
    withImage,
    withEquation,
  };
}

function hasReference(question: QuestionRow) {
  return Boolean(question.referencia_texto?.trim() || question.referencia_texto_apos?.trim() || question.referencia_imagem);
}

function hasImage(question: QuestionRow) {
  return Boolean(
    question.tem_imagem ||
    question.referencia_imagem ||
    question.enunciado_imagem ||
    question.alternativas?.some((alt) => alt.imagem),
  );
}

function percentage(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function formatType(tipo: string) {
  const labels: Record<string, string> = {
    multipla_escolha: "Múltipla escolha",
    certo_errado: "Certo ou errado",
    numerica: "Numérica",
    discursiva: "Discursiva",
    sem_tipo: "Sem tipo",
  };
  return labels[tipo] ?? tipo;
}
