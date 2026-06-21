import { useMemo } from "react";
import { BarChart3, Database } from "lucide-react";
import type { ProvaAnalysisSummary } from "@/lib/prova-analysis";
import { generateAISummaryFromData, type AISummaryResult } from "@/lib/prova-ai-summary";

export function AnalysisGeneralSummaryPanel({ summary }: { summary: ProvaAnalysisSummary }) {
  const result = useMemo(() => generateAISummaryFromData(summary), [summary]);

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 className="size-5 text-muted-foreground" />
            <h2 className="font-semibold">Resumo geral</h2>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            O resumo geral interpreta os principais dados estatísticos da análise atual.
          </p>
        </div>
      </div>

      <StructuredInputPreview input={result.structuredInput} />

      <div className="space-y-4">
        {result.warning && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            {result.warning}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {result.sections.map((section) => (
            <div key={section.title} className="rounded-lg border bg-background p-4">
              <h3 className="font-semibold">{section.title}</h3>
              <p className="mt-2 text-sm">{section.text}</p>
              <div className="mt-3 rounded-md bg-muted/50 p-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dados usados</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {section.evidence.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-background p-4">
          <h3 className="font-semibold">Como montar um simulado parecido</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {result.simulationGuide.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StructuredInputPreview({ input }: { input: AISummaryResult["structuredInput"] }) {
  const topContents = input.topContents.map((item) => `${item.label} ${formatPercent(item.percent)}`).join("; ") || "sem dados";
  const typeDistribution = input.typeDistribution.map((item) => `${item.label} ${formatPercent(item.percent)}`).join("; ") || "sem dados";
  const terms = input.topGeneralTerms.slice(0, 4).map((item) => item.label).join(", ") || "sem dados";
  const commands = input.topCommands.slice(0, 4).map((item) => item.label).join(", ") || "sem dados";

  return (
    <details className="rounded-lg border bg-muted/30 p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <Database className="size-4" /> Dados estruturados usados pelo resumo
      </summary>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
        <p><strong>Total de questões:</strong> {input.totalQuestions}</p>
        <p><strong>Anos:</strong> {input.years.length > 0 ? input.years.join(", ") : "sem anos cadastrados"}</p>
        <p><strong>Conteúdos mais frequentes:</strong> {topContents}</p>
        <p><strong>Tipos de questão:</strong> {typeDistribution}</p>
        <p><strong>Termos frequentes:</strong> {terms}</p>
        <p><strong>Comandos frequentes:</strong> {commands}</p>
        <p><strong>Referência/texto-base:</strong> {input.referenceUse.count} questão{input.referenceUse.count === 1 ? "" : "ões"} ({formatPercent(input.referenceUse.percent)})</p>
        <p><strong>Equações:</strong> {input.equationUse.count} questão{input.equationUse.count === 1 ? "" : "ões"} ({formatPercent(input.equationUse.percent)})</p>
      </div>
    </details>
  );
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
