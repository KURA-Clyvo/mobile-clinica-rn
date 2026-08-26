declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_BASE_URL: string;
      EXPO_PUBLIC_LUNA_BASE_URL: string;
      EXPO_PUBLIC_USE_MOCKS: string;
      // CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 5: quando 'true'
      // (default DESLIGADO — ligar é ato deliberado de demonstração, nunca o
      // padrão), handlers de LISTA em modo mock devolvem coleção vazia, pra
      // os estados vazios (item 1) aparecerem na demonstração. Ver
      // `resolveMock()` em `src/services/api/mock-adapter.ts`.
      EXPO_PUBLIC_MOCK_EMPTY?: string;
    }
  }
}

export {};
