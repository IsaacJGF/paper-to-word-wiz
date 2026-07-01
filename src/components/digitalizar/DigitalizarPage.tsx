import { type ReactNode } from "react";
import { FileText, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { ImageUploadPanel } from "./ImageUploadPanel";
import { PdfUploadPanel } from "./PdfUploadPanel";
import { useDigitalizarController } from "./useDigitalizarController";

export function DigitalizarPage() {
  const c = useDigitalizarController();

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Digitalizar questão</h1>
          <p className="mt-1 text-muted-foreground">Escolha a origem, envie o arquivo, selecione as partes e mande para revisão.</p>
        </header>

        <section className="mb-5 rounded-xl border bg-card p-4">
          <div className="mb-3">
            <h2 className="font-semibold">Etapa 1 — Escolher origem</h2>
            <p className="text-sm text-muted-foreground">Use imagem para uma questão rápida ou PDF para provas maiores.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeButton active={c.mode === "image"} icon={<ImageIcon className="size-4" />} title="Imagens" description="JPG, PNG ou WEBP em partes sequenciais." onClick={() => c.setMode("image")} />
            <ModeButton active={c.mode === "pdf"} icon={<FileText className="size-4" />} title="PDF" description="Selecione páginas, crie fila e revise em massa." onClick={() => c.setMode("pdf")} />
          </div>
        </section>

        {c.mode === "image" ? (
          <ImageUploadPanel
            images={c.images}
            loading={c.loading}
            rotation={c.rotation}
            dragOver={c.dragOver}
            inputRef={c.imageInputRef}
            onDragOverChange={c.setDragOver}
            onFiles={c.handleFiles}
            onRemoveImage={c.removeImage}
            onReset={c.resetImages}
            onRotate={() => c.setRotation((r) => (r + 90) % 360)}
            onDigitize={c.onDigitize}
          />
        ) : (
          <PdfUploadPanel
            steps={c.pdfSteps}
            pdfInfo={c.pdfInfo}
            loading={c.pdfLoading}
            rendering={c.pdfRendering}
            digitizing={c.pdfDigitizing}
            dragOver={c.pdfDragOver}
            inputRef={c.pdfInputRef}
            selectedPages={c.selectedPdfPages}
            rangeStart={c.rangeStart}
            rangeEnd={c.rangeEnd}
            renderedImage={c.renderedPdfImage}
            queue={c.pdfQueue}
            activeQueueJobId={c.activeQueueJobId}
            queueRunMode={c.queueRunMode}
            queuePaused={c.queuePaused}
            onDragOverChange={c.setPdfDragOver}
            onFile={c.handlePdfFile}
            onReset={c.resetPdf}
            onTogglePage={c.togglePdfPage}
            onRangeStartChange={c.setRangeStart}
            onRangeEndChange={c.setRangeEnd}
            onSelectRange={c.selectPdfRange}
            onSelectFirstPages={c.selectFirstPdfPages}
            onSelectAllPreparedPages={c.selectAllPreparedPdfPages}
            onClearSelection={c.clearPdfSelection}
            onRenderPages={() => { void c.renderSelectedPdfPages(); }}
            onDigitizePdf={() => { void c.onDigitizePdf(); }}
            onCreateQueue={c.createPdfQueueFromSelection}
            onProcessNextQueueJob={c.processNextQueueJob}
            onProcessAllQueueJobs={() => { void c.processQueueContinuously("pending"); }}
            onProcessErrorQueueJobs={() => { void c.processQueueContinuously("errors"); }}
            onPauseQueue={c.pauseQueueProcessing}
            onResumeQueue={c.resumeQueueProcessing}
            onCancelQueue={c.cancelQueueProcessing}
            onProcessQueueJob={(id) => { void c.processQueueJob(id); }}
            onOpenQueueJobReview={c.openQueueJobReview}
            onOpenMassQueueReview={c.openMassQueueReview}
            onClearQueue={c.clearPdfQueue}
          />
        )}
      </div>
    </AppLayout>
  );
}

function ModeButton({ active, icon, title, description, onClick }: { active: boolean; icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-3 text-left transition ${active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:bg-muted"}`}>
      <span className="flex items-center gap-2 font-semibold">{icon} {title}</span>
      <span className={`mt-1 block text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{description}</span>
    </button>
  );
}
