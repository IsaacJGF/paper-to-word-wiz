import { MessageSquareText, TextSearch } from "lucide-react";
import type { ProvaAnalysisSummary, TermFrequencyRow } from "@/lib/prova-analysis";

export function AnalysisLanguagePanel({ summary }: { summary: ProvaAnalysisSummary }) {
  const hasAnyData = summary.generalTermFrequency.length > 0 || summary.physicsTermFrequency.length > 0 || summary.commandFrequency.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <TextSearch className="size-5 text-muted-foreground" />
          <h2 className="font-semibold">Análise de termos e comandos</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Contagem feita em referência/texto-base, enunciado e alternativas. A análise ignora maiúsculas, minúsculas e acentos para encontrar padrões de linguagem da prova.
        </p>
        {!hasAnyData && <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">Nenhum dos termos monitorados foi encontrado na base analisada.</p>}
      </div>

      {hasAnyData && (
        <div className="grid gap-4 xl:grid-cols-3">
          <TermRankingCard title="Termos gerais da banca" rows={summary.generalTermFrequency} emptyText="Nenhum termo geral encontrado." />
          <TermRankingCard title="Termos específicos de Física" rows={summary.physicsTermFrequency} emptyText="Nenhum termo físico encontrado." />
          <TermRankingCard title="Comandos mais frequentes" rows={summary.commandFrequency} emptyText="Nenhum comando padrão encontrado." />
        </div>
      )}
    </div>
  );
}

function TermRankingCard({ title, rows, emptyText }: { title: string; rows: TermFrequencyRow[]; emptyText: string }) {
  const visible = rows.slice(0, 12);
  const max = Math.max(...visible.map((row) => row.count), 0);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{visible.length} termo{visible.length === 1 ? "" : "s"}</span>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => (
            <div key={row.term} className="rounded-lg border bg-background p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{row.term}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.count} ocorrência{row.count === 1 ? "" : "s"} · {row.questionCount} questão{row.questionCount === 1 ? "" : "ões"} · {formatPercent(row.percent)} da base
                  </p>
                </div>
                <strong className="text-sm">{row.count}</strong>
              </div>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(4, max > 0 ? (row.count / max) * 100 : 0)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">Anos: {row.years.length > 0 ? row.years.join(", ") : "—"}</p>
              {row.examples.length > 0 && <TermExamples examples={row.examples} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TermExamples({ examples }: { examples: TermFrequencyRow["examples"] }) {
  return (
    <details className="mt-2 rounded-md bg-muted/40 p-2 text-xs">
      <summary className="flex cursor-pointer items-center gap-1 font-medium text-muted-foreground">
        <MessageSquareText className="size-3" /> Ver exemplos reais
      </summary>
      <div className="mt-2 space-y-2">
        {examples.map((example) => (
          <div key={`${example.questionId}-${example.preview}`} className="rounded-md bg-card p-2">
            <p className="mb-1 text-[11px] text-muted-foreground">
              {example.prova || "Prova não informada"}{example.ano ? ` · ${example.ano}` : ""}{example.numero ? ` · Item ${example.numero}` : ""}
            </p>
            <p className="line-clamp-3">{example.preview}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
