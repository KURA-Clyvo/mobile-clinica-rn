import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCCard } from '@components/primitives/KCCard';
import { KCChip } from '@components/primitives/KCChip';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { useServicosPreco } from '@hooks/useServicosPreco';
import { useLancarCobranca } from '@hooks/useCobrancas';
import { formatarMoeda } from '@utils/moeda';
import type { ServicoPrecoResponse, ApiError, CobrancaResponse } from '../../types/api';

// FM-06 (ciclo FIN) — o lançamento cabe DENTRO do gesto de fechar o
// atendimento (brief §1): OPCIONAL, sem obrigar o veterinário a preencher
// nada, sem parar o fluxo. Renderizado só na FASE DEPOIS de
// consulta/[idPet].tsx (idEventoClinico já existe) — ver comentário lá.
//
// 🔴 SEM refetch/lista pós-lançamento — decisão de desenho, não esquecimento
// (brief §3.2): os 2 GET de CobrancasController são `SomenteGestor`, e um
// VETERINARIO puro (papel que a FM-02 passou a criar) levaria 403 ao tentar
// reler as cobranças que acabou de lançar. A confirmação é LOCAL: o próprio
// CobrancaResponseDto que o POST devolve, guardado em `ultimoLancamento`.
// "Lançar outra cobrança" reabre o formulário limpo — nunca uma consulta ao
// servidor.
//
// Corpo mínimo do gesto desenhado (brief §3.3): tocar um serviço da lista
// já é suficiente para habilitar "Lançar cobrança" — o valor é copiado do
// preço de tabela no servidor (CobrancaService.cs:177-183, ResolverValor),
// sem digitação. O campo "Valor" abaixo é um OVERRIDE opcional (desconto de
// balcão, ou valor avulso sem nenhum serviço selecionado).
export interface LancarCobrancaCardProps {
  idEventoClinico: number;
}

// Mesmo padrão de ServicoPrecoFormModal.tsx (FM-05): preço digitado como
// TEXTO (vírgula OU ponto), convertido para `number` só na hora de montar o
// corpo. Replica em código, para feedback imediato, as regras de 400 de
// CobrancaCreateValidator.cs (linhas 121-144, backend-clinica-dotnet @
// 94f558d) que dizem respeito a `vlCobrado`/`dsFormaPagamento` — o backend
// continua sendo a autoridade, isto é só UX.
const VALOR_MAXIMO = 99_999_999.99;
const FORMA_PAGAMENTO_MAX_CHARS = 30;

// Sugestões de meio de pagamento — NÃO é lista fechada (D-1/V18, ver
// ancoragem em cobrancas.mock.ts): DS_FORMA_PAGAMENTO é VARCHAR2(30) sem
// CHECK no banco, de propósito. As chips só PREENCHEM o campo de texto
// livre abaixo; o veterinário pode digitar qualquer outra coisa (ou nada).
const SUGESTOES_FORMA_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão', 'Convênio'];

function contarCasasDecimais(valorTexto: string): number {
  const normalizado = valorTexto.trim().replace(',', '.');
  const idx = normalizado.indexOf('.');
  return idx === -1 ? 0 : normalizado.length - idx - 1;
}

function paraNumero(valorTexto: string): number {
  return Number(valorTexto.trim().replace(',', '.'));
}

