# Configuração da OpenAI para Análise profunda por IA

A aba **Análise de Provas** usa a Supabase Edge Function `openai-deep-analysis` para chamar a API da OpenAI com segurança.

## Por que usar Edge Function

A chave da OpenAI não deve ficar no front-end, no navegador, nem em arquivos versionados do repositório.

Fluxo correto:

```text
Front-end
→ Supabase Edge Function openai-deep-analysis
→ OpenAI API
→ relatório estruturado para o front-end
```

## Secrets necessários

Configure estes secrets no ambiente da Supabase:

```text
OPENAI_API_KEY=sk-...
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
```

`OPENAI_ANALYSIS_MODEL` é opcional. Se não for configurado, a função usa `gpt-4o-mini` como padrão.

## Como configurar no Supabase

Pelo painel da Supabase:

1. Acesse o projeto da Supabase.
2. Vá em **Edge Functions**.
3. Abra a função `openai-deep-analysis`.
4. Configure os secrets/variáveis de ambiente.
5. Faça deploy da função.

Pela CLI da Supabase:

```bash
supabase secrets set OPENAI_API_KEY="sk-..."
supabase secrets set OPENAI_ANALYSIS_MODEL="gpt-4o-mini"
supabase functions deploy openai-deep-analysis
```

## Segurança

- Nunca coloque `OPENAI_API_KEY` em componente React.
- Nunca coloque a chave em `.env` público com prefixo `VITE_`.
- Nunca cole a chave em tela, prompt ou arquivo do repositório.
- Se uma chave foi exposta, revogue a chave no painel da OpenAI e gere uma nova.

## Funcionamento esperado

Ao clicar em **Gerar análise profunda por IA**, o front-end envia apenas os dados estruturados da análise para a Edge Function.

A função:

- lê `OPENAI_API_KEY` no ambiente seguro;
- chama a OpenAI Responses API;
- pede resposta estruturada em JSON;
- devolve o relatório para a aba **Análise de Provas**.

## Erros comuns

### `missing_api_key`

A função está sem `OPENAI_API_KEY` configurada.

### `FunctionsHttpError`

A Edge Function pode não estar publicada, pode estar com erro interno ou pode estar sem secrets.

### `openai_error`

A OpenAI recusou a chamada. Verifique:

- chave ativa;
- billing ativo na OpenAI Platform;
- modelo configurado em `OPENAI_ANALYSIS_MODEL`;
- limites de uso da conta.
