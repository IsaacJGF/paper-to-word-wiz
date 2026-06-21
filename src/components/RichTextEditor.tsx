import { useRef } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Subscript,
  Superscript,
  Table as TableIcon,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichText } from "@/components/RichText";

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  previewClassName?: string;
  onCursorChange?: (target: HTMLTextAreaElement) => void;
};

type SelectionPatch = {
  value: string;
  start: number;
  end: number;
};

export function RichTextEditor({
  value,
  onChange,
  rows = 4,
  placeholder,
  className,
  previewClassName,
  onCursorChange,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const rememberCursor = () => {
    if (textareaRef.current) onCursorChange?.(textareaRef.current);
  };

  const applyPatch = (build: (text: string, start: number, end: number) => SelectionPatch) => {
    const target = textareaRef.current;
    if (!target) return;
    const patch = build(value, target.selectionStart ?? 0, target.selectionEnd ?? target.selectionStart ?? 0);
    onChange(patch.value);
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(patch.start, patch.end);
      onCursorChange?.(target);
    });
  };

  const wrapSelection = (before: string, after: string, fallback = "texto") => {
    applyPatch((text, start, end) => {
      const selected = text.slice(start, end) || fallback;
      const value = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
      return {
        value,
        start: start + before.length,
        end: start + before.length + selected.length,
      };
    });
  };

  const wrapBlock = (tag: "left" | "center" | "right" | "justify") => {
    applyPatch((text, start, end) => {
      const range = expandToParagraph(text, start, end);
      const selected = text.slice(range.start, range.end) || "texto";
      const wrapped = `[${tag}]\n${selected}\n[/${tag}]`;
      return {
        value: `${text.slice(0, range.start)}${wrapped}${text.slice(range.end)}`,
        start: range.start + tag.length + 3,
        end: range.start + tag.length + 3 + selected.length,
      };
    });
  };

  const applyList = (kind: "bullet" | "number" | "letter") => {
    applyPatch((text, start, end) => {
      const range = expandToParagraph(text, start, end);
      const selected = text.slice(range.start, range.end) || "item";
      const lines = selected.split("\n");
      const listed = lines.map((line, index) => {
        const clean = line.replace(/^\s*(?:[-*•]|\d+[.)]|[A-Z][.)])\s+/, "");
        if (!clean.trim()) return clean;
        if (kind === "number") return `${index + 1}. ${clean}`;
        if (kind === "letter") return `${String.fromCharCode(65 + index)}. ${clean}`;
        return `- ${clean}`;
      }).join("\n");
      return {
        value: `${text.slice(0, range.start)}${listed}${text.slice(range.end)}`,
        start: range.start,
        end: range.start + listed.length,
      };
    });
  };

  const insertTable = () => {
    const rowsInput = prompt("Quantas linhas?", "3");
    if (rowsInput === null) return;
    const colsInput = prompt("Quantas colunas?", "3");
    if (colsInput === null) return;
    const rows = clampInteger(rowsInput, 1, 12, 3);
    const cols = clampInteger(colsInput, 1, 8, 3);
    const header = `| ${Array.from({ length: cols }, (_, i) => `Coluna ${i + 1}`).join(" | ")} |`;
    const separator = `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`;
    const body = Array.from({ length: Math.max(1, rows - 1) }, () => `| ${Array.from({ length: cols }, () => " ").join(" | ")} |`).join("\n");
    const table = `\n\n${header}\n${separator}\n${body}\n\n`;
    applyPatch((text, start, end) => ({
      value: `${text.slice(0, start)}${table}${text.slice(end)}`,
      start: start + 2,
      end: start + table.length - 2,
    }));
  };

  return (
    <div className="space-y-2 rounded-md border bg-background p-2">
      <div className="flex flex-wrap items-center gap-1 border-b pb-2">
        <ToolbarButton title="Negrito" onClick={() => wrapSelection("**", "**")}><Bold className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Itálico" onClick={() => wrapSelection("*", "*")}><Italic className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Sublinhado" onClick={() => wrapSelection("<u>", "</u>")}><Underline className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Sombreamento" onClick={() => wrapSelection("<mark>", "</mark>")}><Highlighter className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Sobrescrito" onClick={() => wrapSelection("<sup>", "</sup>", "2")}><Superscript className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Subscrito" onClick={() => wrapSelection("<sub>", "</sub>", "2")}><Subscript className="size-3.5" /></ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border" />
        <ToolbarButton title="Alinhar à esquerda" onClick={() => wrapBlock("left")}><AlignLeft className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Centralizar" onClick={() => wrapBlock("center")}><AlignCenter className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Alinhar à direita" onClick={() => wrapBlock("right")}><AlignRight className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Justificar" onClick={() => wrapBlock("justify")}><AlignJustify className="size-3.5" /></ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border" />
        <ToolbarButton title="Lista com marcadores" onClick={() => applyList("bullet")}><List className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Lista numerada" onClick={() => applyList("number")}><ListOrdered className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Lista com letras" onClick={() => applyList("letter")}><Pilcrow className="size-3.5" /></ToolbarButton>
        <ToolbarButton title="Inserir tabela" onClick={insertTable}><TableIcon className="size-3.5" /></ToolbarButton>
      </div>

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onSelect={rememberCursor}
        onClick={rememberCursor}
        onKeyUp={rememberCursor}
        rows={rows}
        placeholder={placeholder}
        className={className ?? "text-sm"}
      />

      {value.trim() && (
        <div className="rounded-md border bg-muted/30 p-2 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Prévia visual</p>
          <RichText text={value} className={previewClassName ?? "leading-relaxed"} />
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="icon" variant="ghost" className="size-8" title={title} aria-label={title} onClick={onClick}>
      {children}
    </Button>
  );
}

function expandToParagraph(text: string, start: number, end: number) {
  let blockStart = start;
  let blockEnd = end;
  while (blockStart > 0 && text[blockStart - 1] !== "\n") blockStart--;
  while (blockEnd < text.length && text[blockEnd] !== "\n") blockEnd++;
  return { start: blockStart, end: blockEnd };
}

function clampInteger(value: string, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
