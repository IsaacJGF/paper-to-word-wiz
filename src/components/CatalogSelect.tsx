import { Link } from "@tanstack/react-router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { id: string; nome: string; ativo: boolean };

export function CatalogSelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  disabled,
  emptyHint = "Nenhum item cadastrado.",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  emptyHint?: string;
}) {
  const active = options.filter((o) => o.ativo);
  // Garante que o valor atual continue visível mesmo se inativado
  if (value && !active.some((o) => o.nome === value)) {
    const current = options.find((o) => o.nome === value);
    if (current) active.unshift(current);
  }

  if (active.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {emptyHint}{" "}
        <Link to="/catalogos" className="font-medium text-primary underline">
          Acesse Catálogos
        </Link>{" "}
        para cadastrar.
      </div>
    );
  }

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {active.map((o) => (
          <SelectItem key={o.id} value={o.nome}>
            {o.nome}
            {!o.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CatalogMultiSelect({
  values,
  onChange,
  options,
  emptyHint = "Nenhum item cadastrado.",
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: Option[];
  emptyHint?: string;
}) {
  const active = options.filter((o) => o.ativo);

  if (active.length === 0 && values.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {emptyHint}{" "}
        <Link to="/catalogos" className="font-medium text-primary underline">
          Acesse Catálogos
        </Link>{" "}
        para cadastrar.
      </div>
    );
  }

  const toggle = (nome: string) => {
    onChange(values.includes(nome) ? values.filter((v) => v !== nome) : [...values, nome]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {active.map((o) => {
        const on = values.includes(o.nome);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.nome)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
            }`}
          >
            {o.nome}
          </button>
        );
      })}
    </div>
  );
}
