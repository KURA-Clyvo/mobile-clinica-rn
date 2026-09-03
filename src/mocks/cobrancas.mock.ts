import type { InternalAxiosRequestConfig } from 'axios';
import type { CobrancaCreateRequest, CobrancaResponse } from '../types/api';
import { buscarPorId as buscarServicoPorId } from './servicos-preco.mock';

// FM-06 -- fixture do POST de CobrancasController (só essa rota entra
// aqui, ver cobrancas.service.ts -- os 2 GET são SomenteGestor e não têm
// caminho de UI nesta task). Shape CRU do backend (CobrancaResponseDto),
// sem tradução -- mesmo padrão de servicos-preco.mock.ts/usuarios-clinica.
// mock.ts. Regra do repo (TASK-65/FIX_5): imitar o CONTRATO do backend,
// não o shape que a UI produz.

let _cobrancaId = 5000;

function parseBody<T>(config: InternalAxiosRequestConfig): T {
  return (typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})) as T;
}

// A rota é `/eventos-clinicos/{idEventoClinico}/cobrancas` -- só ESTE id
// participa da regex desta task (não há segundo id: o mock só implementa o
// POST, sem `.../cobrancas/{id}`).
function extractIdEvento(url: string | undefined): number {
  const match = url?.match(/\/eventos-clinicos\/(\d+)\/cobrancas$/);
  return match ? Number(match[1]) : 0;
}

function rejeitar(status: number, code: string, message: string): Promise<never> {
  return Promise.reject({ status, code, message });
}

