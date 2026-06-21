import { GitCompareArrows, Sparkles } from "lucide-react";
import type { CrossMatrix, CrossMatrixRow, ProvaAnalysisSummary } from "@/lib/prova-analysis";

export function AnalysisCrossPanel({ summary }: { summary: ProvaAnalysisSummary }) {
  const cross = summary.crossAnalysis;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <GitCompareArrows className="size-5 text-muted-foreground" />
          <h2 className="font-semibold">Cruzamentos de dados</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Cruza conteúdo, ano, tipo de questão, prova, termos e comandos para encontrar padrões mais fortes na base analisada. As conclusões abaixo são geradas por regra, sem IA.
        </p>
      </div>

      <PatternHighlights summary={summary} />

      <div className="grid gap-4 xl:grid-cols-2">
        <CrossMatrixCard title="Conteúdo × Ano" matrix={cross.contentByYear} />
        <CrossMatrixCard title="Conteúdo × Tipo de questão" matrix={cross.contentByType} formatColumn={formatType} />
        <CrossMatrixCard title="Prova × Conteúdo" matrix={cross.provaByContent} />
        <CrossMatrixCard title="Conteúdo × Termos frequentes" matrix={cross.contentByTerms} />
        <CrossMatrixCard title="Conteúdo × Comandos usados" matrix={cross.contentByCommands} />
      </div>
    </div>
  );
}

function PatternHighlights({ summary }: { summary: ProvaAnalysisSummary }) {
  const insights = summary.crossAnalysis.insights;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-5 text-muted-foreground" />
        <h3 className="font-semibold">Padrões mais fortes</h3>
      </div>

      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há dados suficientes para gerar conclusões confiáveis por regra. Cadastre mais questões ou refine os filtros para buscar padrões mais claros.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((insight) => (
            <div key={`${insight.title}-${insight.description}`} className="rounded-lg border bg-background p-3">
              <p className="font-medium">{insight.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">{insight.evidence}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrossMatrixCard({ title, matrix, formatColumn }: { title: string; matrix: CrossMatrix; formatColumn?: (value: string) => string }) {
  const hasData = matrix.rows.length > 0 && matrix.columns.length > 0;
  const max = getMatrixMax(matrix.rows);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">Células mais fortes ficam destacadas.</p>
        </div>
        <span className="text-xs text-muted-foreground">{matrix.rows.length} linha{matrix.rows.length === 1 ? "" : "s"}</span>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">Sem dados suficientes para este cruzamento.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="sticky left-0 bg-card py-2 pr-2 text-left font-medium">Base</th>
                <th className="py-2 pr-2 text-right font-medium">Total</th>
                {matrix.columns.map((column) => (
                  <th key={column} className="px-2 py-2 text-center font-medium">
                    <span className="line-clamp-2" title={column}>{formatColumn ? formatColumn(column) : column}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.row} className="border-b last:border-0">
                  <td className="sticky left-0 max-w-52 bg-card py-2 pr-2 font-medium">
                    <span className="line-clamp-2" title={row.row}>{row.row}</span>
                  </td>
                  <td className="py-2 pr-2 text-right font-semibold">{row.total}</td>
                  {row.cells.map((cell) => {
                    const isStrongest = cell.count > 0 && cell.count === max;
                    return (
                      <td key={`${row.row}-${cell.column}`} className="p-1 text-center">
                        <span
                          className={`inline-flex h-8 w-full items-center justify-center rounded-md text-xs font-semibold ${isStrongest ? "ring-1 ring-primary" : ""}`}
                          style={{ backgroundColor: matrixCellColor(cell.count, max) }}
                          title={`${cell.count} questão${cell.count === 1 ? "" : "ões"} · ${formatPercent(cell.percent)}`}
                        >
                          {cell.count || ""}
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
    </div>
  );
}

function getMatrixMax(rows: CrossMatrixRow[]) {
  return Math.max(...rows.flatMap((row) => row.cells.map((cell) => cell.count)), 0);
}

function matrixCellColor(value: number, max: number) {
  if (!value || !max) return "hsl(var(--muted))";
  const opacity = 0.12 + (value / max) * 0.68;
  return `rgba(37, 99, 235, ${opacity})`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
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
