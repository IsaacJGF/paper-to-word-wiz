import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
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
} from "docx";

const Alt = z.object({ letra: z.string(), texto: z.string() });
const QInput = z.object({
  id: z.string(),
  numero: z.string().nullable().optional(),
  enunciado: z.string(),
  alternativas: z.array(Alt),
  resposta: z.string().nullable().optional(),
  fonte: z.string().nullable().optional(),
  referencia_texto: z.string().nullable().optional(),
  referencia_fonte: z.string().nullable().optional(),
  grupo_id: z.string().nullable().optional(),
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

    const renderedReferences = new Set<string>();

    // Questions
    questions.forEach((q, idx) => {
      const n = idx + 1;
      const referenceKey = q.grupo_id || q.referencia_texto || "";
      if (q.referencia_texto && !renderedReferences.has(referenceKey)) {
        renderedReferences.add(referenceKey);
        children.push(paragraphFromText(q.referencia_texto, { size, align: AlignmentType.JUSTIFIED, spacingAfter: 100 }));
        if (q.referencia_fonte) {
          children.push(paragraphFromText(q.referencia_fonte, { size: size - 2, align: AlignmentType.RIGHT, spacingAfter: 180 }));
        }
      }
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
