import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Math as DocxMath,
  MathRun,
  MathSuperScript,
  MathSubScript,
  MathFraction,
  MathRadical,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  TextWrappingSide,
} from "docx";
import { normalizeImagePlacementLayout, type ImagePlacementLayout } from "@/lib/image-layout";

const Alt = z.object({ letra: z.string(), texto: z.string(), imagem: z.string().nullable().optional() });
const ImagePlacement = z.any().nullable().optional();
const QInput = z.object({
  id: z.string(),
  numero: z.string().nullable().optional(),
  enunciado: z.string(),
  alternativas: z.array(Alt),
  resposta: z.string().nullable().optional(),
  fonte: z.string().nullable().optional(),
  referencia_texto: z.string().nullable().optional(),
  referencia_fonte: z.string().nullable().optional(),
  referencia_imagem: z.string().nullable().optional(),
  referencia_imagem_pos: z.string().nullable().optional(),
  referencia_imagem_layout: ImagePlacement,
  referencia_texto_apos: z.string().nullable().optional(),
  grupo_id: z.string().nullable().optional(),
  enunciado_imagem: z.string().nullable().optional(),
  enunciado_imagem_pos: z.string().nullable().optional(),
  enunciado_imagem_layout: ImagePlacement,
});

const Input = z.object({
  questions: z.array(QInput),
  config: z.object({
    titulo: z.string().optional(),
    instituicao: z.string().optional(),
    disciplina: z.string().optional(),
    professor: z.string().optional(),
    turma: z.string().optional(),
    data: z.string().optional(),
    instrucoes: z.string().optional(),
    fontSize: z.number().default(12),
    incluirGabarito: z.boolean().default(false),
    gabaritoSeparado: z.boolean().default(false),
    espacamentoQuestoes: z.number().default(240),
  }),
});

function stripLatex(s: string): string {
  // Lightweight LaTeX → plain unicode rendering for .docx text runs.
  return s
    .replace(/\$\$([^$]+)\$\$/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\alpha/g, "α").replace(/\\beta/g, "β").replace(/\\gamma/g, "γ")
    .replace(/\\delta/g, "δ").replace(/\\Delta/g, "Δ").replace(/\\theta/g, "θ")
    .replace(/\\lambda/g, "λ").replace(/\\mu/g, "μ").replace(/\\pi/g, "π")
    .replace(/\\sigma/g, "σ").replace(/\\Omega/g, "Ω").replace(/\\omega/g, "ω")
    .replace(/\\times/g, "×").replace(/\\cdot/g, "·").replace(/\\pm/g, "±")
    .replace(/\\leq/g, "≤").replace(/\\geq/g, "≥").replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈").replace(/\\infty/g, "∞").replace(/\\rightarrow/g, "→")
    .replace(/\^\{([^}]+)\}/g, "^($1)")
    .replace(/_\{([^}]+)\}/g, "_($1)")
    .replace(/\^(\w)/g, "^$1").replace(/_(\w)/g, "_$1")
    .replace(/\\\\/g, "\n")
    .replace(/\\,/g, " ").replace(/\\ /g, " ");
}

type MathComponent = ConstructorParameters<typeof DocxMath>[0]["children"][number];

const MATH_SYMBOLS: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  Delta: "Δ",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  sigma: "σ",
  Omega: "Ω",
  omega: "ω",
  times: "×",
  cdot: "·",
  pm: "±",
  leq: "≤",
  geq: "≥",
  neq: "≠",
  approx: "≈",
  infty: "∞",
  rightarrow: "→",
};

function readLatexScript(input: string, start: number): { value: string; end: number } {
  if (input[start] === "{") {
    let depth = 1;
    let i = start + 1;
    while (i < input.length && depth > 0) {
      if (input[i] === "{") depth++;
      if (input[i] === "}") depth--;
      i++;
    }
    return { value: input.slice(start + 1, Math.max(start + 1, i - 1)), end: i };
  }

  if (input[start] === "\\") {
    const command = input.slice(start).match(/^\\[A-Za-z]+/);
    if (command) return { value: command[0], end: start + command[0].length };
  }

  return { value: input[start] ?? "", end: start + 1 };
}

function readLatexGroup(input: string, start: number): { value: string; end: number } | null {
  if (input[start] !== "{") return null;
  return readLatexScript(input, start);
}

