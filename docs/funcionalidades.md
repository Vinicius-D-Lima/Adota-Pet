# Funcionalidades

Descrição de cada tela e das regras de negócio. Todas leem e gravam dados pela [API simulada](api-simulada.md).

## Mapa de rotas

| Rota                               | Tela                  | Observação                                       |
| ---------------------------------- | --------------------- | ------------------------------------------------ |
| `/`                                | Início                | Pet em destaque e os 3 pets mais recentes        |
| `/pets`                            | Encontrar pets        | Busca, filtros e paginação; filtros ficam na URL |
| `/pets/:petId`                     | Detalhe do pet        | Etapa 1 do fluxo                                 |
| `/pets/:petId/compatibilidade`     | Compatibilidade       | Etapa 2                                          |
| `/pets/:petId/questionario`        | Questionário          | Etapa 3                                          |
| `/solicitacoes/:requestId/enviada` | Confirmação           | Etapa 4                                          |
| `/solicitacoes`                    | Minhas solicitações   | Acompanhamento e cancelamento                    |
| `/favoritos`                       | Favoritos             | Pets favoritados                                 |
| `/perfil`                          | Meu perfil            | Dados usados na compatibilidade e na solicitação |
| qualquer outra                     | Página não encontrada | Não redireciona: o endereço da barra não muda    |

O fluxo de adoção tem quatro etapas, mostradas pelo componente `FlowSteps`: **Conhecer o pet → Compatibilidade → Questionário → Solicitação**.

## Layout (todas as telas)

- Cabeçalho com a marca, o menu e o atalho do usuário (iniciais e primeiro nome). As iniciais ignoram partículas como "de", "da" e "dos" (`getInitials`).
- Itens do menu: Início, Encontrar pets, Favoritos, Minhas solicitações e Meu perfil.
- **Contadores no menu:** total de favoritos e total de solicitações **ativas** (nem canceladas, nem recusadas). Atualizam sem recarregar a página.
- Aviso temporário (toast de 5 segundos) quando favoritar ou desfavoritar falha.
- Menu responsivo para telas pequenas.

## Início

Apresentação do produto, chamada para o perfil, explicação do fluxo em três passos e os pets mais recentes. Mostra esqueletos enquanto carrega e uma mensagem com botão "Tentar novamente" se a API falhar.

## Encontrar pets (`/pets`)

- **Busca por texto** (nome, raça ou cidade), com espera de 300 ms depois da digitação.
- **Filtros:** espécie (Cachorro, Gato), **porte** (Pequeno, Médio, Grande), sexo (Fêmea, Macho) e **ordenação** (mais recentes, nome A–Z, mais próximos).
- **Porte aceita mais de um valor.** São botões de alternância, e a URL leva `size` repetido: `?size=Pequeno&size=Médio`.
- **Os filtros ficam na URL** (`useSearchParams`). Dá para compartilhar o link, usar o botão voltar e recarregar sem perder a busca. Valores fora da lista permitida são ignorados.
- **Paginação por "Carregar mais"**: 4 pets por página, com `useInfiniteQuery`.
- **"Usar minhas preferências":** traduz a espécie e o porte do perfil em filtros. "Pequeno ou médio" vira dois portes; "Sem preferência" não filtra. O botão fica desabilitado quando o perfil não tem preferências, com um texto explicando por quê.
- **"Mais próximos":** a distância é calculada pelo servidor, a partir das coordenadas fixas do usuário de demonstração (não há geolocalização do navegador).
- Contagem de resultados, botão "Limpar", estado vazio ("Nenhum pet encontrado") e estado de erro com nova tentativa.
- Cada cartão mostra foto (carregamento sob demanda), distância, nome, sexo, raça, idade, porte, **selos de vacinação e castração**, resumo, características e o botão de favoritar.

## Detalhe do pet (`/pets/:petId`)

- Galeria de fotos, nome, características, história e **"O que eu preciso"**: nível de energia, espaço ideal, convivência com crianças e com outros pets, e situação de **vacinação e castração** (os dois estados aparecem: "Vacinado" ou "Não vacinado", "Castrado" ou "Não castrado").
- Organização responsável, cidade e distância aproximada.
- Botão de favoritar.
- **Próximo passo:** "Ver compatibilidade". Se já existe uma solicitação ativa para este pet, o botão dá lugar a um aviso com o código e o status, e um link para "Ver minhas solicitações".
- Pet inexistente mostra **"Pet não encontrado"** com link para a listagem. Falha de rede mostra "Tentar novamente".

