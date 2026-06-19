## Objetivo

Criar a aba **Catálogos** para gerenciar listas controladas (Áreas, Conteúdos, Subconteúdos, Relacionados, Tags, Provas, Instituições) e transformar os campos correspondentes em "Metadados opcionais" do cadastro de questões em seleções dependentes — eliminando digitação livre nesses campos.

## 1. Banco de dados (migração)

Criar 7 tabelas no schema `public`, todas com `id`, `nome`, `ativo` (bool), `created_at`, `updated_at` + GRANTs + RLS pública (mesmo padrão da tabela `questions`):

- `catalog_areas` — { nome }
- `catalog_conteudos` — { nome, area_id → catalog_areas }
- `catalog_subconteudos` — { nome, conteudo_id → catalog_conteudos }
- `catalog_relacionados` — { nome }
- `catalog_tags` — { nome }
- `catalog_provas` — { nome }
- `catalog_instituicoes` — { nome }

Adicionar à tabela `questions`:
- `area_id uuid` (FK catalog_areas)
- `conteudo_id uuid` (FK catalog_conteudos)
- `subconteudo_id uuid` (FK catalog_subconteudos)
- `relacionados_ids uuid[]`
- `tags_ids uuid[]`
- `prova_id uuid` (FK catalog_provas)
- `instituicao_id uuid` (FK catalog_instituicoes)

Manter as colunas-texto antigas (`disciplina`, `conteudo`, `tags`, `prova`, `instituicao`) para compatibilidade com dados existentes, mas a UI passa a usar os IDs.

Função `count_questions_by_catalog(tipo, id)` para a UI mostrar uso e bloquear exclusão.

`ON DELETE RESTRICT` nas FKs garante que itens vinculados não possam ser excluídos.

## 2. Nova rota `/catalogos`

`src/routes/catalogos.tsx` com 7 abas (Tabs do shadcn), uma por catálogo. Cada aba mostra:

- Botão **Adicionar**
- Lista com: nome, switch Ativo/Inativo, contador de uso, botões Editar / Mesclar / Excluir
- Diálogo de **edição** (renomear)
- Diálogo de **mesclagem**: escolhe um destino; atualiza todas as questões vinculadas e remove o duplicado
- Exclusão bloqueada quando `count > 0` (toast explicativo)
- Para Conteúdos: seletor de Área pai. Para Subconteúdos: seletor de Conteúdo pai (que já mostra a área).

Adicionar link "Catálogos" no `AppLayout` (nav principal).

## 3. Cadastro de questões — seção "Metadados opcionais"

Em `src/routes/revisar.tsx` (e onde mais aparecer o form), substituir os inputs de texto por **Selects** controlados:

1. **Área geral** (obrigatório) — Select alimentado por `catalog_areas` ativos
2. **Conteúdo principal** (obrigatório) — Select filtrado por `area_id` selecionado; desabilitado até escolher Área
3. **Subconteúdo principal** (obrigatório) — Select filtrado por `conteudo_id`; desabilitado até escolher Conteúdo
4. **Conteúdos relacionados** — multi-select (combobox com checkboxes)
5. **Tags** — multi-select
6. **Prova** — Select simples
7. **Instituição** — Select simples
8. **Ano** — input texto (único digitável)
9. **Observações** — textarea (livre, mantido)

Comportamentos:

- Quando uma lista estiver vazia: mostrar mensagem inline "Nenhum item cadastrado. Acesse **Catálogos** para criar." com link para `/catalogos`.
- Mudar Área limpa Conteúdo e Subconteúdo. Mudar Conteúdo limpa Subconteúdo.
- Validação no submit: Área + Conteúdo + Subconteúdo obrigatórios → toast "Classificação pedagógica incompleta" e bloqueia salvar.

## 4. Persistência

- `draft-store.ts`: adicionar os novos campos de ID ao `DraftQuestion`.
- `documento.tsx` (insert no Supabase): gravar os novos campos `*_id` e arrays.
- `questoes.tsx`: ao listar/filtrar, fazer join com os catálogos (`select('*, area:catalog_areas(nome), ...')`) para exibir nomes em vez de IDs.

## 5. Componente reutilizável

`src/components/CatalogSelect.tsx` — wrapper sobre shadcn Select que recebe `items`, `value`, `onChange`, `emptyHref="/catalogos"` e renderiza o estado vazio padronizado.

`src/components/CatalogMultiSelect.tsx` — combobox multi-select para Relacionados/Tags.

## Detalhes técnicos

- Carregar catálogos via TanStack Query (`useSuspenseQuery` + `queryOptions`) usando o cliente browser do Supabase (lista é pública por enquanto, mesmo padrão de `questions`).
- Itens **inativos** não aparecem nos selects do formulário, mas continuam visíveis na aba Catálogos.
- Mesclagem: server function `mergeCatalogItem({ tipo, sourceId, targetId })` com `requireSupabaseAuth` que faz UPDATE nas questions e DELETE do source numa transação (via RPC).
- Contador de uso: RPC `count_catalog_usage(tipo, id)` retornando bigint.

## Arquivos a criar/alterar

**Novos:**
- `supabase/migrations/<timestamp>_catalogos.sql`
- `src/routes/catalogos.tsx`
- `src/components/CatalogSelect.tsx`
- `src/components/CatalogMultiSelect.tsx`
- `src/lib/catalogos.functions.ts` (mesclagem + contagem)
- `src/lib/catalogos-queries.ts` (queryOptions reaproveitáveis)

**Alterados:**
- `src/components/AppLayout.tsx` (nav)
- `src/routes/revisar.tsx` (form metadados)
- `src/routes/documento.tsx` (salvar IDs)
- `src/routes/questoes.tsx` (exibir nomes dos catálogos)
- `src/lib/draft-store.ts` (novos campos)

## Fora do escopo

- Migração automática dos textos legados (`disciplina`, `conteudo`, etc.) para os novos IDs. As questões antigas continuam funcionando com os campos-texto; novas questões usam os catálogos. Posso fazer isso num passo seguinte se quiser.
