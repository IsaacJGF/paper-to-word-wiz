import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PdfDocumentSummary } from "@/lib/pdf-reader";
import { MAX_PDF_RENDER_PAGES, MAX_VISIBLE_PAGE_CARDS } from "./types";
import { onlyDigits } from "./utils";

export function PdfPageSelector({
  pdfInfo,
  selectedPages,
  rangeStart,
  rangeEnd,
  isBusy,
  onTogglePage,
  onRangeStartChange,
  onRangeEndChange,
  onSelectRange,
  onSelectFirstPages,
  onSelectAllPreparedPages,
  onClearSelection,
}: {
  pdfInfo: PdfDocumentSummary;
  selectedPages: Set<number>;
  rangeStart: string;
  rangeEnd: string;
  isBusy: boolean;
  onTogglePage: (page: number) => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onSelectRange: () => void;
  onSelectFirstPages: () => void;
  onSelectAllPreparedPages: () => void;
  onClearSelection: () => void;
}) {
  const visiblePages = Array.from({ length: Math.min(pdfInfo.readablePageCount, MAX_VISIBLE_PAGE_CARDS) }, (_, index) => index + 1);
  const hiddenPageCount = Math.max(0, pdfInfo.readablePageCount - visiblePages.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSelectFirstPages} disabled={isBusy}>Primeiras {Math.min(MAX_PDF_RENDER_PAGES, pdfInfo.readablePageCount)}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onSelectAllPreparedPages} disabled={isBusy}>Todas preparadas</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClearSelection} disabled={isBusy}>Limpar</Button>
      </div>

      <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="pdf-range-start">Página inicial</label>
          <Input id="pdf-range-start" value={rangeStart} onChange={(event) => onRangeStartChange(onlyDigits(event.target.value))} inputMode="numeric" placeholder="1" disabled={isBusy} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="pdf-range-end">Página final</label>
          <Input id="pdf-range-end" value={rangeEnd} onChange={(event) => onRangeEndChange(onlyDigits(event.target.value))} inputMode="numeric" placeholder="1" disabled={isBusy} />
        </div>
        <Button type="button" onClick={onSelectRange} disabled={isBusy}>Selecionar intervalo</Button>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Páginas detectadas</h3>
            <p className="text-xs text-muted-foreground">Clique em uma página para marcar ou desmarcar.</p>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{selectedPages.size} selecionada{selectedPages.size === 1 ? "" : "s"}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
          {visiblePages.map((page) => {
            const selected = selectedPages.has(page);
            return (
              <button
                key={page}
                type="button"
                onClick={() => onTogglePage(page)}
                disabled={isBusy}
                className={`rounded-lg border p-2 text-center text-xs transition disabled:cursor-not-allowed disabled:opacity-70 ${selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:bg-muted"}`}
              >
                <div className={`mb-1 flex h-14 items-center justify-center rounded ${selected ? "bg-primary-foreground/15" : "bg-muted/50"}`}>
                  <FileText className="size-5" />
                </div>
                Página {page}
              </button>
            );
          })}
          {hiddenPageCount > 0 && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-2 text-center text-xs text-muted-foreground">
              <div className="mb-1 flex h-14 items-center justify-center rounded bg-muted/50">+{hiddenPageCount}</div>
              páginas ocultas
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