function latexToMathComponents(latex: string): MathComponent[] {
  const components: MathComponent[] = [];
  let text = "";

  const flushText = () => {
    if (text) {
      components.push(new MathRun(text));
      text = "";
    }
  };

  for (let i = 0; i < latex.length;) {
    const char = latex[i];

    if (char === "\\" && latex[i + 1] === "\\") {
      text += " ";
      i += 2;
      continue;
    }

    if (char === "\\") {
      const commandMatch = latex.slice(i + 1).match(/^[A-Za-z]+/);
      const command = commandMatch?.[0] ?? "";

      if (command === "frac") {
        flushText();
        const numerator = readLatexGroup(latex, i + 1 + command.length);
        const denominator = numerator ? readLatexGroup(latex, numerator.end) : null;
        if (numerator && denominator) {
          components.push(new MathFraction({
            numerator: latexToMathComponents(numerator.value),
            denominator: latexToMathComponents(denominator.value),
          }));
          i = denominator.end;
          continue;
        }
      }

      if (command === "sqrt") {
        flushText();
        const radicand = readLatexGroup(latex, i + 1 + command.length);
        if (radicand) {
          components.push(new MathRadical({ children: latexToMathComponents(radicand.value) }));
          i = radicand.end;
          continue;
        }
      }

      text += MATH_SYMBOLS[command] ?? command;
      i += command ? command.length + 1 : 1;
      continue;
    }

    if ((char === "^" || char === "_") && i + 1 < latex.length) {
      flushText();
      const base = components.pop() ?? new MathRun("");
      const script = readLatexScript(latex, i + 1);
      const scriptComponents = latexToMathComponents(script.value);
      components.push(char === "^"
        ? new MathSuperScript({ children: [base], superScript: scriptComponents })
        : new MathSubScript({ children: [base], subScript: scriptComponents }));
      i = script.end;
      continue;
    }

    if (char === "{" || char === "}") {
      i++;
      continue;
    }

    text += char;
    i++;
  }

  flushText();
  return components.length > 0 ? components : [new MathRun(latex)];
}

function latexMathRun(latex: string) {
  return new DocxMath({ children: latexToMathComponents(latex.trim()) });
}

type TextOptions = {
  size: number;
  bold?: boolean;
  color?: string;
  align?: typeof AlignmentType[keyof typeof AlignmentType];
  spacingAfter?: number;
};

function runsFromText(text: string, opts: TextOptions) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g).filter(Boolean);
  return parts.flatMap((part) => {
    const isMath = (part.startsWith("$$") && part.endsWith("$$")) || (part.startsWith("$") && part.endsWith("$"));
    if (isMath) {
      const latex = part.replace(/^\$\$?/, "").replace(/\$\$?$/, "");
      return [latexMathRun(latex)];
    }

    const lines = stripLatex(part).split("\n");
    return lines.flatMap((line, i) => {
      const runs = [new TextRun({ text: line, size: opts.size * 2, bold: opts.bold, font: "Arial", color: opts.color })];
      if (i < lines.length - 1) runs.push(new TextRun({ break: 1, font: "Arial", color: opts.color }));
      return runs;
    });
  });
}

function paragraphFromText(text: string, opts: TextOptions) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { after: opts.spacingAfter ?? 120, line: 300 },
    children: runsFromText(text, opts),
  });
}

type ImgInfo = { buffer: Buffer; type: "png" | "jpg" | "gif" | "bmp"; width: number; height: number };

function decodeDataUrl(dataUrl: string): ImgInfo | null {
  const m = dataUrl.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  const type: ImgInfo["type"] = ext === "jpeg" || ext === "jpg" ? "jpg" : (ext as ImgInfo["type"]);
  const buffer = Buffer.from(m[2], "base64");
  const dims = readImageSize(buffer, type);
  return { buffer, type, width: dims.w, height: dims.h };
}

