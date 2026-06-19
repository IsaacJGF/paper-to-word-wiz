import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  placeholder = "Buscar e selecionar",
  emptyHint = "Nenhum item cadastrado.",
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: Option[];
  placeholder?: string;
  emptyHint?: string;
}) {
  const active = options.filter((o) => o.ativo || values.includes(o.nome));
  const selected = values.filter(Boolean);
  const selectedPreview = selected.slice(0, 2);
  const remaining = selected.length - selectedPreview.length;

  if (active.length === 0 && selected.length === 0) {
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
    onChange(selected.includes(nome) ? selected.filter((v) => v !== nome) : [...selected, nome]);
  };

  const clear = () => onChange([]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {selected.length === 0 ? (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                <Badge variant="secondary" className="shrink-0">{selected.length} selecionado{selected.length > 1 ? "s" : ""}</Badge>
                <div className="hidden min-w-0 gap-1 sm:flex">
                  {selectedPreview.map((item) => (
                    <Badge key={item} variant="outline" className="max-w-36 truncate font-normal">
                      {item}
                    </Badge>
                  ))}
                  {remaining > 0 && <Badge variant="outline" className="font-normal">+{remaining}</Badge>}
                </div>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={-1}
                title="Limpar seleção"
                className="rounded-sm p-1 hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clear();
                }}
              >
                <X className="size-4" />
              </span>
            )}
            <ChevronDown className="size-4" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(520px,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Buscar opção..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            <CommandGroup>
              {active.map((o) => {
                const checked = selected.includes(o.nome);
                return (
                  <CommandItem key={o.id} value={o.nome} onSelect={() => toggle(o.nome)}>
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                    {!o.ativo && <span className="text-xs text-muted-foreground">inativo</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selected.length > 0 && (
            <div className="border-t p-2">
              <button type="button" className="w-full rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted" onClick={clear}>
                Limpar seleção
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
