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
npm run web        # Web (react-native-web, Expo Router com output "static")
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

## Teleconsulta (TASK-11) — Expo Go vs dev-build

A tela `teleorientacao/[idPet]` entra na sala do Daily.co (criada via
`api/v1/teleconsulta/{id}/sala`, ver backend-clinica-dotnet TASK-10) abrindo a `dsSalaUrl` no
navegador do dispositivo (`Linking.openURL`, de `react-native`) em vez de embutir o SDK nativo
`@daily-co/react-native-daily-js`.

**Por quê:** o SDK nativo do Daily exige um **dev-build** (módulos nativos não presentes no
runtime do Expo Go). Para o PoC, isso adicionaria uma etapa de build nativo só para testar o
fluxo de teleconsulta. `Linking.openURL` (via `expo-linking`, já é dependência do projeto) abre
a sala do Daily no navegador do próprio aparelho — o Daily.co tem client web completo — e
**funciona no Expo Go sem nenhuma dependência nova**.

**Trade-off:** a experiência não é embutida no app (o usuário sai do app para o navegador). Se a
UX embutida for um requisito real do produto, os próximos passos, em ordem de esforço:
1. `react-native-webview` (funciona no Expo Go, WebView embutida, mas requer visualização
   crua da room URL — Daily não garante o mesmo suporte de features do client nativo em WebView).
2. `@daily-co/react-native-daily-js` — melhor UX, mas exige migrar para um **dev-build**
   (`npx expo run:android` / `eas build --profile development`), não roda mais no Expo Go puro.

Entrada na tela: a partir da Agenda (botão "Teleconsulta" em cada agendamento não cancelado,
que carrega `idAgendamento`); a entrada ad-hoc pela ficha do paciente não tem agendamento
associado e por isso não consegue chamar o backend (mostra aviso para usar a Agenda).
