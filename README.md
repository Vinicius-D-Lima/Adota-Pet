# AdotaPet Frontend

Protótipo funcional em React do fluxo principal de adoção responsável do AdotaPet. Todos os dados são locais e ficam em variáveis/estado dos componentes, sem API ou banco de dados.

## Fluxo implementado

1. Página inicial e apresentação do produto
2. Pesquisa e filtros de pets
3. Detalhes e necessidades do animal
4. Compatibilidade com o perfil do adotante
5. Questionário de adoção com validação
6. Envio e confirmação da solicitação
7. Acompanhamento e cancelamento de solicitações
8. Edição do perfil usado na compatibilidade

## Executar

```bash
npm install
npm run dev
```

Para gerar o build de produção:

```bash
npm run build
```

## Organização

- `src/components`: componentes reutilizáveis de layout, cards, formulários e etapas
- `src/pages`: páginas do fluxo principal
- `src/data/pets.js`: massa de dados local para pets, perfil e solicitações
- `src/App.jsx`: rotas e estado principal da simulação
