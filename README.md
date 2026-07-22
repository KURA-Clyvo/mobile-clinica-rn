# KURA Mobile Clínica

App mobile para clínicas veterinárias — React Native + Expo Router.

## Link do vídeo no Youtube
 https://youtube.com/shorts/Ik28Muwtljc?feature=share

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

| Variável | Obrigatória | Exemplo | Descrição |
|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | prod | `http://192.168.1.100:8080` | Base URL do backend .NET (KURA API) |
| `EXPO_PUBLIC_LUNA_BASE_URL` | prod | `http://192.168.1.100:8000` | Base URL do serviço Python da Luna |
| `EXPO_PUBLIC_LUNA_API_KEY` | prod | `kura-luna-secret` | API key enviada no header `X-API-Key` ao lunaClient |
| `EXPO_PUBLIC_USE_MOCKS` | dev | `true` | `true` = fixtures locais (sem rede); default de dev |

### Matriz de comportamento

| `EXPO_PUBLIC_USE_MOCKS` | `EXPO_PUBLIC_API_BASE_URL` | Resultado |
|---|---|---|
| `true` | qualquer | Todas as chamadas resolvem por fixtures (`src/mocks/`) |
| `false` | definida | App conecta ao .NET real e à Luna |
| `false` | vazia | Axios usa path relativo (falha em produção — definir sempre) |

> A Luna usa um `lunaClient` separado com header `X-API-Key`. O `.NET apiClient` nunca envia essa key.

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
