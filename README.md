# Biblioteca – Front-end (jwt-app)

Front-end do sistema de gestão de biblioteca do Trabalho Integrador. Ele consome a API `jwt-api` (Express + Sequelize + JWT) com **access token + refresh token** e renova a sessão automaticamente, sem deslogar o usuário.

Stack: **Next.js 16** (App Router), React 19, TypeScript e Axios.

## Como rodar

Pré-requisitos: Node.js 20+ e a `jwt-api` rodando em `http://localhost:3000`.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev               # http://localhost:3001
```

O front roda na porta **3001** (o Next usaria a 3000, que já é da API).

### Variáveis de ambiente

| Variável              | Exemplo                      | Descrição                     |
| --------------------- | ---------------------------- | ----------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/v1`   | URL base da API (com `/v1`)   |

### CORS na API

No `index.js` da API, libere a origem do front:

```js
app.use(cors({ origin: 'http://localhost:3001', credentials: true }));
```

### Usuário inicial

Use o administrador criado pelo **seed da API** (veja o README da `jwt-api`). Com ele, cadastre os atendentes na tela **Atendentes**.

## Telas

| Rota                      | Tela                                                         | Perfil         |
| ------------------------- | ------------------------------------------------------------ | -------------- |
| `/`                       | Login com validação e mensagem de erro                       | público        |
| `/dashboard`              | Cards: livros, empréstimos ativos, atrasados e multas        | todos          |
| `/dashboard/livros`       | Busca com filtros (título, categoria, autor, disponíveis) e CRUD com categoria e vários autores | escrita: admin |
| `/dashboard/categorias`   | CRUD de categorias                                           | escrita: admin |
| `/dashboard/autores`      | CRUD de autores                                              | escrita: admin |
| `/dashboard/leitores`     | Cadastro, edição e histórico de empréstimos                  | todos          |
| `/dashboard/emprestimos`  | Novo empréstimo (busca leitor + livro), filtro por status e devolução com multa | todos |
| `/dashboard/atendentes`   | Cadastro, edição e ativar/desativar                          | admin          |

O topo mostra o nome e o perfil do usuário logado, além do botão **Sair**.

## Autenticação e refresh token

### Fluxo

1. **Login**: `POST /auth/login` devolve `{ accessToken, refreshToken, user }`, que são salvos no `localStorage`.
2. **Toda requisição** sai com `Authorization: Bearer <accessToken>` (interceptor de *request*).
3. **Access token expirou**: a API responde **401**.
4. **O interceptor de *response*** captura o 401, chama `POST /auth/refresh { refreshToken }` e **repete a requisição original** com o novo token. Cada requisição só tenta isso **uma vez** (flag `_retry`).
5. **A API rotaciona os tokens**: o front guarda o **novo par** (o refresh antigo foi revogado).
6. **Refresh inválido, expirado ou revogado**: o front limpa a sessão e volta para o login com o aviso "Sua sessão expirou".

### Fila de refresh (requisições simultâneas)

Arquivo: [`lib/api.ts`](lib/api.ts).

```ts
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = publicApi.post('/auth/refresh', { refreshToken })
      .then(/* salva o novo par */)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;   // todas as requisições com 401 aguardam a MESMA promessa
}
```

Se o dashboard dispara 4 requisições e todas recebem 401, **só uma** chamada a `/auth/refresh` é feita. As outras ficam "na fila", aguardando a mesma promessa, e depois são repetidas com o novo token. Isso é essencial com rotação de token: dois refresh paralelos fariam o segundo usar um refresh já revogado, e a API revogaria **todos** os tokens do usuário (detecção de roubo).

### Proteção de rotas