## Compatibilidade (`/pets/:petId/compatibilidade`)

Compara o perfil do adotante com o pet. O cálculo é feito **no cliente** (`src/utils/calculateCompatibility.ts`), com 7 critérios de peso igual:

| #   | Critério           | Vira "ponto de atenção" quando...                                           |
| --- | ------------------ | --------------------------------------------------------------------------- |
| 1   | Energia do pet     | O pet tem energia **Alta** e o nível de atividade do perfil não é **Ativo** |
| 2   | Espaço             | O pet precisa de quintal e o perfil não informa área externa                |
| 3   | Crianças           | O pet prefere casa sem crianças e o perfil tem crianças                     |
| 4   | Outros pets        | O pet prefere ser o único e o perfil já tem outros pets                     |
| 5   | Cuidados especiais | O pet precisa de cuidados especiais e o perfil não os aceita                |
| 6   | Experiência        | O perfil é "Primeiro pet"                                                   |
| 7   | Tempo disponível   | O pet tem energia **Alta** e o tempo diário do perfil é "Até 1 hora"        |

- **Pontuação** = critérios atendidos ÷ 7, arredondada para inteiro (de 0 a 100).
- **Nível:** `Alta` a partir de 80%, `Média` a partir de 55%, `Baixa` abaixo disso.
- Com o critério 7, os resultados possíveis ficam em múltiplos de 1/7: 100%, 86%, 71%, 57%, 43%, 29%, 14% e 0%.
- Um tempo diário **vazio** não penaliza o critério 7. Nos critérios 2 e 5, quando o pet tem a exigência, ela só é satisfeita com `true` explícito no perfil (um perfil em branco não conta como "sim").
- A tela lista os **pontos que combinam** e os **pontos para conversar**, e avisa que o resultado é orientativo e não garante a aprovação.
- "Continuar para o questionário" some se já existe solicitação ativa para o pet (o aviso aparece no lugar).

## Questionário (`/pets/:petId/questionario`)

Campos e regras (validados com Zod, tanto no cliente quanto de novo pelo servidor):

| Campo        | Regra                                                       |
| ------------ | ----------------------------------------------------------- |
| `motivation` | Entre 20 e 500 caracteres                                   |
| `routine`    | Entre 20 e 500 caracteres                                   |
| `aloneTime`  | Até 2 horas, Até 4 horas, De 4 a 8 horas ou Mais de 8 horas |
| `adaptation` | Entre 15 e 350 caracteres                                   |
| `costs`      | Precisa estar marcado (ciência dos custos recorrentes)      |
| `commitment` | Precisa estar marcado (compromisso com o bem-estar do pet)  |

- Os erros aparecem **campo a campo**, e o erro de um campo some quando a pessoa volta a editá-lo.
- O envio é uma mutação (`POST /requests`). Clique duplo não cria duas solicitações: o botão fica desabilitado em "Enviando...".
- **Respostas do servidor tratadas:**
  - **400:** destaca os campos com erro (removendo o prefixo `answers.`);
  - **404:** "Este pet não está mais disponível", com link para a listagem;
  - **409:** "Você já tem uma solicitação em andamento para {pet}", com código, status e link;
  - **422:** "Complete seu perfil para solicitar a adoção", lista os campos que faltam e linka para `/perfil`;
  - falha de rede ou outro erro: mensagem genérica, e o botão volta a funcionar.
- Em caso de sucesso, vai para `/solicitacoes/:id/enviada`.

### Bloqueio proativo de solicitação duplicada

Em vez de deixar a pessoa preencher tudo para só então receber o 409, o frontend avisa antes:

