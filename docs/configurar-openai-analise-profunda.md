# Configuração da Análise profunda por IA

A aba **Análise de Provas** agora usa a **mesma IA da digitalização de questões**.

Isso significa que a análise profunda não depende mais de OpenAI API, Supabase Edge Function ou secrets da OpenAI.

## Fluxo atual

```text
Front-end
→ Server Function generateDeepAnalysis
→ Lovable AI Gateway
→ modelo google/gemini-2.5-flash por padrão
→ relatório estruturado para o front-end
```

## Variáveis necessárias

A análise profunda usa a mesma chave já usada pela digitalização:

```text
LOVABLE_API_KEY
```

Opcionalmente, é possível definir outro modelo para análise:

```text
LOVABLE_ANALYSIS_MODEL=google/gemini-2.5-flash
```

Se `LOVABLE_ANALYSIS_MODEL` não existir, o sistema usa `google/gemini-2.5-flash`.

## O que não é mais necessário

Não é mais necessário configurar no Supabase:

```text
OPENAI_API_KEY
OPENAI_ANALYSIS_MODEL
openai-deep-analysis
```

A função `openai-deep-analysis` deixou de ser usada pela aba **Análise de Provas**.

## Funcionamento esperado

Ao clicar em **Gerar análise profunda por IA**, o sistema envia para a IA:

- filtros aplicados;
- estatísticas calculadas localmente;
- análise de termos e comandos;
- análise de referências/textos-base;
- cruzamentos;
- qualidade dos dados;
- amostra das questões analisadas.

A IA devolve um relatório estruturado com:

- visão geral;
- padrões de conteúdo;
- padrões de linguagem;
- padrões de construção dos itens;
- uso de texto-base;
- padrões sutis;
- recomendações para simulado;
- limitações;
- evidências usadas.

## Segurança

- `LOVABLE_API_KEY` deve ficar apenas no ambiente do servidor.
- Não coloque essa chave em componente React.
- Não coloque a chave em variável pública com prefixo `VITE_`.
- Não cole a chave em código versionado.

## Erros comuns

### `missing_api_key`

A variável `LOVABLE_API_KEY` não está configurada.

### `invalid_api_key`

A chave da IA está inválida ou sem permissão.

### `rate_limit`

O limite de uso da IA foi atingido. Aguarde e tente novamente.

### `credits`

Os créditos de IA do workspace foram esgotados.

### `truncated_response`

A resposta ficou grande demais. Use filtros mais específicos ou reduza a quantidade de questões.
