# Testes: Armazenamento de arquivos (API S3 + SeaweedFS)

> Issue [#94](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/94) · prefixo `STO` · **9 testes** (2 funcionais, 6 de segurança, 1 de integração)

Garante upload e leitura de arquivos por um módulo único, com bucket privado, URLs assinadas e troca de provedor só por configuração.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[STO-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                  | O que verifica                                   | Como é testado                                                                                                 |
| -------- | --------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `STO-01` | Integração            | Upload e download pela API S3 contra o SeaweedFS | Usa o serviço do compose.                                                                                      |
| `STO-02` | Segurança · BOLA/IDOR | Bucket privado                                   | Acessar a URL de um objeto sem assinatura retorna 403.                                                         |
| `STO-03` | Segurança · BOLA/IDOR | URL assinada expira                              | Depois do prazo, retorna 403.                                                                                  |
| `STO-04` | Segurança · Upload    | Tipo, tamanho e quantidade validados             | Pelo conteúdo do arquivo, não pela extensão.                                                                   |
| `STO-05` | Segurança · Upload    | Nome do objeto gerado pelo servidor              | Nenhum nome vindo do cliente é usado; `../` não escapa do prefixo.                                             |
| `STO-06` | Segurança · BOLA/IDOR | Sem vínculo, sem URL assinada                    | Usuário sem relação com o recurso não obtém URL de objeto alheio.                                              |
| `STO-07` | Funcional             | Trocar de provedor só por variáveis de ambiente  | Endpoint, chave e bucket configuráveis; o código não muda para R2 ou S3.                                       |
| `STO-08` | Funcional             | Sem objetos órfãos                               | Apagar o registro remove o arquivo.                                                                            |
| `STO-09` | Segurança · Upload    | Arquivos servidos sem execução                   | `Content-Type` correto e `X-Content-Type-Options: nosniff`. Evita que um upload seja interpretado como página. |

Voltar ao [índice dos testes](README.md).