function readImageSize(buf: Buffer, type: ImgInfo["type"]): { w: number; h: number } {
  try {
    if (type === "png" && buf.length >= 24) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    if (type === "jpg") {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (type === "gif" && buf.length >= 10) {
      return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    }
  } catch {}
  return { w: 400, h: 300 };
}

const PLACEMENT_SURFACE_HEIGHT_PX = 300;
const EMUS_PER_PIXEL = 9525;

function imageParagraph(dataUrl: string, maxWidthPx: number, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.CENTER, forceHeightPx?: number, placementInput?: unknown): Paragraph | null {
  const img = decodeDataUrl(dataUrl);
  if (!img) return null;

  const placement = readPlacement(placementInput);
  if (placement) {
    const width = Math.max(40, Math.min(maxWidthPx, (maxWidthPx * placement.width) / 100));
    const height = Math.max(30, (PLACEMENT_SURFACE_HEIGHT_PX * placement.height) / 100);
    const x = (maxWidthPx * placement.x) / 100;
    const y = (PLACEMENT_SURFACE_HEIGHT_PX * placement.y) / 100;
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [new ImageRun({
        type: img.type,
        data: img.buffer,
        transformation: { width: Math.round(width), height: Math.round(height), rotation: placement.rotation },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: pxToEmu(x) },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: pxToEmu(y) },
          wrap: { type: TextWrappingType.SQUARE, side: TextWrappingSide.BOTH_SIDES },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          allowOverlap: true,
          layoutInCell: true,
        },
      })],
    });
  }

  let width: number;
  let height: number;
  if (forceHeightPx) {
    height = forceHeightPx;
    width = Math.min(maxWidthPx, (img.width / img.height) * height);
  } else {
    const ratio = img.height / img.width;
    width = Math.min(maxWidthPx, img.width);
    height = width * ratio;
  }
  return new Paragraph({
    alignment: align,
    spacing: { after: 120 },
    children: [new ImageRun({
      type: img.type,
      data: img.buffer,
      transformation: { width: Math.round(width), height: Math.round(height) },
    })],
  });
}

function readPlacement(value: unknown): ImagePlacementLayout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return normalizeImagePlacementLayout(value as Partial<ImagePlacementLayout>);
}

function pxToEmu(value: number) {
  return Math.round(value * EMUS_PER_PIXEL);
}