- O hook `useActiveRequestForPet(petId)` procura, na lista de solicitações, uma ativa para o pet (`isActiveRequest`: tudo que não é `Cancelada` nem `Recusada`).
- **Detalhe e compatibilidade:** o botão de seguir dá lugar ao aviso `ActiveRequestNotice`.
- **Questionário:** redireciona para `/solicitacoes`, mas **só** quando a pessoa ainda não começou a preencher **e** a lista não está sendo atualizada. Quem já digitou, está enviando ou acabou de enviar nunca é desviado. Isso evita perder respostas e evita atropelar a ida para a tela de confirmação, já que a solicitação recém-criada também conta como "ativa".
- Enquanto a lista carrega (ou se ela falhar), a tela mostra o botão normal. O servidor continua barrando com o 409, que o frontend já trata.
- Depois de cancelar (ou se a solicitação for recusada), o botão volta sozinho, sem recarregar.

## Confirmação (`/solicitacoes/:requestId/enviada`)

Mostra o código da solicitação, a organização, o pet e **a data real de envio** (por exemplo "Enviada em 08 de set. de 2026"), mais os próximos passos. Solicitação inexistente mostra **"Solicitação não encontrada"** com link para a listagem.

## Minhas solicitações (`/solicitacoes`)

- Cartões com foto, código, pet, status, mensagem, data (formatada em pt-BR) e organização.
- Status possíveis: `Enviada`, `Em análise`, `Aprovada`, `Recusada` e `Cancelada`.
- **Cancelamento** só aparece para `Enviada` e `Em análise`, e **pede confirmação** em um modal ("Cancelar a solicitação de {pet}? Essa ação não pode ser desfeita.").
  - O modal é acessível: `role="dialog"`, `aria-modal`, título e descrição associados, foco inicial em "Voltar", foco preso com Tab, e foco devolvido ao fim.
  - Esc, clique fora e "Voltar" fecham sem cancelar nada. Durante a requisição, os botões ficam travados.
  - Depois de cancelar, o foco vai para o cartão da solicitação (o botão "Cancelar" some junto com o status).
  - **409** (o status mudou no servidor) e falha de rede mostram mensagens próprias, e a lista é recarregada.
- Estado vazio ("Nenhuma solicitação ainda") e estado de erro. Se o pet de uma solicitação não existir mais, aparece "Pet indisponível".

## Favoritos (`/favoritos`)

- Lista os pets favoritados, com estados de carregamento, vazio e erro.
- Favoritar e desfavoritar são **otimistas**: a interface muda na hora, as chamadas ao servidor entram em **fila** (chegam na ordem dos cliques) e, se uma falhar, só aquele pet é desfeito e um aviso é mostrado.
- O contador no menu e o coração em cada cartão acompanham o mesmo cache.

## Perfil (`/perfil`)

- Formulário com os dados pessoais (nome, CPF, nascimento, e-mail, telefone, CEP, endereço), de moradia e rotina (tipo de moradia, área externa, tempo disponível, nível de atividade, crianças, outros pets, experiência, cuidados especiais) e preferências (espécie e porte desejados).
- **Validação com Zod:** CPF com dígitos verificadores, 18 anos ou mais, e-mail, telefone com DDD, CEP de 8 dígitos. CPF, telefone e CEP aceitam máscara e são guardados só com dígitos.
- Barra de **completude** ("Perfil X% completo") e lista dos campos que faltam.
- Aviso quando o perfil salvo está incompleto, e confirmação "Perfil atualizado" depois de salvar.
- O perfil é gravado no servidor (`PUT /me/adopter-profile`) e persiste entre recarregamentos. É ele que alimenta a compatibilidade, o atalho de preferências e a validação do envio de solicitações (perfil incompleto → 422).

## Erros, 404 e carregamento

- **Página 404** para rotas desconhecidas, sem redirecionar.
- **Estados de "não encontrado"** específicos: pet e solicitação inexistentes mostram uma tela própria com link de volta.
- **Error Boundary** na raiz do app e por rota: um erro de renderização mostra "Algo deu errado", com "Tentar novamente" e "Voltar ao início". O erro é limpo ao navegar para outra rota, e o cabeçalho continua visível.
- **Code splitting:** cada página é carregada sob demanda (`React.lazy` + `Suspense`). O bundle inicial caiu de cerca de 384 kB para 330 kB (gzip de 116,8 para 104,4 kB).
- **Imagens** com `loading="lazy"` (exceto a principal da Início) e com `width` e `height` para não "pular" o layout.
- **Favicon** em `public/favicon.svg` (pata da marca).
