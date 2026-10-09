// BR-CLI-T02 — canal único de confirmação/aviso, igual no nativo e no web.
//
// Por que existe: `Alert.alert` do react-native-web é `static alert() {}` (no-op,
// node_modules/react-native-web/dist/exports/Alert/index.js). No web — onde a clínica é
// publicada — toda confirmação e todo retorno por `Alert.alert` simplesmente sumia, e a ação
// decisória (Sair, Desativar, Usar rascunho da Luna…) ficava inalcançável.
//
// Funcionamento: `confirmar`/`avisar` só enfileiram um pedido; quem desenha é o `ConfirmHost`
// montado uma vez em `src/app/_layout.tsx`. Sem host montado, `confirmar` devolve `false`
// (falha segura: a ação decisória NÃO acontece sem confirmação visível) e `avisar` resolve.

export type OpcoesConfirmar = {
  titulo: string;
  mensagem?: string;
  /** Verbo da ação, escrito no botão ("Sair", "Desativar", "Usar rascunho"). */
  verbo: string;
  destrutivo?: boolean;
  /** Rótulo do botão de recusa; padrão "Cancelar" (ex.: "Continuar conectado" no logout). */
  rotuloCancelar?: string;
};

export type OpcoesAvisar = { titulo: string; mensagem?: string };

/** Escolha entre 2+ ações nomeadas (ex.: Galeria / Câmera). Cancelar resolve `null`. */
export type OpcoesEscolher = {
  titulo: string;
  mensagem?: string;
  opcoes: { id: string; rotulo: string }[];
};

export type PedidoFeedback =
  | ({ tipo: 'confirmar'; resolver: (v: boolean) => void } & OpcoesConfirmar)
  | ({ tipo: 'avisar'; resolver: () => void } & OpcoesAvisar)
  | ({ tipo: 'escolher'; resolver: (id: string | null) => void } & OpcoesEscolher);

type Host = (p: PedidoFeedback) => void;
let host: Host | null = null;

/** Usado só pelo `ConfirmHost`. Devolve a função que desregistra. */
export function registrarHost(h: Host): () => void {
  host = h;
  return () => {
    if (host === h) host = null;
  };
}

export function confirmar(o: OpcoesConfirmar): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!host) {
      if (__DEV__) console.warn('confirmar(): nenhum ConfirmHost montado — ação NÃO confirmada.');
      resolve(false);
      return;
    }
    host({ ...o, tipo: 'confirmar', resolver: resolve });
  });
}

export function avisar(o: OpcoesAvisar): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!host) {
      if (__DEV__) console.warn('avisar(): nenhum ConfirmHost montado.');
      resolve();
      return;
    }
    host({ ...o, tipo: 'avisar', resolver: resolve });
  });
}

export function escolher(o: OpcoesEscolher): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    if (!host) {
      if (__DEV__) console.warn('escolher(): nenhum ConfirmHost montado.');
      resolve(null);
      return;
    }
    host({ ...o, tipo: 'escolher', resolver: resolve });
  });
}
