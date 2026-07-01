import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, BrainCircuit, ClipboardCopy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateDeepAnalysis } from "@/lib/prova-deep-analysis.functions";
import { buildDeepAnalysisPayload, type DeepAnalysisFilters, type DeepAnalysisReport, type DeepPattern } from "@/lib/prova-deep-analysis";
import type { ProvaAnalysisSummary } from "@/lib/prova-analysis";
import { toast } from "sonner";

type DeepAnalysisSuccess = {
  ok: true;
  report: DeepAnalysisReport;
  model: string;
};

type DeepAnalysisFailure = {
  ok: false;
  errorCode?: string;
  message: string;
};

type DeepAnalysisResponse = DeepAnalysisSuccess | DeepAnalysisFailure;

export function AnalysisDeepAIPanel({
  summary,
  filters,
  onPatternClick,
  onEvidenceClick,
}: {
  summary: ProvaAnalysisSummary;
  filters: DeepAnalysisFilters;
  onPatternClick?: (pattern: DeepPattern, sectionTitle: string) => void;
  onEvidenceClick?: (value: string, sectionTitle: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DeepAnalysisReport | null>(null);
  const [model, setModel] = useState("");
  const [error, setError] = useState("");
  const payload = useMemo(() => buildDeepAnalysisPayload(summary, filters), [summary, filters]);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await generateDeepAnalysis({ data: { payload } }) as DeepAnalysisResponse;

      if (!data.ok) {
        setError(data.message);
        toast.error(data.message);
        return;
      }

      setReport(data.report);
      setModel(data.model);
      toast.success("Análise profunda gerada.");
    } catch (err) {
      console.error("Erro ao gerar análise profunda:", err);
      const message = err instanceof Error ? err.message : "Falha ao gerar análise profunda por IA.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(reportToText(report));
      toast.success("Relatório copiado.");
    } catch (err) {
      console.error("Erro ao copiar relatório:", err);
      toast.error("Não foi possível copiar o relatório.");
    }
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <BrainCircuit className="size-5 text-muted-foreground" />
            <h2 className="font-semibold">Análise profunda por IA</h2>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            A mesma IA usada na digitalização analisará os dados estatísticos e os textos das questões para encontrar padrões mais sutis de cobrança, linguagem e construção dos itens.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {report && (
            <Button type="button" variant="outline" onClick={copyReport} className="gap-2">
              <ClipboardCopy className="size-4" /> Copiar relatório
            </Button>
          )}
          <Button type="button" onClick={generate} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? "Gerando análise..." : "Gerar análise profunda por IA"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground md:grid-cols-4">
        <p><strong className="text-foreground">Base:</strong> {payload.total_questoes} questão{payload.total_questoes === 1 ? "" : "ões"}</p>
        <p><strong className="text-foreground">Enviado à IA:</strong> {payload.amostra.quantidade_enviada} questão{payload.amostra.quantidade_enviada === 1 ? "" : "ões"}</p>
        <p><strong className="text-foreground">Amostra:</strong> {payload.amostra.usou_amostra_representativa ? "representativa" : "completa"}</p>
        <p><strong className="text-foreground">IA:</strong> mesma da digitalização</p>
      </div>

      {payload.amostra.usou_amostra_representativa && (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{payload.amostra.aviso}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> A IA está analisando estatísticas, textos e padrões dos itens...
        </div>
      )}

      {!loading && !report && !error && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Clique em “Gerar análise profunda por IA” para criar um relatório interpretativo com evidências.
        </div>
      )}

      {report && (
        <div className="space-y-3">
          {model && <p className="text-xs text-muted-foreground">Modelo usado: {model}</p>}
          {report.aviso_amostra && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              {report.aviso_amostra}
            </div>
          )}
          <ReportSection title="Visão geral da prova" defaultOpen>
            <p className="text-sm leading-relaxed">{report.visao_geral}</p>
          </ReportSection>
          <PatternSection title="Padrões de conteúdo" patterns={report.padroes_conteudo} onPatternClick={onPatternClick} />
          <PatternSection title="Padrões de linguagem da banca" patterns={report.padroes_linguagem} onPatternClick={onPatternClick} />
          <PatternSection title="Padrões de construção dos itens" patterns={report.padroes_construcao_itens} onPatternClick={onPatternClick} />
          <ReportSection title="Uso de referência/texto-base">
            <p className="text-sm leading-relaxed">{report.uso_texto_base || "Sem observações suficientes sobre texto-base."}</p>
          </ReportSection>
          <PatternSection title="Padrões sutis encontrados" patterns={report.padroes_sutis} onPatternClick={onPatternClick} />
          <PatternSection title="Recomendações para montar simulado" patterns={report.recomendacoes_simulado} onPatternClick={onPatternClick} />
          <ListSection title="Limitações da análise" values={report.limitacoes} empty="Nenhuma limitação informada pela IA." onValueClick={onEvidenceClick} />
          <ListSection title="Evidências usadas" values={report.evidencias_usadas} empty="Nenhuma evidência listada." onValueClick={onEvidenceClick} />
        </div>
      )}
    </div>
  );
}

