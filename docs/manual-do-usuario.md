# Manual do usuário

Guia para quem vai usar o AdotaPet: encontrar um pet, ver se vocês combinam e pedir a adoção. O sistema é um protótipo com dados de demonstração: **nenhuma adoção real acontece**.

## 1. Primeiros passos

Abra o endereço do sistema (localmente, <http://localhost:5173>). Você entra direto como o usuário de demonstração, sem cadastro nem senha. O nome e as iniciais aparecem no canto superior direito.

O menu tem cinco itens:

| Item                | Para que serve                          |
| ------------------- | --------------------------------------- |
| Início              | Apresentação e os pets mais recentes    |
| Encontrar pets      | Buscar e filtrar todos os pets          |
| Favoritos           | Pets que você marcou com o coração      |
| Minhas solicitações | Acompanhar e cancelar pedidos de adoção |
| Meu perfil          | Seus dados, usados na compatibilidade   |

Ao lado de **Favoritos** e **Minhas solicitações** há um número com o total de favoritos e de pedidos ainda em andamento. Em telas pequenas, o menu abre pelo botão com três linhas.

## 2. Complete seu perfil primeiro

Sem o perfil completo você não consegue enviar uma solicitação.

1. Clique em **Meu perfil**.
2. Preencha os dados pessoais: nome, CPF, data de nascimento (18 anos ou mais), e-mail, telefone com DDD, CEP e endereço. CPF, telefone e CEP aceitam pontos e traços.
3. Preencha moradia e rotina: tipo de moradia, área externa, tempo disponível por dia, nível de atividade, crianças, outros pets, experiência e se aceita cuidados especiais.
4. Informe preferências (espécie e porte). Elas alimentam o atalho "Usar minhas preferências".
5. Clique em **Salvar perfil**. Aparece "Perfil atualizado".

A barra **"Perfil X% completo"** e a lista de campos faltantes mostram o que ainda precisa ser preenchido. Campos inválidos ficam destacados com a mensagem do problema.

## 3. Encontrar um pet

Em **Encontrar pets**:

- **Buscar:** digite nome, raça ou cidade. A lista atualiza sozinha.
- **Filtrar:** espécie (Cachorro ou Gato), porte (Pequeno, Médio, Grande; dá para marcar mais de um) e sexo.
- **Ordenar:** mais recentes, nome A–Z ou mais próximos.
- **Usar minhas preferências:** aplica a espécie e o porte do seu perfil de uma vez.
- **Limpar:** remove todos os filtros.
- **Carregar mais:** mostra os próximos pets (4 por vez).

Os filtros ficam no endereço da página: você pode copiar o link, usar o botão "voltar" do navegador e recarregar sem perder a busca.

Se nada for encontrado, a tela sugere remover algum filtro.

## 4. Conhecer o pet

Clique em um cartão para abrir os detalhes: fotos, história, energia, espaço ideal, convivência com crianças e com outros pets, vacinação e castração, organização responsável e cidade.

- **Favoritar:** clique no coração (em qualquer cartão ou na página do pet). Ele muda na hora; se algo falhar, um aviso aparece e o coração volta ao estado anterior.
- **Ver compatibilidade:** segue para o próximo passo.

## 5. Ver a compatibilidade

A tela compara o seu perfil com o pet em 7 critérios (energia, espaço, crianças, outros pets, cuidados especiais, experiência e tempo disponível) e mostra:

- o **percentual** e o nível (**Alta** a partir de 80%, **Média** a partir de 55%, **Baixa** abaixo disso);
- os **pontos que combinam**;
- os **pontos para conversar**, que merecem atenção antes de decidir.

O resultado é **orientativo**: não garante nem impede a aprovação. Se mudar o perfil, o cálculo seguinte já usa os novos dados. Clique em **Continuar para o questionário** para seguir.

## 6. Responder o questionário

Preencha:

| Campo         | O que informar                                            |
| ------------- | --------------------------------------------------------- |
| Motivação     | Por que quer adotar (20 a 500 caracteres)                 |
| Rotina        | Como é o seu dia a dia (20 a 500 caracteres)              |
| Tempo sozinho | Quanto tempo o pet ficaria sozinho                        |
| Adaptação     | Como vai receber o pet em casa (15 a 350 caracteres)      |
| Custos        | Marque ciente dos custos recorrentes (obrigatório)        |
| Compromisso   | Marque o compromisso com o bem-estar do pet (obrigatório) |

Campos com problema ficam em vermelho com a explicação, e o erro some quando você corrige. Clique em **Revisar e enviar solicitação**. O botão fica em "Enviando..." para evitar pedidos duplicados.

Possíveis avisos:

- **"Complete seu perfil para solicitar a adoção":** faltam campos; o aviso lista quais e leva ao perfil.
- **"Você já tem uma solicitação em andamento":** só pode haver um pedido ativo por pet. Se você ainda não começou a preencher, o sistema leva direto às suas solicitações.
- **"Este pet não está mais disponível".**

## 7. Confirmação

Depois do envio você vê o **código** (por exemplo `SOL-1043`), a organização responsável, o pet e a data. Guarde o código para acompanhar o pedido.

## 8. Acompanhar e cancelar solicitações

Em **Minhas solicitações** cada pedido mostra foto, código, pet, status, data e organização.

| Status       | Significado                    | Dá para cancelar? |
| ------------ | ------------------------------ | ----------------- |
| `Enviada`    | A organização recebeu o pedido | Sim               |
| `Em análise` | A organização está avaliando   | Sim               |
| `Aprovada`   | A organização aceitou          | Não               |
| `Recusada`   | A organização não aceitou      | Não               |
| `Cancelada`  | Você desistiu                  | Não               |

Para cancelar, clique em **Cancelar** no cartão e confirme em **Cancelar solicitação** no aviso ("Essa ação não pode ser desfeita"). **Voltar**, a tecla Esc ou um clique fora fecham o aviso sem cancelar. Depois de cancelada, você pode pedir o mesmo pet de novo.

## 9. Favoritos

**Favoritos** reúne os pets marcados com o coração. Clique de novo no coração para remover. Se a lista estiver vazia, o botão **Encontrar um pet** leva à listagem.

## 10. Dúvidas frequentes

**Preciso criar uma conta?** Não. O protótipo usa um usuário de demonstração fixo.

**Meus dados são guardados?** Ficam apenas no arquivo da API simulada do computador onde o sistema roda. Não são enviados a ninguém.

**Por que algumas imagens não aparecem?** As fotos vêm da internet. Sem conexão, o restante continua funcionando.

**Digitei um endereço errado e vi "Página não encontrada".** Use o menu para voltar ao Início.

**Algo deu errado ("Algo deu errado" na tela).** Use **Tentar novamente** ou **Voltar ao início**. Se persistir, avise quem opera o sistema (ver [Manual de operação](manual-de-operacao.md)).
