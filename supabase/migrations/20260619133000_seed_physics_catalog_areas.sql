-- Alimenta o catalogo pedagogico a partir de Caltalo.md.
-- Inclui areas, conteudos principais, subconteudos, conteudos relacionados e tags.

WITH area_names(nome) AS (
  SELECT trim(value)
  FROM regexp_split_to_table($areas$
Fundamentos da Física
Mecânica
Fluidos
Termologia e Termodinâmica
Ondulatória
Óptica
Eletricidade
Magnetismo e Eletromagnetismo
Física Moderna
Física Nuclear e Radiações
Astronomia e Cosmologia
Física Experimental
Interdisciplinar e Aplicações Tecnológicas
$areas$, E'\n') AS value
  WHERE trim(value) <> ''
)
INSERT INTO public.catalog_areas (nome, ativo)
SELECT nome, true FROM area_names
ON CONFLICT (nome) DO UPDATE
SET ativo = EXCLUDED.ativo,
    updated_at = now();

WITH raw(line) AS (
  SELECT value
  FROM regexp_split_to_table($catalog$
Fundamentos da Física	Grandezas físicas e unidades	Grandezas escalares|Grandezas vetoriais|Sistema Internacional de Unidades|Conversão de unidades|Ordem de grandeza|Notação científica|Algarismos significativos|Análise dimensional|Medidas e incertezas|Proporcionalidade entre grandezas
Fundamentos da Física	Vetores	Vetor deslocamento|Vetor velocidade|Vetor aceleração|Soma vetorial|Subtração vetorial|Decomposição vetorial|Componentes horizontal e vertical|Vetores perpendiculares|Vetores paralelos|Resultante vetorial
Fundamentos da Física	Representações físicas	Interpretação de gráficos|Gráfico posição × tempo|Gráfico velocidade × tempo|Gráfico aceleração × tempo|Gráfico força × tempo|Gráfico força × deslocamento|Gráfico pressão × volume|Gráfico temperatura × tempo|Gráfico corrente × tensão|Tabelas de dados|Modelos físicos|Esquemas e diagramas
Mecânica	Cinemática	Movimento e repouso|Referencial|Trajetória|Posição|Deslocamento|Distância percorrida|Velocidade média|Velocidade instantânea|Aceleração média|Aceleração instantânea|Movimento uniforme|Movimento uniformemente variado|Movimento progressivo|Movimento retrógrado|Movimento acelerado|Movimento retardado|Equação horária da posição|Equação horária da velocidade|Equação de Torricelli|Encontro de móveis|Ultrapassagem|Queda livre|Lançamento vertical|Lançamento horizontal|Lançamento oblíquo|Movimento bidimensional|Composição de movimentos|Movimento circular uniforme|Movimento circular variado|Velocidade angular|Frequência e período no MCU|Aceleração centrípeta|Transmissão de movimento circular
Mecânica	Dinâmica	Conceito de força|Força resultante|Diagrama de forças|Primeira lei de Newton|Segunda lei de Newton|Terceira lei de Newton|Inércia|Massa|Peso|Normal|Tração|Força de atrito|Atrito estático|Atrito cinético|Força elástica|Lei de Hooke|Plano horizontal|Plano inclinado|Sistema de corpos|Elevadores|Polias|Blocos ligados por fios|Força centrípeta|Dinâmica do movimento circular|Pêndulo cônico|Curvas com e sem atrito|Força de resistência do ar|Velocidade terminal
Mecânica	Estática	Equilíbrio de ponto material|Equilíbrio de corpo extenso|Centro de massa|Momento de uma força|Torque|Braço de alavanca|Condições de equilíbrio|Alavancas|Roldanas em equilíbrio|Reações de apoio|Equilíbrio translacional|Equilíbrio rotacional
Mecânica	Trabalho, Energia e Potência	Trabalho de uma força constante|Trabalho de uma força variável|Trabalho pelo gráfico força × deslocamento|Trabalho da força peso|Trabalho da força elástica|Trabalho da força de atrito|Energia cinética|Energia potencial gravitacional|Energia potencial elástica|Energia mecânica|Conservação da energia mecânica|Energia dissipada|Forças conservativas|Forças dissipativas|Teorema da energia cinética|Potência média|Potência instantânea|Rendimento|Energia elétrica em kWh
Mecânica	Impulso e Quantidade de Movimento	Quantidade de movimento|Momento linear|Impulso|Teorema do impulso|Conservação da quantidade de movimento|Sistema isolado|Forças internas e externas|Colisão elástica|Colisão inelástica|Colisão parcialmente elástica|Explosões|Recuo|Centro de massa
Mecânica	Gravitação	Modelos geocêntrico e heliocêntrico|Leis de Kepler|Lei da gravitação universal|Campo gravitacional|Aceleração da gravidade|Força peso|Órbitas circulares|Velocidade orbital|Satélites|Energia orbital|Movimento de planetas|Marés|Variação da gravidade com a altitude|Peso aparente|Imponderabilidade
Fluidos	Hidrostática	Densidade|Massa específica|Pressão|Pressão atmosférica|Pressão hidrostática|Lei de Stevin|Princípio de Pascal|Prensa hidráulica|Princípio de Arquimedes|Empuxo|Peso aparente|Flutuação|Afundamento|Equilíbrio de corpos flutuantes|Vasos comunicantes|Barômetros|Manômetros
Fluidos	Hidrodinâmica	Vazão|Escoamento|Equação da continuidade|Velocidade de escoamento|Equação de Bernoulli|Pressão em fluidos em movimento|Viscosidade|Escoamento laminar|Escoamento turbulento|Sustentação|Arrasto
Termologia e Termodinâmica	Termometria	Temperatura|Equilíbrio térmico|Lei zero da Termodinâmica|Escala Celsius|Escala Fahrenheit|Escala Kelvin|Conversão de escalas|Variação de temperatura
Termologia e Termodinâmica	Dilatação térmica	Dilatação linear|Dilatação superficial|Dilatação volumétrica|Coeficiente de dilatação|Dilatação de líquidos|Dilatação anômala da água|Lâminas bimetálicas
Termologia e Termodinâmica	Calorimetria	Calor|Calor sensível|Calor latente|Capacidade térmica|Calor específico|Mudanças de estado físico|Fusão|Vaporização|Condensação|Solidificação|Sublimação|Curvas de aquecimento|Equilíbrio térmico|Trocas de calor|Sistema termicamente isolado
Termologia e Termodinâmica	Propagação de calor	Condução térmica|Convecção térmica|Radiação térmica|Irradiação|Condutores térmicos|Isolantes térmicos|Garrafa térmica|Efeito estufa|Sensação térmica
Termologia e Termodinâmica	Gases	Gás ideal|Variáveis de estado|Pressão|Volume|Temperatura absoluta|Transformação isotérmica|Transformação isobárica|Transformação isovolumétrica|Equação geral dos gases|Equação de Clapeyron|Teoria cinética dos gases
Termologia e Termodinâmica	Termodinâmica	Energia interna|Trabalho em transformações gasosas|Primeira lei da Termodinâmica|Segunda lei da Termodinâmica|Máquinas térmicas|Refrigeradores|Bombas de calor|Rendimento de máquinas térmicas|Ciclo de Carnot|Entropia|Transformações reversíveis|Transformações irreversíveis
Ondulatória	Oscilações	Movimento periódico|Período|Frequência|Amplitude|Oscilador massa-mola|Pêndulo simples|Movimento harmônico simples|Energia no MHS|Ressonância|Oscilações amortecidas|Oscilações forçadas
Ondulatória	Ondas	Pulso|Onda|Fonte de onda|Meio de propagação|Ondas mecânicas|Ondas eletromagnéticas|Ondas transversais|Ondas longitudinais|Ondas unidimensionais|Ondas bidimensionais|Ondas tridimensionais|Crista|Vale|Comprimento de onda|Frequência|Período|Amplitude|Velocidade de propagação|Equação fundamental da ondulatória|Frente de onda|Raio de onda
Ondulatória	Fenômenos ondulatórios	Reflexão|Refração|Difração|Interferência|Polarização|Ressonância|Superposição|Batimento|Ondas estacionárias|Nós|Ventres|Harmônicos
Ondulatória	Acústica	Som|Ondas sonoras|Velocidade do som|Altura|Intensidade sonora|Timbre|Nível sonoro|Decibel|Eco|Reverberação|Tubos sonoros|Cordas vibrantes|Efeito Doppler|Ultrassom|Infrassom|Ressonância sonora
Óptica	Óptica geométrica	Luz|Raio de luz|Feixe de luz|Fonte luminosa|Meio transparente|Meio translúcido|Meio opaco|Propagação retilínea da luz|Sombra|Penumbra|Câmara escura|Eclipse|Reflexão da luz|Leis da reflexão|Espelho plano|Associação de espelhos planos|Espelhos esféricos|Espelho côncavo|Espelho convexo|Formação de imagens em espelhos|Refração da luz|Índice de refração|Lei de Snell|Reflexão total|Ângulo limite|Dioptro plano|Lâmina de faces paralelas|Prisma|Dispersão da luz|Lentes esféricas|Lente convergente|Lente divergente|Formação de imagens em lentes|Equação dos pontos conjugados|Aumento linear transversal|Instrumentos ópticos|Olho humano|Miopia|Hipermetropia|Astigmatismo|Presbiopia|Lupa|Microscópio|Telescópio
Óptica	Óptica física	Natureza ondulatória da luz|Interferência luminosa|Difração da luz|Experimento da dupla fenda|Polarização da luz|Cores|Espectro visível|Filtros de cor|Mistura aditiva de cores|Mistura subtrativa de cores
Eletricidade	Eletrostática	Carga elétrica|Eletrização por atrito|Eletrização por contato|Eletrização por indução|Condutores|Isolantes|Conservação da carga elétrica|Quantização da carga elétrica|Lei de Coulomb|Força elétrica|Campo elétrico|Linhas de campo elétrico|Campo elétrico uniforme|Potencial elétrico|Diferença de potencial|Energia potencial elétrica|Trabalho da força elétrica|Superfícies equipotenciais|Blindagem eletrostática|Poder das pontas
Eletricidade	Capacitores	Capacitância|Capacitor plano|Associação de capacitores em série|Associação de capacitores em paralelo|Energia armazenada em capacitores|Dielétricos|Carga e descarga de capacitores
Eletricidade	Eletrodinâmica	Corrente elétrica|Sentido real da corrente|Sentido convencional da corrente|Corrente contínua|Corrente alternada|Intensidade de corrente elétrica|Tensão elétrica|Resistência elétrica|Resistividade|Primeira lei de Ohm|Segunda lei de Ohm|Efeito Joule|Potência elétrica|Energia elétrica|Consumo elétrico|Quilowatt-hora|Geradores elétricos|Receptores elétricos|Força eletromotriz|Força contraeletromotriz|Rendimento elétrico
Eletricidade	Circuitos elétricos	Circuito simples|Símbolos elétricos|Resistor|Associação de resistores em série|Associação de resistores em paralelo|Associação mista de resistores|Curto-circuito|Fusível|Disjuntor|Amperímetro|Voltímetro|Ohmímetro|Leis de Kirchhoff|Circuito RC|Divisor de tensão|Ponte de Wheatstone
Magnetismo e Eletromagnetismo	Magnetismo	Ímãs|Polos magnéticos|Campo magnético|Linhas de campo magnético|Campo magnético terrestre|Bússola|Materiais ferromagnéticos|Materiais paramagnéticos|Materiais diamagnéticos
Magnetismo e Eletromagnetismo	Força magnética	Força magnética em carga elétrica|Movimento de carga em campo magnético|Movimento circular de carga em campo magnético|Força magnética em fio percorrido por corrente|Força entre fios paralelos|Regra da mão direita|Seletor de velocidades|Espectrômetro de massa
Magnetismo e Eletromagnetismo	Campo magnético gerado por corrente	Campo magnético em fio retilíneo|Campo magnético em espira circular|Campo magnético em solenoide|Eletroímã|Bobinas
Magnetismo e Eletromagnetismo	Indução eletromagnética	Fluxo magnético|Variação do fluxo magnético|Lei de Faraday|Lei de Lenz|Corrente induzida|Força eletromotriz induzida|Geradores|Transformadores|Motores elétricos|Correntes de Foucault|Indutância
Física Moderna	Relatividade	Postulados de Einstein|Relatividade restrita|Dilatação do tempo|Contração do comprimento|Simultaneidade|Massa e energia|Energia relativística|Velocidade da luz
Física Moderna	Física quântica	Quantização da energia|Radiação de corpo negro|Efeito fotoelétrico|Fótons|Dualidade onda-partícula|Comprimento de onda de De Broglie|Princípio da incerteza|Modelos atômicos|Modelo de Bohr|Espectros atômicos|Níveis de energia|Transições eletrônicas
Física Moderna	Física atômica	Estrutura do átomo|Elétron|Núcleo atômico|Prótons|Nêutrons|Raios X|Emissão e absorção de radiação|Espectroscopia|Números quânticos
Física Nuclear e Radiações	Radioatividade	Núcleo atômico|Isótopos|Radioatividade|Radiação alfa|Radiação beta|Radiação gama|Meia-vida|Atividade radioativa|Decaimento radioativo|Séries radioativas|Detectores de radiação
Física Nuclear e Radiações	Energia nuclear	Energia de ligação nuclear|Defeito de massa|Fissão nuclear|Fusão nuclear|Reatores nucleares|Aplicações médicas da radiação|Radioterapia|Medicina nuclear|Datação radioativa|Irradiação de alimentos|Proteção radiológica
Astronomia e Cosmologia	Astronomia básica	Sistema Solar|Planetas|Satélites naturais|Asteroides|Cometas|Estrelas|Galáxias|Movimento aparente do Sol|Estações do ano|Fases da Lua|Eclipses
Astronomia e Cosmologia	Cosmologia	Origem do universo|Big Bang|Expansão do universo|Radiação cósmica de fundo|Evolução estelar|Buracos negros|Matéria escura|Energia escura
Física Experimental	Medidas e experimentação	Medição direta|Medição indireta|Incerteza experimental|Erro sistemático|Erro aleatório|Precisão|Exatidão|Instrumentos de medida|Construção de gráficos|Linearização de dados|Análise de tabelas|Controle de variáveis|Hipótese|Modelo experimental|Procedimento experimental|Conclusão experimental
$catalog$, E'\n') AS value
  WHERE trim(value) <> ''
), parsed AS (
  SELECT
    parts[1] AS area_nome,
    parts[2] AS conteudo_nome,
    parts[3] AS subconteudos
  FROM raw
  CROSS JOIN LATERAL string_to_array(line, E'\t') AS parts
), upsert_conteudos AS (
  INSERT INTO public.catalog_conteudos (nome, area_id, ativo)
  SELECT p.conteudo_nome, a.id, true
  FROM parsed p
  JOIN public.catalog_areas a ON a.nome = p.area_nome
  ON CONFLICT (area_id, nome) DO UPDATE
  SET ativo = EXCLUDED.ativo,
      updated_at = now()
  RETURNING id
)
INSERT INTO public.catalog_subconteudos (nome, conteudo_id, ativo)
SELECT trim(sub.nome), c.id, true
FROM parsed p
JOIN public.catalog_areas a ON a.nome = p.area_nome
JOIN public.catalog_conteudos c ON c.area_id = a.id AND c.nome = p.conteudo_nome
CROSS JOIN LATERAL unnest(string_to_array(p.subconteudos, '|')) AS sub(nome)
WHERE trim(sub.nome) <> ''
ON CONFLICT (conteudo_id, nome) DO UPDATE
SET ativo = EXCLUDED.ativo,
    updated_at = now();

