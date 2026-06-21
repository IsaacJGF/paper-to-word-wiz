import { useMemo, useState, type ReactNode } from "react";
import { ClipboardCopy, FileText, Layers, ListChecks, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProvaAnalysisSummary } from "@/lib/prova-analysis";
import { buildSimulationSuggestion, getDefaultSimulationSize, suggestionToText, type SimulationAllocationRow } from "@/lib/prova-simulation-suggestion";
import { toast } from "sonner";

export function AnalysisSimulationSuggestionPanel({ summary }: { summary: ProvaAnalysisSummary }) {
  const defaultSize = useMemo(() => getDefaultSimulationSize(summary), [summary]);
  const [targetCount, setTargetCount] = useState(defaultSize);
  const suggestion = useMemo(() => buildSimulationSuggestion(summary, targetCount), [summary, targetCount]);

  const copySuggestion = async () => {
    try {
      await navigator.clipboard.writeText(suggestionToText(suggestion));
      toast.success("Roteiro do simulado copiado.");
    } catch (error) {
      console.error("Erro ao copiar sugestão de simulado:", error);
      toast.error("Não foi possível copiar o roteiro.");
    }
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <WandSparkles className="size-5 text-muted-foreground" />
            <h2 className="font-semibold">Sugestão de simulado</h2>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Gera um roteiro de simulado usando apenas os padrões da base analisada: conteúdos, tipos de questão, recursos, comandos e linguagem recorrente.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={copySuggestion} className="gap-2">
          <ClipboardCopy className="size-4" /> Copiar roteiro
        </Button>
      </div>

      {suggestion.sampleWarning && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          {suggestion.sampleWarning}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <div className="rounded-lg border bg-background p-3">
          <Label htmlFor="simulation-size">Quantidade de itens</Label>
          <Input
            id="simulation-size"
            className="mt-2"
            type="number"
            min={1}
            max={120}
            value={targetCount}
            onChange={(event) => setTargetCount(Number(event.target.value))}
          />
          <p className="mt-2 text-xs text-muted-foreground">A distribuição abaixo se ajusta automaticamente à quantidade escolhida.</p>
        </div>

        <div className="rounded-lg border bg-background p-3">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <h3 className="font-semibold">Roteiro de montagem</h3>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {suggestion.assemblyGuide.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SuggestionTable title="Distribuição por conteúdo" icon={<Layers className="size-4" />} rows={suggestion.contentDistribution} emptyText="Não há conteúdos suficientes para sugerir distribuição." />
        <SuggestionTable title="Distribuição por tipo de questão" icon={<ListChecks className="size-4" />} rows={suggestion.typeDistribution} emptyText="Não há tipos suficientes para sugerir distribuição." />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ResourceTable rows={suggestion.resourceUse} />
        <LanguageBox commands={suggestion.commands} generalTerms={suggestion.generalTerms} physicsTerms={suggestion.physicsTerms} />
      </div>

      <details className="rounded-lg border bg-muted/30 p-3 text-sm">
        <summary className="cursor-pointer font-medium">Dados usados para gerar a sugestão</summary>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {suggestion.dataUsed.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </details>
    </div>
  );
}

function SuggestionTable({ title, icon, rows, emptyText }: { title: string; icon: ReactNode; rows: SimulationAllocationRow[]; emptyText: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-2 font-medium">Item</th>
                <th className="py-2 pr-2 text-right font-medium">Sugerido</th>
                <th className="py-2 pr-2 text-right font-medium">Base</th>
                <th className="py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-2 pr-2 align-top">
                    <p className="font-medium">{row.label}</p>
                    {row.years && row.years.length > 0 && <p className="text-xs text-muted-foreground">Anos: {row.years.join(", ")}</p>}
                  </td>
                  <td className="py-2 pr-2 text-right align-top font-semibold">{row.suggestedCount}</td>
                  <td className="py-2 pr-2 text-right align-top">{row.sourceCount}</td>
                  <td className="py-2 text-right align-top">{formatPercent(row.percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ResourceTable({ rows }: { rows: Array<{ label: string; suggestedCount: number; sourceCount: number; percent: number }> }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <h3 className="mb-3 font-semibold">Recursos da prova</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span>{row.label}</span>
              <strong>{row.suggestedCount} sugerido{row.suggestedCount === 1 ? "" : "s"}</strong>
            </div>
            <p className="text-xs text-muted-foreground">Base: {row.sourceCount} questão{row.sourceCount === 1 ? "" : "ões"} · {formatPercent(row.percent)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LanguageBox({ commands, generalTerms, physicsTerms }: { commands: string[]; generalTerms: string[]; physicsTerms: string[] }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <h3 className="mb-3 font-semibold">Linguagem sugerida</h3>
      <LanguageLine label="Comandos" values={commands} />
      <LanguageLine label="Termos gerais" values={generalTerms} />
      <LanguageLine label="Termos de Física" values={physicsTerms} />
    </div>
  );
}

function LanguageLine({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => <span key={value} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{value}</span>)}
        </div>
      )}
    </div>
  );
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