// ─── ANCORAGEM DAS REGRAS COPIADAS DO BACKEND ─────────────────────────────
//
// Este mock replica invariantes de negócio que moram em OUTRO REPOSITÓRIO.
// Cópia cross-repo sem âncora é cópia que já divergiu — só não se sabe quando
// (regra de ouro v7 deste projeto). Formato herdado de servicos-preco.mock.ts.
//
// FONTE:   backend-clinica-dotnet
// COMMIT:  94f558d  (`main`)
// CONFERIDO EM: 2026-09-03 (implementador da FM-06)
// REPRODUZIR:
//     git show 94f558d:src/Kura.Api/Controllers/CobrancasController.cs \
//       | sed -n '64,140p'
//     git show 94f558d:src/Kura.Application/Services/CobrancaService.cs \
//       | sed -n '68,74p;96,127p;177,219p'
//     git show 94f558d:src/Kura.Application/Validators/CobrancaCreateValidator.cs \
//       | sed -n '103,113p;121,144p'
//
// As regras replicadas, com a linha de cada uma:
//
//   CobrancasController.cs:64,86-100 -- [Authorize] simples no POST (não
//       SomenteGestor): veterinário e gestor lançam. Este mock não simula
//       autenticação/perfil -- quem chama `lancarCobranca()` já passou pelo
//       apiClient (Bearer do usuário logado), o mock nunca vê o token.
//   CobrancaService.cs:96-102 -- Trava de tenant nº 1: evento inexistente
//       OU de outra clínica -> 404, indistinguível de propósito.
//       ⚠️ SIMPLIFICAÇÃO DECLARADA (não é omissão silenciosa): este app não
//       mantém um STORE de eventos clínicos em modo mock (criarConsulta/
//       criarPrescricao em eventos-clinicos.mock.ts são STATELESS --
//       devolvem um id crescente sem persistir nada, ver aquele arquivo).
//       Sem um evento "de verdade" para comparar, este mock não consegue
//       replicar "evento de OUTRA clínica" nem "evento genuinamente
//       inexistente" -- só recusa a FORMA inválida (id não-positivo/NaN),
//       ver validarIdEvento() abaixo. Ver "O QUE ESTE MOCK NÃO REPLICA"
//       no fim deste bloco.
//   CobrancaService.cs:104-105,190-211 + Trava de tenant nº 2 + regra de
//   MensagemServicoIndisponivel/       disponibilidade do catálogo:
//   MensagemServicoDesativado (:68-74)   - idServicoPreco informado e NÃO
//                                           encontrado (nesta clínica) -> 422
//                                           MensagemServicoIndisponivel.
//                                         - idServicoPreco encontrado mas
//                                           DESATIVADO -> 422
//                                           MensagemServicoDesativado.
//       Resolvido aqui via servicos-preco.mock.ts::buscarPorId -- MESMA
//       store que a tela do gestor edita (ver ancoragem daquele arquivo),
//       então desativar um serviço enquanto a tela do vet está aberta
//       (a race que o brief §3.5 pede para reproduzir) tem efeito real: a
//       PRÓXIMA chamada a este mock vê o serviço já inativo.
//   CobrancaService.cs:107-121 -- Montagem da cobrança:
//       :114  IdClinica sai do "contexto", nunca do corpo (replicado como
//             constante 1, mesmo idClinica fixo que todo mock deste app
//             usa -- ver servicos-preco.mock.ts/usuarios-clinica.mock.ts,
//             não há JWT real em modo mock).
//       :117  ResolverValor (linhas 177-188) -- vlCobrado informado GANHA
//             do preço de tabela quando os dois vêm (D-2, override
//             deliberado). Sem vlCobrado, copia VlPreco do serviço NESTE
//             instante -- reativar/mudar o preço depois não reescreve a
//             cobrança já lançada (é cópia, não FK viva).
//       :118  NormalizarFormaPagamento (linhas 213-219) -- string vazia/só
//             espaço -> null; senão .trim().
//       :119  DtCobranca ausente -> "agora" no servidor (aqui, o momento em
//             que o mock roda).
//       :120  StAtiva = true sempre no lançamento.
//
// 🔴 O QUE ESTE MOCK DELIBERADAMENTE NÃO REPLICA:
//   1. CobrancaCreateValidator.cs:103-113,121-144 -- as regras de 400
//      (vlCobrado negativo/>99_999_999,99/mais de 2 casas; idServicoPreco
//      não-positivo; dsFormaPagamento >30 chars; dtCobranca fora da faixa;
//      "nem vlCobrado nem idServicoPreco" -> MensagemSemOrigemDeValor).
//      MESMA classe de decisão da FM-05 (servicos-preco.mock.ts, achado
//      A-4 da G2): isto é seguro porque LancarCobrancaCard.tsx replica as
//      regras client-side (validação ESCRITA À MÃO -- `validarValorTexto`,
//      `contarCasasDecimais`, e o gate `temOrigemDeValor`; o card NÃO usa
//      zod, ver a nota abaixo) e desabilita o botão de envio sem origem
//      de valor -- nenhum caminho de USUÁRIO alcança este mock com corpo
//      inválido. `lancarCobranca()` chamado DIRETO (teste, ou UI futura
//      sem o card) tem SUCESSO aqui onde o backend real devolveria 400 --
//      é a direção VISÍVEL da divergência (backend mais restritivo),
//      declarada em vez de replicada para não duplicar validação em 3
//      lugares (validator real, card, mock).
//
//      📌 M-3 da G2 -- uma divergência a MAIS, na direção inócua: o CLIENTE
//      é ligeiramente mais restritivo que o backend em zero à direita. O
//      validator real usa `PrecisionScale(10, 2, ignoreTrailingZeros: true)`
//      e aceitaria `45,900`; `contarCasasDecimais` conta caracteres e
//      recusa. ⇒ O usuário só não consegue digitar um zero sobrando.
//      Registrado por completude da tabela de divergências, não como
//      defeito -- cliente mais restritivo que o servidor nunca produz valor
//      errado, só atrito.
//
//      ⚠️ CORRIGIDO na fix wave da G2 (achado M-1): estas linhas diziam
//      "zod". `grep -c zod src/components/domain/LancarCobrancaCard.tsx`
//      devolve 0 -- a validação do card é escrita à mão. O que torna o
//      engano PIOR que um typo é que zod É usado neste repo, inclusive na
//      TELA QUE HOSPEDA O CARD (`consulta/[idPet].tsx`) e no
//      `ServicoPrecoFormModal.tsx` da FM-05: a afirmação era plausível, e
//      quem auditasse procurando o schema não o acharia e concluiria que a
//      validação sumiu. É a classe "documentação que garante o que o
//      código não faz", que já reprovou task neste projeto (FIX_6).
//   2. Evento de outra clínica / evento genuinamente inexistente (ver
//      SIMPLIFICAÇÃO DECLARADA acima) -- este mock não tem como saber.
//      Qualquer idEventoClinico positivo na rota é aceito.
//
// 🔴 AS TRÊS DIREÇÕES DE DIVERGÊNCIA (a 3ª acrescentada pela G2, achado M-2):
//   backend fica MAIS restritivo  -> o mock aceita, o real recusa (item 1
//        acima): falha VISÍVEL, mas só fora da demo.
//   backend fica MENOS restritivo -> o mock recusa uma operação que o real
//        permite: a ação some da demo sem erro nenhum. 🔴 É a difícil de
//        notar. NÃO identificada nesta task.
//   🆕 MESMA permissividade, VOCABULÁRIO diferente -> o mock aceita e recusa
//        exatamente o que o real aceita e recusa, mas o `code` da recusa é
//        OUTRO. É o caso desta task, e a frase que estava aqui ("este mock é
//        estritamente MAIS PERMISSIVO em toda regra que não replica")
//        afirmava uma exaustividade que ele não tem.
//
//        Medido: `git grep "SERVICO_DESATIVADO\|SERVICO_INDISPONIVEL"
//        94f558d` -> 0 linhas. O backend monta `type = ex.GetType().Name`
//        (ExceptionHandlerMiddleware.cs) e `normalizeError` (errors.ts:30)
//        faz `code: data?.code ?? data?.type` ⇒ em modo REAL o `code` dos
//        dois 422 é `RegraDeNegocioException`, e o do 404 é
//        `EntidadeNaoEncontradaException`.
//
//        ✅ Sem impacto hoje: LancarCobrancaCard ramifica por
//        `e?.status === 422`, NUNCA por `code` -- conferido pela G2.
//        ⚠️ Onde morderia: uma UI futura que ramifique por `code` funciona
//        em mock e falha em real, sem erro nenhum.
//        📌 Os `code` NÃO foram trocados de propósito: são convenção do repo
//        inteiro (`NOT_FOUND` 8x, `SEM_GESTOR_ATIVO`, `EMAIL_EM_USO`,
//        `USUARIO_DESATIVADO`, `NOME_EM_USO`, …). Mudá-los só aqui criaria
//        inconsistência nova -- o que estava errado era a FRASE, não o código.
//
// ⚠️ A mensagem de MensagemServicoIndisponivel/MensagemServicoDesativado
// abaixo é o LITERAL do backend (const string, copiado byte a byte, não
// paráfrase) -- diferente de servicos-preco.mock.ts, que usa paráfrase.
function garantirServicoAtivo(servico: {
  stAtiva: boolean;
}): Promise<never> | null {
  if (servico.stAtiva) return null;
  return rejeitar(
    422,
    'SERVICO_DESATIVADO',
    'Este serviço de preço está DESATIVADO e não pode originar novos lançamentos. ' +
      'Reative-o na tabela de preços, ou lance a cobrança com vlCobrado avulso.',
  );
}