WITH related_names(nome) AS (
  SELECT trim(value)
  FROM regexp_split_to_table($related$
Aceleração
Aceleração centrípeta
Aceleração da gravidade
Altura máxima
Amplitude
Análise dimensional
Área sob o gráfico
Atrito
Atrito cinético
Atrito estático
Campo elétrico
Campo gravitacional
Campo magnético
Capacitância
Calor
Calor específico
Calor latente
Carga elétrica
Centro de massa
Comprimento de onda
Conservação da carga
Conservação da energia
Conservação da quantidade de movimento
Conversão de unidades
Corrente elétrica
Densidade
Deslocamento
Diagrama de forças
Diferença de potencial
Dilatação
Direção e sentido
Distância percorrida
Efeito Joule
Empuxo
Energia cinética
Energia dissipada
Energia interna
Energia mecânica
Energia potencial elástica
Energia potencial elétrica
Energia potencial gravitacional
Equilíbrio térmico
Equilíbrio translacional
Equilíbrio rotacional
Frequência
Força centrípeta
Força conservativa
Força de atrito
Força elástica
Força elétrica
Força magnética
Força normal
Força peso
Força resultante
Gráfico aceleração × tempo
Gráfico corrente × tensão
Gráfico força × deslocamento
Gráfico posição × tempo
Gráfico pressão × volume
Gráfico temperatura × tempo
Gráfico velocidade × tempo
Impulso
Intensidade sonora
Lei de Coulomb
Lei de Faraday
Lei de Hooke
Lei de Lenz
Lei de Ohm
Leis de Newton
Linhas de campo
Massa
Movimento circular
Movimento retilíneo
Período
Potência
Potencial elétrico
Pressão
Pressão hidrostática
Quantidade de movimento
Referencial
Resistência elétrica
Resistividade
Rendimento
Superfícies equipotenciais
Temperatura
Torque
Trabalho
Tração
Velocidade angular
Velocidade média
Velocidade orbital
Velocidade relativa
Vetor aceleração
Vetor força
Vetor velocidade
Volume
$related$, E'\n') AS value
  WHERE trim(value) <> ''
)
INSERT INTO public.catalog_relacionados (nome, ativo)
SELECT nome, true FROM related_names
ON CONFLICT (nome) DO UPDATE
SET ativo = EXCLUDED.ativo,
    updated_at = now();