// Validação client-side do OVERRIDE de valor. Campo vazio é sempre válido
// (a ausência é o "use o preço do serviço" ou, sem serviço, cai na regra de
// combinação abaixo). `null` = inválido (mensagem devolvida), `undefined` =
// vazio (não participa da regra de origem).
function validarValorTexto(valorTexto: string): string | null {
  const t = valorTexto.trim();
  if (t === '') return null;
  const n = paraNumero(t);
  if (Number.isNaN(n)) return 'Informe um número válido';
  if (n < 0) return 'Valor não pode ser negativo';
  if (n > VALOR_MAXIMO) return `Valor deve ser no máximo ${VALOR_MAXIMO}`;
  if (contarCasasDecimais(t) > 2) {
    // M-4 da G2: `2.500` (dois mil e quinhentos, com separador de milhar) é
    // barrado — o que é CORRETO, porque `paraNumero` só aceita vírgula como
    // separador decimal, e aceitar o ponto aqui tornaria `2.500` ambíguo
    // entre 2500 e 2,5. Mas a mensagem genérica não descreve o problema DO
    // USUÁRIO: ele digitou um valor que considera válido e não sabe o que
    // corrigir.
    //
    // ⚠️ O valor nunca sai errado — esta é a direção SEGURA da falha, e é
    // por isso que é UX, não dinheiro. Mas num campo de dinheiro a diferença
    // entre "recusado com instrução" e "recusado sem instrução" é a
    // diferença entre o veterinário corrigir e o veterinário desistir de
    // lançar — e receita não lançada é receita que a FD-11 não encontra.
    if (/^\d+\.\d{3}$/.test(t)) return 'Use vírgula para os centavos (ex.: 2500,00)';
    return 'Valor deve ter no máximo 2 casas decimais';
  }
  return null;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    card: { marginTop: 16, gap: 12 },
    titulo: { fontFamily: 'Lexend_500Medium', fontSize: 14, color: colors.text },
    subtitulo: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    precoServicoSelecionado: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
    },
    erroTexto: { fontFamily: 'Lexend_400Regular', fontSize: 11, color: colors.danger },
    confirmacaoBox: {
      backgroundColor: colors.sagePale,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    confirmacaoTexto: { fontFamily: 'Lexend_500Medium', fontSize: 13, color: colors.sage },
    confirmacaoDetalhe: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute },
  });

function ResumoConfirmacao({
  cobranca,
  onLancarOutra,
}: {
  cobranca: CobrancaResponse;
  onLancarOutra: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.confirmacaoBox} testID="cobranca-confirmacao">
      <Text style={styles.confirmacaoTexto}>
        Cobrança de {formatarMoeda(cobranca.vlCobrado)} lançada
      </Text>
      {cobranca.dsFormaPagamento && (
        <Text style={styles.confirmacaoDetalhe}>Forma: {cobranca.dsFormaPagamento}</Text>
      )}
      <KCButton
        variant="ghost"
        size="sm"
        onPress={onLancarOutra}
        testID="btn-lancar-outra-cobranca"
      >
        Lançar outra cobrança
      </KCButton>
    </View>
  );
}

