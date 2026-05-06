# KURA Mobile Clínica

App mobile para clínicas veterinárias — React Native + Expo Router.

## Setup

```bash
# Requisito: Node 20 (ver .nvmrc)
nvm use

# Instalar dependências
npm install

# Copiar env vars
cp .env.example .env
# Editar .env com as URLs reais se necessário
```

## Env vars

| Variável | Descrição |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Base URL do backend .NET (KURA API) |
| `EXPO_PUBLIC_LUNA_BASE_URL` | Base URL do serviço Python da Luna |
| `EXPO_PUBLIC_USE_MOCKS` | `true` para usar fixtures locais (sem rede) |

## Scripts

```bash
npm start          # Expo Dev Server
npm run android    # Android
npm run ios        # iOS (macOS only)
npm test           # Jest
npm run lint       # ESLint
npm run type-check # TypeScript
```

## Branches

| Branch | Finalidade |
|---|---|
| `main` | Produção |
| `develop` | Integração contínua |
| `feat/*` | Features individuais |

## Stack

- **Expo 53** + **React Native 0.79**
- **Expo Router 4** — file-based routing
- **TanStack Query v5** — server state
- **Axios** — HTTP client com interceptors JWT
- **Zustand** — UI/auth state global
- **React Hook Form + Zod** — formulários tipados
- **TypeScript strict** + `noUncheckedIndexedAccess`

## Modo mock

Com `EXPO_PUBLIC_USE_MOCKS=true`, todas as chamadas HTTP são interceptadas e servidas por
fixtures estáticas em `src/mocks/`. Nenhuma requisição real é feita. Latência simulada de 300ms.