WITH tag_names(nome) AS (
  SELECT trim(value)
  FROM regexp_split_to_table($tags$
Cálculo direto
Cálculo em várias etapas
Questão conceitual
Questão contextualizada
Questão interdisciplinar
Questão experimental
Questão com pegadinha
Questão de revisão
Questão de aplicação cotidiana
Questão de comparação
Questão de proporcionalidade
Questão de análise qualitativa
Questão de análise quantitativa
Questão de interpretação textual
Questão de interpretação gráfica
Questão de interpretação de tabela
Questão de estimativa
Questão de ordem de grandeza
Com gráfico
Com tabela
Com imagem
Com esquema
Com circuito
Com diagrama de forças
Com texto longo
Com texto curto
Com experimento
Com tirinha
Com situação-problema
Com dados numéricos
Sem cálculo
Com cálculo
Com unidade de medida
Com conversão de unidade
Com fórmula explícita
Sem fórmula explícita
Múltipla escolha
Certo ou errado
Resposta numérica
Resposta discursiva
Resposta aberta
Associação de colunas
Preenchimento de lacunas
Ordenação
Justificativa
Muito fácil
Fácil
Média
Difícil
Muito difícil
Nível básico
Nível intermediário
Nível avançado
Nível olímpico
ENEM
PAS
Vestibular
Cebraspe
UnB
Fuvest
Unicamp
Autor próprio
Livro didático
Simulado
Prova escolar
Questão adaptada
Questão original
Questão inédita
Identificar
Reconhecer
Calcular
Comparar
Classificar
Interpretar
Analisar
Relacionar
Explicar
Justificar
Avaliar
Prever
Modelar
Aplicar
Inferir
Generalizar
Resolver problema
Elaborar hipótese
Validar modelo
Cotidiano
Trânsito
Esporte
Astronomia
Tecnologia
Medicina
Meio ambiente
Energia
Indústria
Casa
Escola
Laboratório
Transporte
Comunicação
Eletrônicos
Construção civil
Clima
Som
Luz
Corpo humano
Alimentos
Segurança elétrica
Produção de energia
Sustentabilidade
$tags$, E'\n') AS value
  WHERE trim(value) <> ''
)
INSERT INTO public.catalog_tags (nome, ativo)
SELECT nome, true FROM tag_names
ON CONFLICT (nome) DO UPDATE
SET ativo = EXCLUDED.ativo,
    updated_at = now();
