export type RichAlign = "left" | "center" | "right" | "justify";

export type RichInline =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean; underline?: boolean; superscript?: boolean; subscript?: boolean }
  | { type: "math"; latex: string; display: boolean }
  | { type: "break" };

export type RichBlock =
  | { type: "paragraph"; align: RichAlign; inlines: RichInline[] }
  | { type: "list"; align: RichAlign; ordered: boolean; items: RichInline[][] }
  | { type: "table"; align: RichAlign; rows: RichInline[][][] };

type InlineStyle = Omit<Extract<RichInline, { type: "text" }>, "type" | "text">;

type StyleToken = {
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
  style: InlineStyle;
};

export function parseRichText(text: string | null | undefined): RichBlock[] {
  const normalized = normalizeInput(text ?? "");
  if (!normalized.trim()) return [];

  const rawBlocks = splitBlocks(normalized);
  return rawBlocks.flatMap<RichBlock>((rawBlock) => {
    const { align, text: blockText } = extractAlignment(rawBlock);
    const lines = blockText.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) return [];

    if (isTable(lines)) {
      return [{ type: "table", align, rows: parseTable(lines) } satisfies RichBlock];
    }

    const list = parseList(lines);
    if (list) return [{ type: "list", align, ...list } satisfies RichBlock];

    return [{ type: "paragraph", align, inlines: parseRichInlines(blockText) } satisfies RichBlock];
  });
}

export function parseRichInlines(text: string | null | undefined): RichInline[] {
  const value = normalizeInput(text ?? "");
  if (!value) return [];

  const segments = splitMathSegments(value);
  return segments.flatMap((segment) => {
    if (segment.type === "math") return [{ type: "math", latex: segment.value, display: segment.display } satisfies RichInline];
    return parseStyledText(segment.value, {});
  });
}

function normalizeInput(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function splitBlocks(text: string) {
  return text
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter(Boolean);
}

function extractAlignment(block: string): { align: RichAlign; text: string } {
  const trimmed = block.trim();
  const wrapped = trimmed.match(/^\[(left|center|right|justify)\]\s*([\s\S]*?)\s*\[\/\1\]$/i)
    ?? trimmed.match(/^<(left|center|right|justify)>\s*([\s\S]*?)\s*<\/\1>$/i);
  if (wrapped) return { align: normalizeAlign(wrapped[1]), text: wrapped[2].trim() };

  const lines = trimmed.split("\n");
  const first = lines[0]?.trim().match(/^\[(left|center|right|justify)\]$/i);
  const last = lines[lines.length - 1]?.trim().match(/^\[\/(left|center|right|justify)\]$/i);
  if (first && last && first[1].toLowerCase() === last[1].toLowerCase()) {
    return { align: normalizeAlign(first[1]), text: lines.slice(1, -1).join("\n").trim() };
  }

  const prefixed = trimmed.match(/^::(left|center|right|justify)::\s*([\s\S]*)$/i);
  if (prefixed) return { align: normalizeAlign(prefixed[1]), text: prefixed[2].trim() };

  return { align: "justify", text: trimmed };
}

function normalizeAlign(value: string): RichAlign {
  const lower = value.toLowerCase();
  if (lower === "left" || lower === "center" || lower === "right" || lower === "justify") return lower;
  return "justify";
}

function isTable(lines: string[]) {
  const tableLines = lines.filter((line) => line.includes("|"));
  if (tableLines.length < 2) return false;
  return tableLines.length === lines.length && tableLines.some((line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line));
}

function parseTable(lines: string[]): RichInline[][][] {
  return lines
    .filter((line) => !/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line))
    .map((line) => splitTableCells(line).map((cell) => parseRichInlines(cell.trim())));
}

function splitTableCells(line: string) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|");
}

function parseList(lines: string[]): { ordered: boolean; items: RichInline[][] } | null {
  const ordered = lines.every((line) => /^\s*\d+[.)]\s+/.test(line));
  const unordered = lines.every((line) => /^\s*[-*•]\s+/.test(line));
  if (!ordered && !unordered) return null;
  return {
    ordered,
    items: lines.map((line) => parseRichInlines(line.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, ""))),
  };
}