export function LancarCobrancaCard({ idEventoClinico }: LancarCobrancaCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const qc = useQueryClient();

  // Só ATIVOS (default do backend, ServicoPrecoRepository.cs:24-30) — mesmo
  // seletor que a ancoragem do brief (§2) descreve: "o seletor só oferece
  // ativos". A race declarada em CobrancaService.cs:207-208 (gestor
  // desativa enquanto esta tela está aberta) continua possível — é
  // resolvida no onError abaixo, não aqui.
  const { data: servicos } = useServicosPreco(false);
  const { mutate: lancar, isPending } = useLancarCobranca();

  const [servicoSelecionadoId, setServicoSelecionadoId] = useState<number | null>(null);
  const [valorTexto, setValorTexto] = useState('');
  const [formaTexto, setFormaTexto] = useState('');
  const [ultimoLancamento, setUltimoLancamento] = useState<CobrancaResponse | null>(null);

  const servicoSelecionado: ServicoPrecoResponse | undefined = servicos?.find(
    (s) => s.id === servicoSelecionadoId,
  );

  const erroValor = validarValorTexto(valorTexto);
  const erroForma =
    formaTexto.trim().length > FORMA_PAGAMENTO_MAX_CHARS
      ? `Forma de pagamento deve ter no máximo ${FORMA_PAGAMENTO_MAX_CHARS} caracteres`
      : null;

  // Regra de combinação de CobrancaCreateValidator.cs:121-123
  // (MensagemSemOrigemDeValor): sem serviço selecionado E sem valor válido
  // digitado, não há origem de valor — o botão fica desabilitado em vez de
  // deixar o veterinário descobrir isso só depois do 400.
  const temOrigemDeValor = servicoSelecionadoId != null || (valorTexto.trim() !== '' && erroValor === null);
  const podeEnviar = temOrigemDeValor && erroValor === null && erroForma === null && !isPending;

  function limparFormulario() {
    setServicoSelecionadoId(null);
    setValorTexto('');
    setFormaTexto('');
  }

  function handleSelecionarServico(id: number) {
    setServicoSelecionadoId((atual) => (atual === id ? null : id));
  }

  function handleSelecionarForma(sugestao: string) {
    setFormaTexto((atual) => (atual === sugestao ? '' : sugestao));
  }

  function handleLancar() {
    if (!podeEnviar) return;
    lancar(
      {
        idEventoClinico,
        req: {
          idServicoPreco: servicoSelecionadoId ?? undefined,
          vlCobrado: valorTexto.trim() !== '' ? paraNumero(valorTexto) : undefined,
          dsFormaPagamento: formaTexto.trim() !== '' ? formaTexto.trim() : undefined,
          // dtCobranca OMITIDO de propósito — servidor usa DateTime.UtcNow
          // (CobrancaService.cs:119). Expor um seletor de data neste card
          // contrariaria o princípio do ciclo ("subproduto do fluxo, nunca
          // trabalho extra") para o caso comum; o backend já aceita data
          // retroativa se um dia isto precisar de um campo (fora de escopo
          // desta task).
        },
      },
      {
        onSuccess: (result) => {
          setUltimoLancamento(result);
          limparFormulario();
        },
        onError: (err: unknown) => {
          const e = err as ApiError;
          Alert.alert('Erro', e?.message ?? 'Não foi possível lançar a cobrança');
          // 422 SERVICO_DESATIVADO -- a race declarada no brief §3.5 (o
          // gestor desativou o serviço enquanto esta tela estava aberta).
          // Invalida a lista para o chip sumir na próxima leitura (o
          // serviço desativado não aparece mais em incluirInativos=false)
          // em vez de deixar o veterinário tentar de novo contra o mesmo
          // chip e levar o mesmo 422 de novo.
          if (e?.status === 422) {
            qc.invalidateQueries({ queryKey: ['servicos-preco'] });
            setServicoSelecionadoId(null);
          }
        },
      },
    );
  }

  return (
    <KCCard testID="card-lancar-cobranca" style={styles.card}>
      <Text style={styles.titulo}>Cobrança (opcional)</Text>

      {ultimoLancamento ? (
        <ResumoConfirmacao
          cobranca={ultimoLancamento}
          onLancarOutra={() => setUltimoLancamento(null)}
        />
      ) : (
        <>
          <Text style={styles.subtitulo}>
            Toque um serviço para lançar pelo preço de tabela, ou informe um valor avulso abaixo.
          </Text>

          {servicos && servicos.length > 0 && (
            <View style={styles.chipsRow} testID="lista-servicos-cobranca">
              {servicos.map((s) => (
                <KCChip
                  key={s.id}
                  tone={servicoSelecionadoId === s.id ? 'sage' : 'mute'}
                  onPress={() => handleSelecionarServico(s.id)}
                  testID={`chip-servico-${s.id}`}
                >
                  {s.nmServico} · {formatarMoeda(s.vlPreco)}
                </KCChip>
              ))}
            </View>
          )}

          <KCTextField
            label={
              servicoSelecionado
                ? `Valor (R$) — em branco usa ${formatarMoeda(servicoSelecionado.vlPreco)}`
                : 'Valor avulso (R$)'
            }
            placeholder="Ex.: 150,00"
            keyboardType="decimal-pad"
            value={valorTexto}
            onChangeText={setValorTexto}
            error={erroValor ?? undefined}
            testID="input-valor-cobranca"
          />

          <View>
            <Text style={styles.subtitulo}>Forma de pagamento (opcional)</Text>
            <View style={styles.chipsRow}>
              {SUGESTOES_FORMA_PAGAMENTO.map((sugestao) => (
                <KCChip
                  key={sugestao}
                  tone={formaTexto === sugestao ? 'sage' : 'mute'}
                  onPress={() => handleSelecionarForma(sugestao)}
                  testID={`chip-forma-${sugestao}`}
                >
                  {sugestao}
                </KCChip>
              ))}
            </View>
          </View>

          <KCTextField
            label="Outra forma de pagamento"
            placeholder="Ex.: Transferência"
            value={formaTexto}
            onChangeText={setFormaTexto}
            error={erroForma ?? undefined}
            testID="input-forma-pagamento-cobranca"
          />

          <KCButton
            variant="primary"
            size="md"
            loading={isPending}
            disabled={!podeEnviar}
            onPress={handleLancar}
            testID="btn-lancar-cobranca"
          >
            Lançar cobrança
          </KCButton>
        </>
      )}
    </KCCard>
  );
}
