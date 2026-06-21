import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProvaAnalysisQuestion, ProvaAnalysisSummary } from "@/lib/prova-analysis";

type QualityIssueKey =
  | "area"
  | "content"
  | "subcontent"
  | "year"
  | "prova"
  | "instituicao"
  | "tags"
  | "gabarito"
  | "referenceWithoutGroup";

type QualityIssue = {
  key: QualityIssueKey;
  label: string;
  description: string;
  action: string;
  count: number;
  questionIds: string[];
};

type ProblemQuestion = {
  question: ProvaAnalysisQuestion;
  issues: QualityIssue[];
};

const ISSUE_DEFINITIONS: Array<Omit<QualityIssue, "count" | "questionIds">> = [
  { key: "area", label: "Sem área geral", description: "A questão não possui área geral cadastrada.", action: "Cadastrar área geral" },
  { key: "content", label: "Sem conteúdo principal", description: "A questão não possui conteúdo principal cadastrado.", action: "Cadastrar conteúdo principal" },
  { key: "subcontent", label: "Sem subconteúdo", description: "A questão não possui subconteúdo principal cadastrado.", action: "Cadastrar subconteúdo" },
  { key: "year", label: "Sem ano", description: "A questão não possui ano cadastrado.", action: "Cadastrar ano" },
  { key: "prova", label: "Sem prova", description: "A questão não possui prova vinculada.", action: "Cadastrar prova" },
  { key: "instituicao", label: "Sem instituição", description: "A questão não possui instituição vinculada.", action: "Cadastrar instituição" },
  { key: "tags", label: "Sem tags", description: "A questão não possui tags cadastradas.", action: "Adicionar tags" },
  { key: "gabarito", label: "Sem gabarito", description: "A questão não possui resposta/gabarito cadastrado.", action: "Cadastrar gabarito" },
  { key: "referenceWithoutGroup", label: "Referência sem grupo", description: "A questão possui referência, mas não possui grupo_id para agrupar itens da mesma referência.", action: "Revisar agrupamento" },
];

export function AnalysisDataQualityPanel({ summary }: { summary: ProvaAnalysisSummary }) {
  const quality = buildQualityReport(summary.questions);
  const hasProblems = quality.issues.some((issue) => issue.count > 0);

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${hasProblems ? "border-amber-300 bg-amber-50 text-amber-950" : "bg-card"}`}>
        <div className="mb-2 flex items-center gap-2">
          {hasProblems ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5 text-emerald-600" />}
          <h2 className="font-semibold">Qualidade dos dados</h2>
        </div>
        <p className="text-sm">
          {hasProblems
            ? "A análise encontrou questões incompletas. Isso pode deixar os resultados menos confiáveis até que os metadados sejam corrigidos."
            : "Nenhum problema importante de cadastro foi encontrado na base analisada."}
        </p>
      </div>

      {hasProblems && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quality.issues.map((issue) => (
              <QualityMetricCard key={issue.key} issue={issue} total={summary.total} />
            ))}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">Questões que precisam de correção</h3>
                <p className="text-xs text-muted-foreground">
                  Mostrando até 80 questões com problemas de cadastro. Use o botão para abrir a questão na aba Questões salvas.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {quality.problemQuestions.length} questão{quality.problemQuestions.length === 1 ? "" : "ões"} com problema
              </span>
            </div>
            <ProblemQuestionList questions={quality.problemQuestions.slice(0, 80)} />
          </div>
        </>
      )}

    </div>
  );
}

function QualityMetricCard({ issue, total }: { issue: QualityIssue; total: number }) {
  const active = issue.count > 0;
  return (
    <div className={`rounded-xl border p-4 ${active ? "bg-card" : "bg-muted/30 opacity-70"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{issue.label}</p>
      <div className="mt-2 text-3xl font-bold">{issue.count}</div>
      <p className="mt-1 text-xs text-muted-foreground">{formatPercent(issue.count, total)} da base</p>
      <p className="mt-2 text-xs text-muted-foreground">{issue.description}</p>
    </div>
  );
}

function ProblemQuestionList({ questions }: { questions: ProblemQuestion[] }) {
  return (
    <div className="space-y-2">
      {questions.map(({ question, issues }) => (
        <div key={question.id} className="rounded-lg border bg-background p-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono">#{question.id.slice(0, 6)}</span>
                {question.numero && <span>Item {question.numero}</span>}
                {question.prova && <span>{question.prova}</span>}
                {question.ano && <span>{question.ano}</span>}
              </div>
              <p className="mt-1 line-clamp-2 text-sm">{plainText(question.enunciado) || "Sem enunciado cadastrado."}</p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 gap-1">
              <a href={`/questoes?editId=${encodeURIComponent(question.id)}`}>
                Abrir questão para editar <ExternalLink className="size-3" />
              </a>
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {issues.map((issue) => (
              <span key={issue.key} title={issue.action} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                {issue.label}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildQualityReport(questions: ProvaAnalysisQuestion[]) {
  const issueMap = new Map<QualityIssueKey, QualityIssue>(
    ISSUE_DEFINITIONS.map((issue) => [issue.key, { ...issue, count: 0, questionIds: [] }]),
  );
  const problemQuestions: ProblemQuestion[] = [];

  for (const question of questions) {
    const questionIssues = getQuestionIssues(question).map((key) => issueMap.get(key)).filter((issue): issue is QualityIssue => Boolean(issue));
    if (questionIssues.length === 0) continue;

    for (const issue of questionIssues) {
      issue.count += 1;
      issue.questionIds.push(question.id);
    }
    problemQuestions.push({ question, issues: questionIssues });
  }

  return {
    issues: Array.from(issueMap.values()),
    problemQuestions: problemQuestions.sort((a, b) => b.issues.length - a.issues.length),
  };
}

function getQuestionIssues(question: ProvaAnalysisQuestion): QualityIssueKey[] {
  const issues: QualityIssueKey[] = [];
  const answer = question.resposta;

  if (!question.area_geral) issues.push("area");
  if (!question.conteudo_principal) issues.push("content");
  if (!question.subconteudo_principal) issues.push("subcontent");
  if (!question.ano) issues.push("year");
  if (!question.prova) issues.push("prova");
  if (!question.instituicao) issues.push("instituicao");
  if (!hasTags(question)) issues.push("tags");
  if (!answer?.trim()) issues.push("gabarito");
  if (hasReferenceBody(question) && !question.grupo_id) issues.push("referenceWithoutGroup");

  return issues;
}

function hasTags(question: ProvaAnalysisQuestion) {
  return Boolean(question.tags_livres?.length || question.tags?.length);
}

function hasReferenceBody(question: ProvaAnalysisQuestion) {
  return Boolean(question.referencia_texto?.trim() || question.referencia_texto_apos?.trim() || question.referencia_imagem);
}

function formatPercent(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function plainText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\$+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
