import { Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize, type PdfRenderedImage } from "@/lib/pdf-reader";
import { estimateDataUrlBytes } from "./utils";

export function RenderedPdfPreview({ renderedImage, isBusy, digitizing, onDigitizePdf }: {
  renderedImage: PdfRenderedImage;
  isBusy: boolean;
  digitizing: boolean;
  onDigitizePdf: () => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div>
          <h3 className="font-semibold">Imagem gerada do PDF</h3>
          <p className="text-sm text-muted-foreground">Esta é a imagem enviada para a IA no fluxo por PDF.</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>{renderedImage.pages.length} página{renderedImage.pages.length > 1 ? "s" : ""}</p>
          <p>{renderedImage.width}×{renderedImage.height}px</p>
          <p>{formatFileSize(estimateDataUrlBytes(renderedImage.imageDataUrl))}</p>
        </div>
      </div>
      <div className="bg-muted/20 p-4">
        <img src={renderedImage.imageDataUrl} alt="Páginas renderizadas do PDF" className="mx-auto max-h-[640px] max-w-full rounded-lg border bg-white object-contain" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-sm text-muted-foreground">
        <span>Páginas renderizadas: {renderedImage.pages.join(", ")}</span>
        <Button type="button" disabled={isBusy} variant="default" className="gap-2" onClick={onDigitizePdf}>
          {digitizing ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
          {digitizing ? "Digitalizando..." : "Digitalizar e abrir revisão"}
        </Button>
      </div>
    </div>
  );
}
