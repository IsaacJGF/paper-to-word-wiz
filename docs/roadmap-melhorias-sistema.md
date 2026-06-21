# Roadmap de melhorias do sistema

Este documento organiza as próximas melhorias do app **paper-to-word-wiz**. A ideia é evitar um PR gigante e arriscado, mantendo as mudanças em etapas testáveis.

## Objetivo geral

Melhorar estabilidade, desempenho, organização visual, armazenamento, criação de documentos e manutenção do banco de questões.

## 1. Otimizar a aba Questões salvas

### Problema

A aba Questões salvas tende a ficar pesada conforme o banco cresce, principalmente quando todas as questões são carregadas de uma vez e os filtros são aplicados no front.

### Melhorias propostas

- Adicionar paginação ou carregamento incremental.
- Evitar carregar todo o banco de uma vez.
- Aplicar busca e filtros no Supabase sempre que possível.
- Adicionar debounce no campo de busca.
- Manter contador de questões encontradas.
- Melhorar performance da renderização dos cards.
- Preservar seleção de questões ao paginar ou carregar mais itens.

### Critérios de aceite

- A página deve carregar rápido com muitas questões.
- Busca por palavra/trecho deve continuar funcionando.
- Filtro avançado deve continuar funcionando.
- Seleção para avaliação não pode ser perdida ao trocar página ou buscar.

## 2. Melhorar armazenamento de imagens

### Problema

O sistema usa imagens em base64/dataURL em alguns fluxos. Isso pode deixar o banco pesado, especialmente com muitas questões com imagens.

### Melhorias propostas

- Migrar imagens para Supabase Storage.
- Salvar no banco apenas URL, metadados e layout da imagem.
- Manter compatibilidade com imagens antigas em base64.
- Criar função auxiliar para upload, leitura e fallback de imagens.
- Otimizar imagens antes do upload quando possível.

### Critérios de aceite

- Imagens novas devem ser salvas no Storage.
- Questões antigas com base64 devem continuar abrindo.
- Exportação para Word deve funcionar com URL e base64.
- Recorte, redimensionamento e alinhamento devem continuar funcionando.

## 3. Criar auditoria/revisão do banco de questões

### Objetivo

Criar uma tela ou painel para revisar problemas no banco antes de montar avaliações.

### Verificações sugeridas

- Questões sem Área geral.
- Questões sem Conteúdo principal.
- Questões sem Subconteúdo principal.
- Questões sem Prova.
- Questões sem Ano.
- Questões sem Instituição.
- Questões sem gabarito.
- Questões com imagem ausente ou quebrada.
- Questões com LaTeX bruto não renderizado.
- Itens com referência, mas sem grupo.
- Grupos de referência incompletos.

### Ações úteis

- Abrir questão para editar.
- Filtrar por tipo de problema.
- Exibir quantidade de problemas.
- Marcar como revisado.

## 4. Melhorar Criar documento com arrastar e soltar

### Problema

A organização das questões por setas funciona, mas fica cansativa em avaliações longas.

### Melhorias propostas

- Adicionar drag-and-drop para reordenar questões.
- Permitir mover bloco inteiro de mesma referência.
- Permitir reordenar itens dentro do bloco.
- Manter indicação visual por cor/chave lateral para itens da mesma referência.
- Avisar quando itens da mesma referência forem separados.

### Critérios de aceite

- Reordenar deve ser intuitivo.
- Blocos de mesma referência devem ser preservados visualmente.
- Ao exportar, referência deve aparecer uma vez quando itens estiverem juntos.
- Ao separar itens, referência deve ser repetida no Word quando aparecer novamente.

## 5. Refinar Modelo PAS/CEBRASPE

### Melhorias propostas

- Ajustar linha vertical entre colunas.
- Ajustar espaçamento entre referência, itens e alternativas.
- Ajustar linha horizontal apenas entre blocos de referência.
- Melhorar recuo suspenso dos itens.
- Melhorar renderização de tabelas no padrão PAS.
- Melhorar alternativas com círculo preto e letra branca quando tecnicamente possível.
- Criar prévia visual simples do modelo antes de gerar Word.

### Critérios de aceite

- O documento deve ficar compacto e formal.
- Não deve separar referência do primeiro item com linha horizontal.
- A linha horizontal deve separar uma referência da próxima.
- Itens consecutivos da mesma referência devem compartilhar o texto-base.

## 6. Criar modelos de documento adicionais

### Modelos sugeridos

- Modelo padrão.
- Modelo PAS/CEBRASPE.
- Modelo ENEM.
- Modelo prova escolar.
- Modelo lista de exercícios.
- Modelo simulado compacto.

### Melhorias técnicas

- Organizar geradores em uma pasta própria de modelos.
- Usar uma interface comum para todos os modelos.
- Facilitar adição de novos modelos sem mexer no fluxo principal.

## 7. Melhorar vínculo dos Catálogos com as questões

### Problema

Atualmente, parte dos metadados é salva como texto. Isso pode dificultar renomear itens do catálogo no futuro.

### Melhorias propostas

- Salvar também IDs dos catálogos nas questões.
- Manter nome textual como fallback/compatibilidade.
- Adicionar migração gradual.
- Ao renomear item no Catálogo, preservar vínculo das questões.

### Campos sugeridos

- area_geral_id
- conteudo_principal_id
- subconteudo_principal_id
- prova_id
- instituicao_id

### Critérios de aceite

- Questões antigas devem continuar funcionando.
- Questões novas devem salvar ID e nome.
- Filtros devem funcionar por ID quando disponível.

## 8. Criar editor único real de texto + imagem

### Problema

A revisão já permite texto e imagem, mas ainda existe separação interna entre texto antes, imagem e texto depois.

### Melhorias propostas

Criar um editor de blocos:

- Bloco de texto.
- Bloco de imagem.
- Bloco de tabela.
- Bloco de equação.
- Bloco de referência.
- Bloco de alternativas.

### Funções esperadas

- Inserir imagem no ponto do cursor.
- Reordenar blocos.
- Mover imagem entre textos.
- Editar texto e imagem no mesmo fluxo visual.
- Preservar a ordem na visualização, salvamento e exportação Word.

### Critérios de aceite

- Usuário deve conseguir montar visualmente a questão na mesma ordem em que aparecerá no Word.
- O salvamento deve preservar a estrutura.
- Questões antigas devem continuar compatíveis.

## Ordem recomendada dos PRs

1. Otimizar Questões salvas com paginação e filtros no Supabase.
2. Melhorar armazenamento de imagens com Supabase Storage.
3. Criar auditoria/revisão do banco de questões.
4. Melhorar Criar documento com drag-and-drop.
5. Refinar Modelo PAS/CEBRASPE.
6. Criar modelos de documento adicionais.
7. Migrar metadados para vínculo por ID do Catálogo.
8. Criar editor único real de texto + imagem.

## Observação técnica

Essas melhorias não devem ser implementadas todas juntas em um único PR de código, pois mexem em áreas sensíveis: banco de dados, storage, filtros, editor, exportação Word e interface. A recomendação é manter este documento como PR-mãe/roadmap e abrir PRs menores para cada etapa.