function normalizarFormaPagamento(forma: string | null | undefined): string | null {
  if (!forma || forma.trim() === '') return null;
  return forma.trim();
}

// POST /api/v1/eventos-clinicos/{idEventoClinico}/cobrancas -- única rota
// deste mock (ver cabeçalho do arquivo).
export async function lancar(
  config: InternalAxiosRequestConfig,
): Promise<CobrancaResponse> {
  const idEventoClinico = extractIdEvento(config.url);

  // Trava de tenant nº 1 simplificada -- ver ancoragem acima
  // (SIMPLIFICAÇÃO DECLARADA): sem store de eventos em modo mock, só a
  // FORMA é validada.
  if (!Number.isInteger(idEventoClinico) || idEventoClinico <= 0) {
    return rejeitar(404, 'NOT_FOUND', `EventoClinico ${idEventoClinico} não encontrado`);
  }

  const body = parseBody<CobrancaCreateRequest>(config);

  let servico: { id: number; vlPreco: number; stAtiva: boolean } | undefined;
  if (body.idServicoPreco != null) {
    servico = buscarServicoPorId(body.idServicoPreco);
    if (!servico) {
      return rejeitar(
        422,
        'SERVICO_INDISPONIVEL',
        'Serviço de preço não encontrado nesta clínica. Confira o idServicoPreco, ou lance ' +
          'a cobrança com vlCobrado avulso.',
      );
    }
    const desativado = garantirServicoAtivo(servico);
    if (desativado) return desativado;
  }

  // ResolverValor (CobrancaService.cs:177-188) -- vlCobrado GANHA quando os
  // dois vêm; senão copia o preço do serviço NESTE instante.
  const vlCobrado = body.vlCobrado ?? servico?.vlPreco ?? 0;

  const nova: CobrancaResponse = {
    id: ++_cobrancaId,
    idEventoClinico,
    idClinica: 1,
    idServicoPreco: servico?.id ?? null,
    vlCobrado,
    dsFormaPagamento: normalizarFormaPagamento(body.dsFormaPagamento),
    dtCobranca: body.dtCobranca ?? new Date().toISOString(),
    stAtiva: true,
    dtCriacao: new Date().toISOString(),
    dtAtualizacao: null,
  };

  return nova;
}