function PatternSection({ title, patterns, onPatternClick }: { title: string; patterns: DeepPattern[]; onPatternClick?: (pattern: DeepPattern, sectionTitle: string) => void }) {
  return (
    <ReportSection title={title}>
      {patterns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem padrão suficiente para esta seção.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {patterns.map((pattern, index) => (
            <button
              key={`${pattern.titulo}-${index}`}
              type="button"
              onClick={() => onPatternClick?.(pattern, title)}
              className="rounded-lg border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-semibold">{pattern.titulo}</h4>
                <ConfidenceBadge value={pattern.nivel_confianca} />
              </div>
              <p className="text-sm">{pattern.explicacao}</p>
              <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                <strong>Evidência:</strong> {pattern.evidencia}
              </p>
            </button>
          ))}
        </div>
      )}
    </ReportSection>
  );
}

function ReportSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="rounded-lg border bg-muted/20 p-3" open={defaultOpen}>
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function ListSection({ title, values, empty, onValueClick }: { title: string; values: string[]; empty: string; onValueClick?: (value: string, sectionTitle: string) => void }) {
  return (
    <ReportSection title={title}>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {values.map((value) => (
            <li key={value}>
              <button type="button" onClick={() => onValueClick?.(value, title)} className="text-left hover:text-foreground hover:underline">
                • {value}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ReportSection>
  );
}

function ConfidenceBadge({ value }: { value: DeepPattern["nivel_confianca"] }) {
  const className = value === "alto"
    ? "bg-emerald-100 text-emerald-800"
    : value === "médio"
      ? "bg-amber-100 text-amber-900"
      : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>confiança {value}</span>;
}

function reportToText(report: DeepAnalysisReport) {
  const lines = [
    "Análise profunda por IA",
    "",
    report.aviso_amostra,
    "Visão geral da prova",
    report.visao_geral,
    "",
    ...patternLines("Padrões de conteúdo", report.padroes_conteudo),
    ...patternLines("Padrões de linguagem da banca", report.padroes_linguagem),
    ...patternLines("Padrões de construção dos itens", report.padroes_construcao_itens),
    "Uso de referência/texto-base",
    report.uso_texto_base,
    "",
    ...patternLines("Padrões sutis encontrados", report.padroes_sutis),
    ...patternLines("Recomendações para montar simulado", report.recomendacoes_simulado),
    "Limitações da análise",
    ...report.limitacoes.map((item) => `- ${item}`),
    "",
    "Evidências usadas",
    ...report.evidencias_usadas.map((item) => `- ${item}`),
  ];
  return lines.filter((line) => line !== undefined && line !== null).join("\n");
}

function patternLines(title: string, patterns: DeepPattern[]) {
  return [
    title,
    ...patterns.flatMap((pattern) => [
      `- ${pattern.titulo} (${pattern.nivel_confianca})`,
      `  ${pattern.explicacao}`,
      `  Evidência: ${pattern.evidencia}`,
    ]),
    "",
  ];
}