- **`proxy.ts`** (antigo *middleware*): faz uma checagem otimista. Sem o cookie-marcador `has_session`, redireciona `/dashboard/*` para o login antes mesmo de renderizar. Esse cookie **não contém token**; serve só como indicador.
- **`AppShell`**: ao abrir a página, confirma a sessão com `GET /auth/me` (renovando o token se preciso). Sem sessão válida, redireciona para o login.
- **Perfis**: menus e botões de administrador ficam ocultos para atendentes, e `/dashboard/atendentes` mostra "Acesso restrito". **Isso é só usabilidade**: quem bloqueia de fato é a API, com **403**. Se um atendente forçar a chamada, a tela exibe a mensagem de acesso negado.
- **Logout**: `POST /auth/logout { refreshToken }` revoga o refresh na API e limpa a sessão local. O logout feito em uma aba também encerra a sessão nas outras (evento `storage`).

### Decisão: tokens no `localStorage`, riscos e mitigação

**Por que:** é simples, sobrevive ao recarregar a página e é compartilhado entre abas. Além disso, o enunciado pede que o refresh token trafegue no corpo da resposta.

**Riscos:**

- **XSS**: qualquer script malicioso que rode na página consegue ler o `localStorage` e roubar os dois tokens. Esse é o principal risco.
- O refresh token dura 7 dias. Se for roubado, dá acesso prolongado.

**Mitigações adotadas:**

- O access token dura só 15 minutos.
- A rotação do refresh token, somada à detecção de reuso na API, faz o uso do token roubado revogar todos os tokens do usuário.
- O React escapa o conteúdo renderizado e o projeto não usa `dangerouslySetInnerHTML`.
- O logout revoga o refresh token no servidor.

**Alternativas:**

- `sessionStorage` reduz a janela de exposição (some ao fechar a aba), mas obriga a logar de novo em cada aba.
- O mais seguro é o refresh token em **cookie `httpOnly`** (desafio extra), que o JavaScript não consegue ler.

## Contrato esperado da API

O front é tolerante a pequenas variações, mas espera:

- Listagens retornam um array, ou um objeto com `data`, `rows` ou `items` (paginação).
- Associações com alias minúsculo ou maiúsculo (`book`/`Book`, `authors`/`Authors`, `category`/`Category`, `reader`/`Reader`).
- `POST/PUT /books` recebe `{ title, isbn, year, totalCopies, categoryId, authorIds: number[] }`.
- `POST /loans` recebe `{ bookId, readerId }`. `PATCH /loans/:id/return` devolve o empréstimo com `fine`.
- `PATCH /user/:id/active` recebe `{ active: boolean }`.
- `GET /reports/dashboard` (admin) devolve `{ totalBooks, activeLoans, overdueLoans, totalFines }`. Para o atendente, o front calcula os totais a partir das listagens.
- Erros devolvem `{ message }` (ex.: **409** ao excluir categoria com livros). A mensagem é exibida na tela.

As regras de empréstimo (estoque, máximo de 3 ativos, bloqueio por atraso, multa de R$ 1,00/dia) são **validadas pela API**. O front só antecipa os avisos (desabilita o botão e mostra a prévia da multa) para melhorar a usabilidade.

## Estrutura

```
app/
├── layout.tsx              AuthProvider global
├── page.tsx                Login
└── dashboard/
    ├── layout.tsx          AppShell (proteção + topo + menu)
    ├── page.tsx            Dashboard
    ├── livros/ categorias/ autores/ leitores/ emprestimos/ atendentes/
components/
├── AuthProvider.tsx        sessão, login, logout, /auth/me
├── AppShell.tsx            layout protegido + AdminOnly
├── CrudPage.tsx            CRUD genérico (categorias e autores)
└── ui.tsx                  Modal, Alert, Field, badges…
lib/
├── api.ts                  Axios + interceptors + fila de refresh
├── session.ts              armazenamento dos tokens
├── useFetch.ts             hook de busca
├── format.ts               datas, moeda, CPF, multa, normalização
└── types.ts
proxy.ts                    redirecionamento otimista das rotas protegidas
```

## Demonstração do refresh no vídeo

Deixe o access token da API com validade de **30 segundos** (temporariamente). Abra a aba **Network** do DevTools, espere 30 s e navegue: aparece um `401`, seguido de **um único** `POST /auth/refresh` e da requisição original repetida com `200`, tudo sem sair da tela.