function splitMathSegments(text: string): Array<{ type: "text"; value: string } | { type: "math"; value: string; display: boolean }> {
  const segments: Array<{ type: "text"; value: string } | { type: "math"; value: string; display: boolean }> = [];
  let i = 0;
  let plain = "";
  const flush = () => {
    if (plain) {
      segments.push({ type: "text", value: plain });
      plain = "";
    }
  };

  while (i < text.length) {
    if (text.startsWith("$$", i)) {
      const end = text.indexOf("$$", i + 2);
      if (end !== -1) {
        flush();
        segments.push({ type: "math", value: text.slice(i + 2, end), display: true });
        i = end + 2;
        continue;
      }
    }
    if (text.startsWith("\\[", i)) {
      const end = text.indexOf("\\]", i + 2);
      if (end !== -1) {
        flush();
        segments.push({ type: "math", value: text.slice(i + 2, end), display: true });
        i = end + 2;
        continue;
      }
    }
    if (text.startsWith("\\(", i)) {
      const end = text.indexOf("\\)", i + 2);
      if (end !== -1) {
        flush();
        segments.push({ type: "math", value: text.slice(i + 2, end), display: false });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "$" && text[i + 1] !== "$") {
      const end = text.indexOf("$", i + 1);
      if (end !== -1) {
        flush();
        segments.push({ type: "math", value: text.slice(i + 1, end), display: false });
        i = end + 1;
        continue;
      }
    }
    plain += text[i];
    i++;
  }

  flush();
  return segments;
}

function parseStyledText(text: string, style: InlineStyle): RichInline[] {
  if (!text) return [];
  const token = findFirstStyleToken(text);
  if (!token) return splitBreaks(text, style);

  return [
    ...parseStyledText(text.slice(0, token.start), style),
    ...parseStyledText(text.slice(token.innerStart, token.innerEnd), { ...style, ...token.style }),
    ...parseStyledText(text.slice(token.end), style),
  ];
}

function splitBreaks(text: string, style: InlineStyle): RichInline[] {
  return text.split("\n").flatMap((part, index) => {
    const nodes: RichInline[] = [];
    if (index > 0) nodes.push({ type: "break" });
    if (part) nodes.push({ type: "text", text: decodeEntities(part), ...style });
    return nodes;
  });
}

function findFirstStyleToken(text: string): StyleToken | null {
  const tokens = [
    tagToken(text, "strong", { bold: true }),
    tagToken(text, "b", { bold: true }),
    tagToken(text, "em", { italic: true }),
    tagToken(text, "i", { italic: true }),
    tagToken(text, "u", { underline: true }),
    tagToken(text, "sup", { superscript: true }),
    tagToken(text, "sub", { subscript: true }),
    wrappedToken(text, "**", "**", { bold: true }),
    wrappedToken(text, "__", "__", { underline: true }),
    wrappedToken(text, "*", "*", { italic: true }),
    wrappedToken(text, "_", "_", { italic: true }),
    bracedToken(text, "^{", "}", { superscript: true }),
    bracedToken(text, "_{", "}", { subscript: true }),
  ].filter(Boolean) as StyleToken[];

  tokens.sort((a, b) => a.start - b.start || a.end - b.end);
  return tokens[0] ?? null;
}

function tagToken(text: string, tag: string, style: InlineStyle): StyleToken | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]+?)<\\/${tag}>`, "i");
  const match = regex.exec(text);
  if (!match || match.index === undefined) return null;
  const start = match.index;
  const openLength = match[0].indexOf(">") + 1;
  const innerStart = start + openLength;
  const innerEnd = start + match[0].length - (`</${tag}>`).length;
  return { start, end: start + match[0].length, innerStart, innerEnd, style };
}

function wrappedToken(text: string, open: string, close: string, style: InlineStyle): StyleToken | null {
  const start = text.indexOf(open);
  if (start === -1) return null;
  const innerStart = start + open.length;
  const end = text.indexOf(close, innerStart);
  if (end === -1 || end === innerStart) return null;
  if ((open === "*" || open === "_") && text[start + 1] === open) return null;
  return { start, end: end + close.length, innerStart, innerEnd: end, style };
}

function bracedToken(text: string, open: string, close: string, style: InlineStyle): StyleToken | null {
  const start = text.indexOf(open);
  if (start === -1) return null;
  const innerStart = start + open.length;
  const end = text.indexOf(close, innerStart);
  if (end === -1 || end === innerStart) return null;
  return { start, end: end + close.length, innerStart, innerEnd: end, style };
}

function decodeEntities(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
