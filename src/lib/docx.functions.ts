import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
} from "docx";

const Alt = z.object({ letra: z.string(), texto: z.string() });
const QInput = z.object({
  id: z.string(),
  numero: z.string().nullable().optional(),
  enunciado: z.string(),
  alternativas: z.array(Alt),
  resposta: z.string().nullable().optional(),
  fonte: z.string().nullable().optional(),
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

const TRANSPARENT_PNG_FALLBACK = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const DEFAULT_TEXT_COLOR = "000000";

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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeLatexForSvg(latex: string): string {
  return latex
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\alpha/g, "α").replace(/\\beta/g, "β").replace(/\\gamma/g, "γ")
    .replace(/\\delta/g, "δ").replace(/\\Delta/g, "Δ").replace(/\\theta/g, "θ")
    .replace(/\\lambda/g, "λ").replace(/\\mu/g, "μ").replace(/\\pi/g, "π")
    .replace(/\\sigma/g, "σ").replace(/\\Omega/g, "Ω").replace(/\\omega/g, "ω")
    .replace(/\\times/g, "×").replace(/\\cdot/g, "·").replace(/\\pm/g, "±")
    .replace(/\\leq/g, "≤").replace(/\\geq/g, "≥").replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈").replace(/\\infty/g, "∞").replace(/\\rightarrow/g, "→")
    .replace(/\\\\/g, "\n")
    .replace(/\\,/g, " ").replace(/\\ /g, " ");
}

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

function latexSvgContent(latex: string, fontSize: number, color: string) {
  const input = normalizeLatexForSvg(latex);
  const segments: { text: string; script?: "super" | "sub" }[] = [];

  for (let i = 0; i < input.length;) {
    const char = input[i];
    if ((char === "^" || char === "_") && i + 1 < input.length) {
      const script = readLatexScript(input, i + 1);
      segments.push({ text: normalizeLatexForSvg(script.value), script: char === "^" ? "super" : "sub" });
      i = script.end;
      continue;
    }

    let text = "";
    while (i < input.length && input[i] !== "^" && input[i] !== "_") {
      text += input[i];
      i++;
    }
    if (text) segments.push({ text });
  }

  const width = Math.min(
    620,
    Math.max(48, Math.ceil(segments.reduce((sum, segment) => {
      const factor = segment.script ? 0.42 : 0.58;
      return sum + segment.text.length * fontSize * factor;
    }, 0) + 24)),
  );
  const height = Math.max(30, fontSize + 18);
  const y = Math.round(height * 0.68);
  const tspans = segments.map((segment) => {
    if (!segment.script) return `<tspan>${escapeXml(segment.text)}</tspan>`;
    const shift = segment.script === "super" ? "super" : "sub";
    return `<tspan baseline-shift="${shift}" font-size="70%">${escapeXml(segment.text)}</tspan>`;
  }).join("");

  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="8" y="${y}" font-family="Cambria Math, Cambria, Georgia, serif" font-size="${fontSize}" fill="#${color}">${tspans}</text></svg>`,
  };
}

function latexImageRun(latex: string, size: number, color = DEFAULT_TEXT_COLOR): ImageRun {
  const fontSize = Math.max(14, Math.round(size * 1.45));
  const { width, height, svg } = latexSvgContent(latex.trim(), fontSize, color);

  return new ImageRun({
    type: "svg",
    data: Buffer.from(svg),
    transformation: { width, height },
    fallback: {
      type: "png",
      data: TRANSPARENT_PNG_FALLBACK,
    },
  } as never);
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
      return [latexImageRun(latex, opts.size, opts.color)];
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

export const generateDocx = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { questions, config } = data;
    const size = config.fontSize;

    const children: Paragraph[] = [];

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

    // Questions
    questions.forEach((q, idx) => {
      const n = idx + 1;
      children.push(new Paragraph({
        spacing: { before: config.espacamentoQuestoes, after: 100 },
        keepNext: true,
        children: [
          new TextRun({ text: `Questão ${n}.`, size: size * 2, bold: true, font: "Arial" }),
          ...(q.fonte ? [new TextRun({ text: `  (${q.fonte})`, size: (size - 1) * 2, italics: true, font: "Arial" })] : []),
        ],
      }));
      children.push(paragraphFromText(q.enunciado, { size, spacingAfter: 120 }));
      q.alternativas.forEach((a) => {
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 60, line: 280 },
          indent: { left: 360, hanging: 360 },
          children: [
            new TextRun({ text: `${a.letra}) `, size: size * 2, bold: true, font: "Arial" }),
            ...runsFromText(a.texto, { size }),
          ],
        }));
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
