import type { RefObject } from "react";
import { AlertTriangle, Eye, FileText, ListOrdered, Loader2, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize, type PdfDocumentSummary, type PdfRenderedImage } from "@/lib/pdf-reader";
import { FlowStepper, type FlowStep } from "./FlowStepper";
import { PdfPageSelector } from "./PdfPageSelector";
import { PdfQueuePanel } from "./PdfQueuePanel";
import { RenderedPdfPreview } from "./RenderedPdfPreview";
import { StepBlock } from "./StepBlock";
import {
  MAX_PDF_PAGES,
  MAX_PDF_RENDER_PAGES,
  MAX_PDF_SIZE,
  PDF_QUEUE_BATCH_SIZE,
  type PdfQueueJob,
  type PdfQueueRunMode,
} from "./types";

export function PdfUploadPanel({
  steps,
  pdfInfo,
  loading,
  rendering,
  digitizing,
  dragOver,
  inputRef,
  selectedPages,
  rangeStart,
  rangeEnd,
  renderedImage,
  queue,
  activeQueueJobId,
  queueRunMode,
  queuePaused,
  onDragOverChange,
  onFile,
  onReset,
  onTogglePage,
  onRangeStartChange,
  onRangeEndChange,
  onSelectRange,
  onSelectFirstPages,
  onSelectAllPreparedPages,
  onClearSelection,
  onRenderPages,
  onDigitizePdf,
  onCreateQueue,
  onProcessNextQueueJob,
  onProcessAllQueueJobs,
  onProcessErrorQueueJobs,
  onPauseQueue,
  onResumeQueue,
  onCancelQueue,
  onProcessQueueJob,
  onOpenQueueJobReview,
  onOpenMassQueueReview,
  onClearQueue,
}: {
  steps: FlowStep[];
  pdfInfo: PdfDocumentSummary | null;
  loading: boolean;
  rendering: boolean;
  digitizing: boolean;
  dragOver: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  selectedPages: Set<number>;
  rangeStart: string;
  rangeEnd: string;
  renderedImage: PdfRenderedImage | null;
  queue: PdfQueueJob[];
  activeQueueJobId: string | null;
  queueRunMode: PdfQueueRunMode;
  queuePaused: boolean;
  onDragOverChange: (value: boolean) => void;
  onFile: (list: FileList | File[] | undefined | null) => void;
  onReset: () => void;
  onTogglePage: (page: number) => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onSelectRange: () => void;
  onSelectFirstPages: () => void;
  onSelectAllPreparedPages: () => void;
  onClearSelection: () => void;
  onRenderPages: () => void;
  onDigitizePdf: () => void;
  onCreateQueue: () => void;
  onProcessNextQueueJob: () => void;
  onProcessAllQueueJobs: () => void;
  onProcessErrorQueueJobs: () => void;
  onPauseQueue: () => void;
  onResumeQueue: () => void;
  onCancelQueue: () => void;
  onProcessQueueJob: (id: string) => void;
  onOpenQueueJobReview: (id: string) => void;
  onOpenMassQueueReview: () => void;
  onClearQueue: () => void;
}) {
  const selectedCount = selectedPages.size;
  const isBusy = rendering || digitizing || Boolean(activeQueueJobId) || queueRunMode !== "idle";
  const canUseBatch = selectedCount > 0 && selectedCount <= MAX_PDF_RENDER_PAGES && !isBusy;
  const canCreateQueue = selectedCount > 0 && !isBusy;
  const queueBatchCount = selectedCount > 0 ? Math.ceil(selectedCount / PDF_QUEUE_BATCH_SIZE) : 0;

  return (
    <div className="space-y-4">
      <FlowStepper steps={steps} />

      <StepBlock title="Etapa 2 — Enviar PDF" description="Envie um arquivo PDF para liberar seleção de páginas e processamento por lote.">
        {!pdfInfo ? (
          <div className="space-y-4">
            <label
              onDragOver={(e) => { e.preventDefault(); onDragOverChange(true); }}
              onDragLeave={() => onDragOverChange(false)}
              onDrop={(e) => {
                e.preventDefault();
                onDragOverChange(false);
                onFile(e.dataTransfer.files);
              }}
              className={`block cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors sm:p-16 ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => onFile(e.target.files)}
              />
              {loading ? <Loader2 className="mx-auto mb-3 size-10 animate-spin text-muted-foreground" /> : <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />}
              <p className="font-medium">Clique para selecionar ou arraste um PDF aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">PDF · até {formatFileSize(MAX_PDF_SIZE)} · leitura inicial de até {MAX_PDF_PAGES} páginas</p>
            </label>

            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <AlertTriangle className="size-4" /> Fluxo de PDF organizado por etapas
              </div>
              Depois do envio, escolha páginas, digitalize diretamente um lote pequeno ou crie uma fila para PDFs longos.
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-background">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-semibold">
                  <FileText className="size-5 text-primary" />
                  <span className="truncate">{pdfInfo.fileName}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">PDF carregado. Continue para a seleção de páginas.</p>
              </div>
              <Button type="button" variant="ghost" onClick={onReset} disabled={isBusy}>
                <X className="size-4" /> Remover PDF
              </Button>
            </div>

            <div className="grid gap-3 bg-muted/20 p-4 sm:grid-cols-4">
              <PdfMetric label="Tamanho" value={formatFileSize(pdfInfo.fileSize)} />
              <PdfMetric label="Páginas" value={String(pdfInfo.pageCount)} />
              <PdfMetric label="Preparadas" value={String(pdfInfo.readablePageCount)} />
              <PdfMetric label="Selecionadas" value={String(selectedCount)} />
            </div>
          </div>
        )}
      </StepBlock>

      {!pdfInfo && queue.length > 0 && (
        <StepBlock title="Fila temporária recuperada" description="Você ainda pode abrir revisões já concluídas. Para continuar processando pendentes, reenvie o mesmo PDF.">
          <PdfQueuePanel
            queue={queue}
            activeQueueJobId={activeQueueJobId}
            isBusy={isBusy}
            canProcess={false}
            runMode={queueRunMode}
            paused={queuePaused}
            onProcessNext={onProcessNextQueueJob}
            onProcessAll={onProcessAllQueueJobs}
            onProcessErrors={onProcessErrorQueueJobs}
            onPause={onPauseQueue}
            onResume={onResumeQueue}
            onCancel={onCancelQueue}
            onProcessJob={onProcessQueueJob}
            onOpenReview={onOpenQueueJobReview}
            onOpenMassReview={onOpenMassQueueReview}
            onClearQueue={onClearQueue}
          />
        </StepBlock>
      )}

      {pdfInfo && (
        <>
          {pdfInfo.isOverPageLimit && (
            <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>O PDF tem {pdfInfo.pageCount} páginas. Para não travar o navegador, este fluxo prepara até {MAX_PDF_PAGES} páginas.</span>
            </div>
          )}

          <StepBlock title="Etapa 3 — Selecionar páginas" description={`Escolha páginas específicas ou um intervalo. Para melhorar a extração, a fila divide em lotes de ${PDF_QUEUE_BATCH_SIZE} página${PDF_QUEUE_BATCH_SIZE === 1 ? "" : "s"}.`}>
            <PdfPageSelector
              pdfInfo={pdfInfo}
              selectedPages={selectedPages}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              isBusy={isBusy}
              onTogglePage={onTogglePage}
              onRangeStartChange={onRangeStartChange}
              onRangeEndChange={onRangeEndChange}
              onSelectRange={onSelectRange}
              onSelectFirstPages={onSelectFirstPages}
              onSelectAllPreparedPages={onSelectAllPreparedPages}
              onClearSelection={onClearSelection}
            />
          </StepBlock>

          <StepBlock title="Etapa 4 — Processar" description="Escolha entre digitalizar um lote pequeno agora ou criar uma fila para PDFs maiores.">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-medium">{selectedCount} página{selectedCount === 1 ? "" : "s"} selecionada{selectedCount === 1 ? "" : "s"}</p>
                <p className="text-xs text-muted-foreground">Para digitalizar direto, selecione até {MAX_PDF_RENDER_PAGES} páginas. Para PDF longo, crie fila por páginas e use processamento contínuo.</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button type="button" disabled={!canUseBatch} variant="default" className="gap-2" onClick={onDigitizePdf}>
                  {digitizing ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
                  {digitizing ? "Digitalizando..." : "Digitalizar e revisar"}
                </Button>
                <Button type="button" disabled={!canCreateQueue} variant="secondary" className="gap-2" onClick={onCreateQueue}>
                  <ListOrdered className="size-4" /> Criar fila{queueBatchCount > 0 ? ` (${queueBatchCount})` : ""}
                </Button>
              </div>
            </div>

            {selectedCount > MAX_PDF_RENDER_PAGES && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                Você selecionou {selectedCount} páginas. Para digitalizar direto, reduza para {MAX_PDF_RENDER_PAGES}. Para PDF maior, clique em <strong>Criar fila</strong>.
              </div>
            )}
          </StepBlock>

          <details className="rounded-xl border bg-card p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Eye className="size-4" /> Prévia técnica da imagem gerada</summary>
            <p className="mt-2 text-sm text-muted-foreground">Área secundária para conferir o `imageDataUrl`. O usuário comum pode usar diretamente <strong>Digitalizar e revisar</strong>.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" disabled={!canUseBatch} variant="outline" className="gap-2" onClick={onRenderPages}>
                {rendering ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                {rendering ? "Renderizando..." : "Gerar imagem"}
              </Button>
            </div>
            {renderedImage && <RenderedPdfPreview renderedImage={renderedImage} isBusy={isBusy} digitizing={digitizing} onDigitizePdf={onDigitizePdf} />}
          </details>

          {queue.length > 0 && (
            <StepBlock title="Etapa 5 — Revisar" description="Processe os lotes e abra revisão individual ou em massa sem apagar o progresso.">
              <PdfQueuePanel
                queue={queue}
                activeQueueJobId={activeQueueJobId}
                isBusy={isBusy}
                canProcess={Boolean(pdfInfo)}
                runMode={queueRunMode}
                paused={queuePaused}
                onProcessNext={onProcessNextQueueJob}
                onProcessAll={onProcessAllQueueJobs}
                onProcessErrors={onProcessErrorQueueJobs}
                onPause={onPauseQueue}
                onResume={onResumeQueue}
                onCancel={onCancelQueue}
                onProcessJob={onProcessQueueJob}
                onOpenReview={onOpenQueueJobReview}
                onOpenMassReview={onOpenMassQueueReview}
                onClearQueue={onClearQueue}
              />
            </StepBlock>
          )}
        </>
      )}
    </div>
  );
}

function PdfMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
