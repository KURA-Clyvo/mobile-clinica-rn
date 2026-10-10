import { useRouter, type Href } from 'expo-router';
import { ROUTES } from '@constants/routes';

// BR-CLI-T05 (G2 I-4) — UMA fonte para "quem é o pai de cada rota" e UMA forma de voltar.
// O `AppLayout` usa `backBehavior="history"`: `router.back()` desfaz a navegação de verdade, mas em tela aberta por
// URL direta/F5 não há histórico e o `GO_BACK` não é tratado — o botão ficava parado. Por isso nenhum arquivo de
// `src/` chama `router.back()` direto (gate: `tests/navegacao-gate.test.ts`); todos passam por `voltarOu`/`useVoltar`.

type Roteador = { back: () => void; canGoBack: () => boolean; replace: (href: Href) => void };

/** Tela-pai das rotas que dependem de um `idPet`/ficha. `ficha` → lista de pacientes; `idPet` → ficha do pet da rota. */
export function destinoSemHistorico(rota: 'ficha' | 'idPet', params?: { idPet?: string }): Href {
  if (rota === 'idPet') {
    const id = Number(params?.idPet);
    return Number.isFinite(id) && id > 0 ? ROUTES.app.pacienteDetalhe(id) : ROUTES.app.dashboard;
  }
  return ROUTES.app.pacientes;
}

/** Ficha do pet da rota atual (consulta/receituário/teleorientação); sem id válido, a Hoje. */
export function fichaDoPet(idPet: string | number | undefined): Href {
  return destinoSemHistorico('idPet', { idPet: idPet === undefined ? undefined : String(idPet) });
}

/** Volta no histórico quando existe; senão (URL direta/F5) leva à tela-pai `destino`. */
export function voltarOu(router: Roteador, destino: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(destino);
}

/** Hook: `const voltar = useVoltar(destino)`; `voltar()` faz `voltarOu` com o roteador real. */
export function useVoltar(destino: Href): () => void {
  const router = useRouter();
  return () => voltarOu(router, destino);
}