export const generateDocx = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { questions, config } = data;
    const size = config.fontSize;

    const children: Paragraph[] = [];

    // Content width on A4 with 1134 twip margins ≈ 9638 twips ≈ 642 px @96dpi
    const CONTENT_WIDTH_PX = 640;

    // Normalize alternative image heights across the whole document (same size = consistent layout)
    let altImgHeightPx = 0;
    for (const q of questions) {
      for (const a of q.alternativas) {
        if (a.imagem) {
          const im = decodeDataUrl(a.imagem);
          if (im) {
            const targetWidth = Math.min(260, im.width);
            const h = (targetWidth * im.height) / im.width;
            if (h > altImgHeightPx) altImgHeightPx = h;
          }
        }
      }
    }
    altImgHeightPx = Math.min(altImgHeightPx, 180); // cap

    // Header info
    if (config.instituicao) children.push(paragraphFromText(config.instituicao, { size, bold: true, align: AlignmentType.CENTER }));
    if (config.titulo) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: config.titulo, size: (size + 4) * 2, bold: true, font: "Arial" })],
      }));
    }
    const infoLines: string[] = [];
    if (config.disciplina) infoLines.push(`Disciplina: ${config.disciplina}`);
    if (config.professor) infoLines.push(`Professor(a): ${config.professor}`);
    if (config.turma) infoLines.push(`Turma: ${config.turma}`);
    if (config.data) infoLines.push(`Data: ${config.data}`);
    if (infoLines.length) {
      children.push(paragraphFromText(infoLines.join("    "), { size, align: AlignmentType.LEFT, spacingAfter: 200 }));
    }
    children.push(paragraphFromText("Nome: ______________________________________________   Nº: _______", { size, align: AlignmentType.LEFT, spacingAfter: 200 }));

    if (config.instrucoes) {
      children.push(paragraphFromText("Instruções:", { size, bold: true, align: AlignmentType.LEFT, spacingAfter: 80 }));
      children.push(paragraphFromText(config.instrucoes, { size, spacingAfter: 240 }));
    }

    let previousReferenceKey: string | null = null;

    // Questions
    questions.forEach((q, idx) => {
      const n = idx + 1;
      const hasReference = Boolean(q.referencia_texto || q.referencia_texto_apos || q.referencia_imagem);
      const referenceKey = q.grupo_id || [q.referencia_texto, q.referencia_texto_apos, q.referencia_imagem, JSON.stringify(q.referencia_imagem_layout ?? null)].filter(Boolean).join("|");
      const shouldRenderReference = hasReference && referenceKey !== previousReferenceKey;
      if (shouldRenderReference) {
        const freeReferenceImage = q.referencia_imagem && q.referencia_imagem_layout
          ? imageParagraph(q.referencia_imagem, CONTENT_WIDTH_PX, AlignmentType.CENTER, undefined, q.referencia_imagem_layout)
          : null;
        const referenceImage = q.referencia_imagem && !q.referencia_imagem_layout
          ? imageParagraph(q.referencia_imagem, CONTENT_WIDTH_PX, AlignmentType.CENTER)
          : null;
        const imagePos = q.referencia_imagem_pos ?? "depois";
        if (freeReferenceImage) children.push(freeReferenceImage);
        if (referenceImage && imagePos === "antes") children.push(referenceImage);
        if (q.referencia_texto) {
          children.push(paragraphFromText(q.referencia_texto, { size, align: AlignmentType.JUSTIFIED, spacingAfter: 100 }));
        }
        if (referenceImage && imagePos === "entre") children.push(referenceImage);
        if (q.referencia_texto_apos) {
          children.push(paragraphFromText(q.referencia_texto_apos, { size, align: AlignmentType.JUSTIFIED, spacingAfter: 100 }));
        }
        if (referenceImage && imagePos !== "antes" && imagePos !== "entre") children.push(referenceImage);
        if (q.referencia_fonte) {
          children.push(paragraphFromText(q.referencia_fonte, { size: size - 2, align: AlignmentType.RIGHT, spacingAfter: 180 }));
        }
      }
      previousReferenceKey = hasReference ? referenceKey : null;
      children.push(new Paragraph({
        spacing: { before: config.espacamentoQuestoes, after: 100 },
        keepNext: true,
        children: [
          new TextRun({ text: `Questão ${n}.`, size: size * 2, bold: true, font: "Arial" }),
          ...(q.fonte ? [new TextRun({ text: `  (${q.fonte})`, size: (size - 1) * 2, italics: true, font: "Arial" })] : []),
        ],
      }));
      const freeEnunciadoImg = q.enunciado_imagem && q.enunciado_imagem_layout
        ? imageParagraph(q.enunciado_imagem, CONTENT_WIDTH_PX, AlignmentType.CENTER, undefined, q.enunciado_imagem_layout)
        : null;
      const enunciadoImg = q.enunciado_imagem && !q.enunciado_imagem_layout
        ? imageParagraph(q.enunciado_imagem, CONTENT_WIDTH_PX, AlignmentType.CENTER)
        : null;
      if (freeEnunciadoImg) children.push(freeEnunciadoImg);
      if (enunciadoImg && q.enunciado_imagem_pos === "antes") children.push(enunciadoImg);
      children.push(paragraphFromText(q.enunciado, { size, spacingAfter: 120 }));
      if (enunciadoImg && q.enunciado_imagem_pos !== "antes") children.push(enunciadoImg);
      q.alternativas.forEach((a) => {
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: a.imagem ? 40 : 60, line: 280 },
          indent: { left: 360, hanging: 360 },
          children: [
            new TextRun({ text: `${a.letra}) `, size: size * 2, bold: true, font: "Arial" }),
            ...runsFromText(a.texto, { size }),
          ],
        }));
        if (a.imagem && altImgHeightPx > 0) {
          const im = imageParagraph(a.imagem, CONTENT_WIDTH_PX - 60, AlignmentType.LEFT, altImgHeightPx);
          if (im) children.push(im);
        }
      });
    });

    // Gabarito at end of same doc
    if (config.incluirGabarito && !config.gabaritoSeparado) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(paragraphFromText("Gabarito", { size: size + 2, bold: true, align: AlignmentType.CENTER, spacingAfter: 200 }));
      questions.forEach((q, idx) => {
        children.push(paragraphFromText(`${idx + 1}. ${q.resposta || "—"}`, { size, align: AlignmentType.LEFT, spacingAfter: 60 }));
      });
    }

    const doc = new Document({
      creator: "Digitalizador de Questões",
      styles: {
        default: { document: { run: { font: "Arial", size: size * 2 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        headers: config.titulo ? {
          default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: config.titulo, size: (size - 2) * 2, font: "Arial", color: "888888" })] })] }),
        } : undefined,
        footers: {
          default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], size: (size - 2) * 2, font: "Arial", color: "888888" })] })] }),
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const base64 = Buffer.from(buffer).toString("base64");

    let gabaritoBase64: string | null = null;
    if (config.incluirGabarito && config.gabaritoSeparado) {
      const gabDoc = new Document({
        styles: { default: { document: { run: { font: "Arial", size: size * 2 } } } },
        sections: [{
          properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
          children: [
            paragraphFromText(config.titulo ? `${config.titulo} — Gabarito` : "Gabarito", { size: size + 2, bold: true, align: AlignmentType.CENTER, spacingAfter: 240 }),
            ...questions.map((q, idx) => paragraphFromText(`${idx + 1}. ${q.resposta || "—"}`, { size, align: AlignmentType.LEFT, spacingAfter: 60 })),
          ],
        }],
      });
      const gbuf = await Packer.toBuffer(gabDoc);
      gabaritoBase64 = Buffer.from(gbuf).toString("base64");
    }

    return { docxBase64: base64, gabaritoBase64 };
  });
