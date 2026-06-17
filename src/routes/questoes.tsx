import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Copy, FileText, Image as ImageIcon, Sigma, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/questoes")({
  head: () => ({ meta: [{ title: "Questões salvas" }] }),
  component: Page,
});

type Q = {
  id: string; numero: string | null; enunciado: string;
  alternativas: { letra: string; texto: string }[];
  tipo: string; resposta: string | null; fonte: string | null;
  disciplina: string | null; conteudo: string | null;
  referencia_texto: string | null; referencia_fonte: string | null; grupo_id: string | null;
  tem_equacao: boolean; tem_imagem: boolean;
  created_at: string;
};

const SEL_KEY = "digitalizador.selecionadas";
function loadSel(): string[] { try { return JSON.parse(localStorage.getItem(SEL_KEY) ?? "[]"); } catch { return []; } }
function saveSel(ids: string[]) { localStorage.setItem(SEL_KEY, JSON.stringify(ids)); }

function Page() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filtroDisc, setFiltroDisc] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set(loadSel()));

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Falha ao carregar"); else setItems((data ?? []) as unknown as Q[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => { saveSel([...sel]); }, [sel]);

  const disciplinas = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => { if (i.disciplina) s.add(i.disciplina); });
    return [...s].sort();
  }, [items]);

  const filtered = useMemo(() => items.filter((i) => {
    if (q && !(i.enunciado.toLowerCase().includes(q.toLowerCase()) || (i.referencia_texto ?? "").toLowerCase().includes(q.toLowerCase()))) return false;
    if (filtroDisc && i.disciplina !== filtroDisc) return false;
    return true;
  }), [items, q, filtroDisc]);

  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSel(next);
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta questão? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) toast.error("Falha ao excluir");
    else { toast.success("Questão excluída"); setItems(items.filter((x) => x.id !== id)); const ns = new Set(sel); ns.delete(id); setSel(ns); }
  };

  const onDuplicate = async (q: Q) => {
    const { error } = await supabase.from("questions").insert({
      numero: q.numero, enunciado: q.enunciado, alternativas: q.alternativas, tipo: q.tipo,
      resposta: q.resposta, fonte: q.fonte, disciplina: q.disciplina, conteudo: q.conteudo,
      referencia_texto: q.referencia_texto, referencia_fonte: q.referencia_fonte, grupo_id: q.grupo_id,
      tem_equacao: q.tem_equacao, tem_imagem: q.tem_imagem,
    });
    if (error) toast.error("Falha ao duplicar"); else { toast.success("Questão duplicada"); load(); }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Questões salvas</h1>
            <p className="text-sm text-muted-foreground">{items.length} questões na sua biblioteca</p>
          </div>
          <Button asChild className="gap-2"><Link to="/"><ScanLine className="size-4" /> Nova questão</Link></Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Pesquisar no enunciado…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {disciplinas.length > 0 && (
            <select className="rounded-md border bg-card px-3 text-sm" value={filtroDisc} onChange={(e) => setFiltroDisc(e.target.value)}>
              <option value="">Todas as disciplinas</option>
              {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <FileText className="size-10 mx-auto text-muted-foreground mb-2" />
            <p className="font-medium">Nenhuma questão {items.length > 0 ? "encontrada" : "ainda"}</p>
            <p className="text-sm text-muted-foreground">{items.length > 0 ? "Ajuste a pesquisa ou filtros." : "Comece digitalizando sua primeira questão."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((it) => {
              const isSel = sel.has(it.id);
              return (
                <div key={it.id} className={`rounded-xl border bg-card p-4 transition-colors ${isSel ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex gap-3">
                    <Checkbox checked={isSel} onCheckedChange={() => toggle(it.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-muted-foreground">#{it.id.slice(0, 6)}</span>
                        {it.numero && <Badge variant="outline">Q{it.numero}</Badge>}
                        {it.disciplina && <Badge variant="secondary">{it.disciplina}</Badge>}
                        {it.referencia_texto && <Badge variant="outline">referência</Badge>}
                        {it.fonte && <span className="text-xs text-muted-foreground">{it.fonte}</span>}
                        {it.tem_equacao && <Sigma className="size-3.5 text-muted-foreground" />}
                        {it.tem_imagem && <ImageIcon className="size-3.5 text-muted-foreground" />}
                      </div>
                      <p className="text-sm line-clamp-2">{it.enunciado}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(it.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-1">
                      <Button size="icon" variant="ghost" onClick={() => onDuplicate(it)} title="Duplicar"><Copy className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(it.id)} title="Excluir"><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {sel.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground rounded-full px-5 py-3 shadow-lg flex items-center gap-4">
            <span className="font-medium text-sm">{sel.size} questão{sel.size > 1 ? "s" : ""} selecionada{sel.size > 1 ? "s" : ""}</span>
            <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/documento" })} className="gap-2">
              <FileText className="size-4" /> Criar documento
            </Button>
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary/80" onClick={() => setSel(new Set())}>Limpar</Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
