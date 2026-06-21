import { FileText, Image as ImageIcon, Layers, Link2, Shuffle } from "lucide-react";
import type { ProvaAnalysisSummary, ReferenceAnalysisRow } from "@/lib/prova-analysis";

export function AnalysisReferencePanel({ summary }: { summary: ProvaAnalysisSummary }) {
  const analysis = summary.referenceAnalysis;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="size-5 text-muted-foreground" />
          <h2 className="font-semibold">Análise de referências/textos-base</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Agrupa itens que compartilham a mesma referência. Quando existe grupo_id, ele é usado como chave principal para não contar a mesma referência várias vezes.
        </p>
      </div>

      {analysis.totalReferences === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma referência/texto-base encontrada nas questões analisadas.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <ReferenceMetricCard title="Referências" value={analysis.totalReferences} icon={<FileText className="size-5" />} />
            <ReferenceMetricCard title="Itens com referência" value={analysis.totalItemsWithReference} icon={<Link2 className="size-5" />} />
            <ReferenceMetricCard title="Média de itens" value={analysis.averageItemsPerReference} description="por referência" icon={<Layers className="size-5" />} />
            <ReferenceMetricCard title="Tamanho médio" value={analysis.averageTextLength} description="caracteres" icon={<FileText className="size-5" />} />
            <ReferenceMetricCard title="Com imagem" value={analysis.referencesWithImage} icon={<ImageIcon className="size-5" />} />
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">Referências com mais itens</h3>
                <p className="text-xs text-muted-foreground">Mostra quantos itens cada texto-base gerou e quais conteúdos aparecem nele.</p>
              </div>
              {analysis.referencesWithMixedContent > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">
                  <Shuffle className="size-3" /> {analysis.referencesWithMixedContent} mistura{analysis.referencesWithMixedContent === 1 ? "" : "m"} conteúdos
                </span>
              )}
            </div>
            <ReferenceTable rows={analysis.topReferences} />
          </div>
        </>
      )}
    </div>
  );
}

function ReferenceMetricCard({ title, value, description, icon }: { title: string; value: number; description?: string; icon: React.ReactNode }) {
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

function ReferenceTable({ rows }: { rows: ReferenceAnalysisRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">Referência</th>
            <th className="py-2 pr-3 text-right font-medium">Itens</th>
            <th className="py-2 pr-3 text-right font-medium">Tamanho</th>
            <th className="py-2 pr-3 font-medium">Conteúdos associados</th>
            <th className="py-2 pr-3 font-medium">Anos</th>
            <th className="py-2 font-medium">Características</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b align-top last:border-0">
              <td className="max-w-md py-3 pr-3">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {row.grupoId && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">grupo_id</span>}
                  {row.hasImage && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">imagem</span>}
                </div>
                <p className="line-clamp-3 text-sm">{row.preview}</p>
              </td>
              <td className="py-3 pr-3 text-right font-semibold">{row.itemCount}</td>
              <td className="py-3 pr-3 text-right">{row.textLength}</td>
              <td className="py-3 pr-3">
                <ChipList values={row.contents.length > 0 ? row.contents : ["Sem conteúdo"]} />
                {row.subcontents.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Subconteúdos: {row.subcontents.join("; ")}</p>}
              </td>
              <td className="py-3 pr-3 text-xs text-muted-foreground">{row.years.length > 0 ? row.years.join(", ") : "—"}</td>
              <td className="py-3">
                <span className={`rounded-full px-2 py-1 text-xs ${row.mixedContent ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground"}`}>
                  {row.mixedContent ? "mistura conteúdos" : "conteúdo único"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChipList({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.slice(0, 4).map((value) => (
        <span key={value} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{value}</span>
      ))}
      {values.length > 4 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+{values.length - 4}</span>}
    </div>
  );
}
