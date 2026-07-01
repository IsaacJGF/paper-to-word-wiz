import { FileText, Loader2, Pause, Play, RotateCcw, ScanLine, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/pdf-reader";
import type { PdfQueueJob, PdfQueueRunMode, PdfQueueStatus } from "./types";
import { formatPages } from "./utils";

export function PdfQueuePanel({
  queue,
  activeQueueJobId,
  isBusy,
  canProcess,
  runMode,
  paused,
  onProcessNext,
  onProcessAll,
  onProcessErrors,
  onPause,
  onResume,
  onCancel,
  onProcessJob,
  onOpenReview,
  onOpenMassReview,
  onClearQueue,
}: {
  queue: PdfQueueJob[];
  activeQueueJobId: string | null;
  isBusy: boolean;
  canProcess: boolean;
  runMode: PdfQueueRunMode;
  paused: boolean;
  onProcessNext: () => void;
  onProcessAll: () => void;
  onProcessErrors: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onProcessJob: (id: string) => void;
  onOpenReview: (id: string) => void;
  onOpenMassReview: () => void;
  onClearQueue: () => void;
}) {
  const doneCount = queue.filter((job) => job.status === "done").length;
  const reviewedCount = queue.filter((job) => job.reviewed).length;
  const errorCount = queue.filter((job) => job.status === "error").length;
  const pendingCount = queue.filter((job) => job.status === "pending").length;
  const questionCount = queue.reduce((sum, job) => sum + (job.result?.questionCount ?? job.result?.draft.questoes.length ?? 0), 0);
  const percent = queue.length > 0 ? Math.round((doneCount / queue.length) * 100) : 0;
  const running = runMode !== "idle";

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div>
          <h3 className="font-semibold">Fila de digitalização do PDF</h3>
          <p className="text-sm text-muted-foreground">
            {queue.length} lote{queue.length > 1 ? "s" : ""} · {doneCount} concluído{doneCount === 1 ? "" : "s"} · {reviewedCount} revisado{reviewedCount === 1 ? "" : "s"} · {pendingCount} pendente{pendingCount === 1 ? "" : "s"}{errorCount > 0 ? ` · ${errorCount} com erro` : ""}
          </p>
          {questionCount > 0 && <p className="mt-1 text-xs text-muted-foreground">{questionCount} item{questionCount === 1 ? "" : "s"} extraído{questionCount === 1 ? "" : "s"} temporariamente.</p>}
          {!canProcess && pendingCount + errorCount > 0 && (
            <p className="mt-1 text-xs text-amber-700">Para continuar processando lotes pendentes, reenvie o mesmo PDF. Os lotes concluídos continuam disponíveis para revisão.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!canProcess || isBusy || pendingCount === 0} onClick={onProcessNext} className="gap-2">
            {activeQueueJobId ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
            Processar próximo lote
          </Button>
          <Button type="button" variant="secondary" disabled={!canProcess || isBusy || pendingCount === 0} onClick={onProcessAll} className="gap-2">
            <Play className="size-4" /> Processar todos pendentes
          </Button>
          <Button type="button" variant="outline" disabled={!canProcess || isBusy || errorCount === 0} onClick={onProcessErrors} className="gap-2">
            <RotateCcw className="size-4" /> Reprocessar erros
          </Button>
          {running && !paused && <Button type="button" variant="outline" onClick={onPause} className="gap-2"><Pause className="size-4" /> Pausar</Button>}
          {running && paused && <Button type="button" variant="outline" onClick={onResume} className="gap-2"><Play className="size-4" /> Continuar</Button>}
          {running && <Button type="button" variant="outline" onClick={onCancel} className="gap-2"><Square className="size-4" /> Cancelar</Button>}
          <Button type="button" variant="default" disabled={isBusy || doneCount === 0} onClick={onOpenMassReview} className="gap-2">
            <FileText className="size-4" /> Revisar concluídos em massa
          </Button>
          <Button type="button" variant="ghost" disabled={isBusy} onClick={onClearQueue}>Limpar fila</Button>
        </div>
      </div>

      <div className="border-b bg-muted/20 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progresso de processamento</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Abrir uma revisão não apaga a fila. O processamento contínuo roda um lote por vez, com pausa curta entre lotes.
        </p>
      </div>

      <div className="divide-y">
        {queue.map((job, index) => {
          const processing = job.status === "processing" || activeQueueJobId === job.id;
          return (
            <div key={job.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">Lote {index + 1}</strong>
                  <StatusBadge status={job.status} />
                  {job.reviewed && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">revisão aberta</span>}
                  <span className="text-xs text-muted-foreground">Páginas {formatPages(job.pages)}</span>
                </div>
                {job.result && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Resultado temporário guardado · {job.result.questionCount} item{job.result.questionCount === 1 ? "" : "s"} · {formatFileSize(job.result.imageSize)} · {new Date(job.result.processedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {job.reviewedAt && <p className="mt-1 text-xs text-muted-foreground">Revisão aberta às {new Date(job.reviewedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</p>}
                {job.error && <p className="mt-1 text-xs text-destructive">{job.error}</p>}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {job.status === "done" && <Button type="button" size="sm" onClick={() => onOpenReview(job.id)}>Abrir revisão</Button>}
                {job.status === "pending" && <Button type="button" size="sm" variant="outline" disabled={!canProcess || isBusy} onClick={() => onProcessJob(job.id)}>Processar</Button>}
                {job.status === "error" && <Button type="button" size="sm" variant="outline" disabled={!canProcess || isBusy} onClick={() => onProcessJob(job.id)}>Tentar novamente</Button>}
                {processing && <Button type="button" size="sm" variant="outline" disabled className="gap-2"><Loader2 className="size-3 animate-spin" /> Processando</Button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PdfQueueStatus }) {
  const labels: Record<PdfQueueStatus, string> = {
    pending: "pendente",
    processing: "processando",
    done: "concluído",
    error: "erro",
  };
  const className = status === "done"
    ? "bg-emerald-100 text-emerald-800"
    : status === "error"
      ? "bg-destructive/10 text-destructive"
      : status === "processing"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{labels[status]}</span>;
}
