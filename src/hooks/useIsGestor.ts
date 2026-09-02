import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuthStore } from '@store/authStore';
import { ROUTES } from '@constants/routes';

// FM-03 — o PRIMEIRO padrão de renderização condicional por papel deste app
// (o G0 confirmou que não existia precedente algum). Consumido pela FM-02
// (tela de usuários), FM-05 (tabela de preços) e FM-07 (cards financeiros do
// dashboard).
//
// ── O DESENHO: duas perguntas, DUAS coisas, não uma abstração ──────────────
//
// Este app já resolve UMA pergunta desde a FM-01: "tenho ficha para ASSINAR
// isto?", respondida por `usuario !== null` (a FICHA de veterinário) — ver
// `pacientes/[id].tsx`, `consulta/[idPet].tsx`, `receituario/[idPet].tsx`.
// Este módulo resolve a OUTRA, que é independente: "meu PAPEL me permite VER
// isto?", respondida por `tpPerfil === 'GESTOR'`.
//
// Elas NÃO são a mesma pergunta. A prova é a matriz de 3 casos (ver
// `tests/useIsGestor.test.tsx`):
//
//   quem                    | tem ficha? | papel       | assina? | vê de gestor?
//   veterinário puro        | sim        | VETERINARIO | sim     | não
//   gestor COM ficha (demo) | sim        | GESTOR      | sim     | sim
//   gestor sem ficha        | não        | GESTOR      | não     | sim
//
// O caso do meio é o único que ocorre subindo o app de verdade
// (`AuthService.RegisterClinicaAsync:296-308` cria o gestor COM vínculo) — e
// é exatamente o que ESCONDE um padrão que colapsasse as duas perguntas: um
// helper `useCanAct()` que checasse só `usuario !== null` diria "sim" para
// as DUAS primeiras linhas e nunca revelaria que a pergunta de VISIBILIDADE
// (a terceira coluna) está sendo respondida errado pela FICHA em vez do
// PAPEL — só o caso de gestor SEM ficha, que ninguém produz demonstrando,
// desmascararia isso.
//
// Colapsar as duas produziria um helper que responde a pergunta ERRADA em
// metade dos casos reais (qualquer veterinário puro, que É a maioria dos
// logins deste app). Por isso: duas funções, cada uma lendo só o campo do
// store que responde à SUA pergunta — `useIsGestor` nunca olha `usuario`, e
// o padrão de ficha (FM-01) nunca precisou olhar `tpPerfil`.
//
// ── A OUTRA METADE: item indisponível SOME, não aparece desabilitado ───────
//
// Recomendação do backlog, adotada: sumir. Item desabilitado sem explicação
// é a classe de achado `§E27` deste repo (telas sem saída visível) — se
// aparecer, tem que dizer por quê, e isso é mais trabalho que esconder. As
// duas formas de uso abaixo produzem exatamente "sumir":
//   - `useIsGestor()` puro, usado como `{isGestor && <Secao/>}` — a seção
//     não entra na árvore para quem não é GESTOR (ver `settings.tsx`, seção
//     "Time" — primeira aplicação real deste padrão).
//   - `useRequireGestor()` — para uma TELA inteira restrita a GESTOR (o caso
//     da FM-02/FM-05): redireciona quem não é GESTOR para longe, e devolve
//     `false` para a tela renderizar `null` enquanto isso — herda a técnica
//     de guarda + redirect da FM-01 (ver `consulta/[idPet].tsx`,
//     `receituario/[idPet].tsx`), aqui generalizada porque o motivo do
//     bloqueio (papel, não ficha) é o mesmo em toda tela que a consumir.

export function useIsGestor(): boolean {
  return useAuthStore((s) => s.tpPerfil === 'GESTOR');
}

// Guarda de TELA inteira. Uso pretendido (FM-02/FM-05/FM-07):
//
//   export default function TelaDeUsuarios() {
//     const podeVer = useRequireGestor();
//     // ...outros hooks da tela, incondicionais, ANTES do guard de render...
//     if (!podeVer) return null;
//     return <ScreenContainer>...</ScreenContainer>;
//   }
//
// `redirectTo` tem default `ROUTES.app.dashboard` — todo papel autenticado
// pode ver o dashboard, então é sempre um destino seguro; passar outro valor
// é opcional, para quando uma tela específica tiver um destino mais correto
// (ex.: devolver para a ficha de onde a navegação partiu, como a FM-01 fez
// em `consulta`/`receituario` com a ficha do PET — lá o destino depende de
// `petId`, então aquele caso continua com guarda inline em vez de usar este
// hook; este hook cobre o caso comum, sem parâmetro dinâmico).
//
// ⚠️ Herda DUAS lições já pagas por este projeto, ambas sobre a MESMA classe
// de erro em sentidos opostos:
//   1. `jaRedirecionou` (ref, não estado) existe porque a G2 da FM-01 mediu
//      `router.replace` sendo chamado DUAS vezes: `router` está nas
//      dependências do `useEffect` e `useRouter()` não promete identidade
//      estável entre renders.
//   2. Este projeto já foi mordido pela mesma classe no sentido INVERSO
//      (TASK-70/FIX_6): um `useEffect` dependia de uma referência do
//      Zustand que ERA estável e por isso NUNCA re-disparava. Conclusão:não
//      depender da estabilidade NEM da instabilidade de uma referência que
//      ninguém documentou — o `ref` torna o comportamento correto sob
//      QUALQUER identidade (redireciona exatamente uma vez por montagem,
//      independente de `router` mudar de identidade ou não).
export function useRequireGestor(redirectTo: Href = ROUTES.app.dashboard): boolean {
  const router = useRouter();
  const isGestor = useIsGestor();
  const jaRedirecionou = useRef(false);

  useEffect(() => {
    if (!isGestor && !jaRedirecionou.current) {
      jaRedirecionou.current = true;
      router.replace(redirectTo);
    }
  }, [isGestor, redirectTo, router]);

  return isGestor;
}
