import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@theme/index';
import { fontSize, fonts, lightColors, radius, spacing } from '@theme/tokens';
import { KCButton } from '@components/primitives/KCButton';
import { KCChip } from '@components/primitives/KCChip';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { KCIcon } from '@components/primitives/KCIcon';
import { QueryState, type QueryLike } from '@components/feedback/QueryState';
import { Skeleton } from '@components/feedback/Skeleton';
import { STRINGS } from '@constants/strings';
import { formatTime } from '@utils/date';
import { etapaRecepcaoLabel, etapaRecepcaoTone } from '@utils/etapaRecepcao';
import { minutosDeAtraso, minutosDeEspera, organizarDia } from '@utils/proximosDoDia';
import type { AgendamentoResponse } from '../../types/api';

// BR-CLI-T06 -- bloco "qual e o proximo?" do dashboard. Le a MESMA agenda do dia da tela Hoje
// (`useAgendaHoje`); so LE: Chegou/Faltou/Remarcar continuam na Hoje (ruling B-16). Cores so por token;
// o destaque usa `textSoft` (nunca `textMuteInk`, que sobre `primaryPale` da 4.24 no claro).

export interface MarcaAgoraProps {
  hora: string;
  testID?: string;
}

/** Linha fina "AGORA 12:00" entre o que ja passou e o que ainda vem (amberInk: texto 4.70+ nos 2 temas). */
export function MarcaAgora({ hora, testID = 'marca-agora' }: MarcaAgoraProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.marca} testID={testID} accessible accessibilityLabel={`Agora, ${hora}`}>
      <View style={styles.marcaLinha} />
      <Text style={styles.marcaTexto}>
        {STRINGS.dashboard.agora} {hora}
      </Text>
      <View style={[styles.marcaLinha, styles.marcaLinhaLonga]} />
    </View>
  );
}

function FotoPet({ a, tamanho }: { a: AgendamentoResponse; tamanho: number }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [quebrada, setQuebrada] = React.useState(false);
  const mostrar = Boolean(a.dsFotoThumbUrl) && !quebrada;
  return (
    <View style={[styles.foto, { width: tamanho, height: tamanho, borderRadius: tamanho / 2 }]}>
      {mostrar && a.dsFotoThumbUrl ? (
        <Image
          source={{ uri: a.dsFotoThumbUrl }}
          style={{ width: tamanho, height: tamanho }}
          accessibilityLabel={`Foto de ${a.pet.nmPet}`}
          onError={() => setQuebrada(true)}
        />
      ) : (
        <KCIcon name="paw" size={Math.round(tamanho / 2)} color={colors.textSoft} />
      )}
    </View>
  );
}

export interface ProximosDoDiaProps {
  query: QueryLike<AgendamentoResponse[]>;
  agora: Date;
  /** Quantas linhas de "Seguintes de hoje" cabem (4 no celular, 6 na tela larga). */
  limite: number;
  /** Tela larga: nome do pet maior. */
  largo?: boolean;
  onAbrirProntuario: (a: AgendamentoResponse) => void;
  onVerTodos: () => void;
}

export function ProximosDoDia({ query, agora, limite, largo, onAbrirProntuario, onVerTodos }: ProximosDoDiaProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <QueryState
      query={query}
      skeleton={<Skeleton variant="list" count={3} />}
      empty={
        <KCEmptyState
          icon="agenda"
          title={STRINGS.dashboard.semAtendimentosHoje}
          description={STRINGS.dashboard.semAtendimentosHojeDesc}
          testID="empty-appointments"
        />
      }
      errorTitle="Não foi possível carregar os atendimentos"
    >
      {(lista) => {
        const dia = organizarDia(lista, agora);
        const visiveis = dia.seguintes.slice(0, limite);
        const marca = dia.marcaAgora !== null && dia.marcaAgora <= visiveis.length ? dia.marcaAgora : null;
        const horaAgora = formatTime(agora);
        const semAtivos = dia.proximo === null && dia.emAtendimento.length === 0;

        if (semAtivos) {
          return (
            <View>
              <KCEmptyState
                icon="check"
                title={STRINGS.dashboard.nadaMaisHoje}
                description={STRINGS.dashboard.nadaMaisHojeDesc(dia.encerrados)}
                testID="empty-fim-do-dia"
              />
              <KCButton variant="ghost" size="sm" onPress={onVerTodos} testID="btn-ver-todos-hoje" style={styles.verTodos}>
                {STRINGS.dashboard.verTodosHoje}
              </KCButton>
            </View>
          );
        }

        return (
          <View>
            {dia.emAtendimento.length > 0 && (
              <View style={styles.faixa} testID="em-atendimento">
                {dia.emAtendimento.map((a) => (
                  <View key={a.id} style={styles.faixaItem} testID={`em-atendimento-${a.id}`}>
                    <KCChip tone="sage" dot>
                      {etapaRecepcaoLabel('EM_ATENDIMENTO')}
                    </KCChip>
                    <Text style={styles.faixaTexto}>
                      <Text style={styles.faixaPet}>{a.pet.nmPet}</Text>
                      {`, ${a.tutor.nmTutor}`}
                      {a.dtInicioAtendimento ? (
                        <>
                          {', desde '}
                          <Text style={styles.mono}>{formatTime(a.dtInicioAtendimento)}</Text>
                        </>
                      ) : null}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {dia.proximo && (
              <Destaque
                a={dia.proximo}
                agora={agora}
                largo={Boolean(largo)}
                onAbrirProntuario={onAbrirProntuario}
              />
            )}

            {visiveis.length > 0 && (
              <View style={styles.secao}>
                <View style={styles.secaoCabecalho}>
                  <Text style={styles.secaoTitulo} accessibilityRole="header">
                    {STRINGS.dashboard.seguintesDeHoje}
                  </Text>
                  <Text style={styles.secaoContagem} testID="seguintes-contagem">
                    {dia.seguintes.length}
                  </Text>
                </View>
                {visiveis.map((a, i) => (
                  <React.Fragment key={a.id}>
                    {marca === i && <MarcaAgora hora={horaAgora} />}
                    <LinhaSeguinte a={a} agora={agora} />
                  </React.Fragment>
                ))}
                {marca === visiveis.length && <MarcaAgora hora={horaAgora} />}
              </View>
            )}

            <KCButton variant="ghost" size="sm" onPress={onVerTodos} testID="btn-ver-todos-hoje" style={styles.verTodos}>
              {STRINGS.dashboard.verTodosHoje}
            </KCButton>
          </View>
        );
      }}
    </QueryState>
  );
}

function Destaque({
  a,
  agora,
  largo,
  onAbrirProntuario,
}: {
  a: AgendamentoResponse;
  agora: Date;
  largo: boolean;
  onAbrirProntuario: (a: AgendamentoResponse) => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const etapa = a.dsEtapaRecepcao;
  const espera = minutosDeEspera(a, agora);
  const atraso = minutosDeAtraso(a, agora);
  const temPet = Boolean(a.pet?.id);
  return (
    <View style={styles.destaque} testID="proximo-atendimento">
      <View style={styles.destaqueTopo}>
        <View style={styles.kickerLinha}>
          <View style={styles.kickerTraco} />
          <Text style={styles.kicker}>{STRINGS.dashboard.proximoKicker}</Text>
        </View>
        <Text style={styles.destaqueHora} testID="proximo-hora">
          {formatTime(a.dtInicio)}
        </Text>
      </View>
      <View style={styles.destaquePetLinha}>
        <FotoPet a={a} tamanho={largo ? 44 : 48} />
        <Text style={[styles.destaquePet, largo && styles.destaquePetLargo]} testID="proximo-pet">
          {a.pet.nmPet}
        </Text>
      </View>
      <Text style={styles.destaqueTutor}>{a.tutor.nmTutor}</Text>
      {a.nmTipoConsulta ? <Text style={styles.destaqueServico}>{a.nmTipoConsulta}</Text> : null}
      <View style={styles.destaqueEtapaLinha}>
        <KCChip tone={etapaRecepcaoTone(etapa)} dot testID="proximo-etapa">
          {etapaRecepcaoLabel(etapa)}
        </KCChip>
        {espera !== null && (
          <Text style={styles.destaqueTextoSuave} testID="proximo-espera">
            {STRINGS.dashboard.esperandoHa(espera)}
          </Text>
        )}
        {atraso !== null && (
          <Text style={styles.destaqueTextoSuave} testID="proximo-atraso">
            {STRINGS.dashboard.minDeAtraso(atraso)}
          </Text>
        )}
      </View>
      <KCButton
        variant="primary"
        size="md"
        onPress={() => temPet && onAbrirProntuario(a)}
        disabled={!temPet}
        testID="btn-abrir-prontuario-proximo"
        accessibilityLabel={`Abrir prontuário de ${a.pet.nmPet}`}
        style={styles.destaqueBotao}
      >
        {STRINGS.dashboard.abrirProntuario}
      </KCButton>
    </View>
  );
}

function LinhaSeguinte({ a, agora }: { a: AgendamentoResponse; agora: Date }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const atraso = minutosDeAtraso(a, agora);
  const sub = [a.tutor.nmTutor, a.nmTipoConsulta].filter(Boolean).join(', ');
  return (
    <View style={styles.linha} testID={`seguinte-${a.id}`}>
      <Text style={styles.linhaHora}>{formatTime(a.dtInicio)}</Text>
      <View style={styles.linhaCentro}>
        <Text style={styles.linhaPet} numberOfLines={1}>
          {a.pet.nmPet}
        </Text>
        <Text style={styles.linhaSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={styles.linhaDireita}>
        <KCChip tone={etapaRecepcaoTone(a.dsEtapaRecepcao)} dot>
          {etapaRecepcaoLabel(a.dsEtapaRecepcao)}
        </KCChip>
        {atraso !== null && (
          <Text style={styles.linhaAtraso} testID={`atraso-${a.id}`}>
            {STRINGS.dashboard.minDeAtraso(atraso)}
          </Text>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    mono: { fontFamily: fonts.mono },
    marca: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginVertical: spacing[2] },
    marcaLinha: { width: spacing[4], height: 1, backgroundColor: colors.amberInk },
    marcaLinhaLonga: { flex: 1 },
    marcaTexto: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.amberInk },
    foto: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSunk },
    faixa: { gap: spacing[2], marginBottom: spacing[4] },
    faixaItem: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
    faixaTexto: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.text, flexShrink: 1 },
    faixaPet: { fontFamily: fonts.bodyMedium },
    // Destaque: ocean-pale + borda ocean 1px; sem barra lateral, gradiente nem sombra.
    destaque: {
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.xl,
      padding: spacing[4],
      marginBottom: spacing[5],
    },
    destaqueTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
    kickerLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 1 },
    kickerTraco: { width: spacing[4], height: 1, backgroundColor: colors.textSoft },
    kicker: { fontFamily: fonts.mono, fontSize: fontSize.xs, letterSpacing: 1.5, color: colors.textSoft },
    destaqueHora: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.text },
    destaquePetLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[3] },
    destaquePet: {
      fontFamily: fonts.display,
      fontSize: fontSize['2xl'],
      lineHeight: fontSize['2xl'] * 1.2,
      color: colors.text,
      flexShrink: 1,
    },
    destaquePetLargo: { fontSize: fontSize['3xl'], lineHeight: fontSize['3xl'] * 1.2 },
    destaqueTutor: { fontFamily: fonts.body, fontSize: fontSize.md, color: colors.textSoft, marginTop: spacing[3] },
    destaqueServico: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.textSoft, marginTop: spacing[1] },
    destaqueEtapaLinha: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[3] },
    destaqueTextoSuave: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.textSoft },
    destaqueBotao: { marginTop: spacing[4], alignSelf: 'flex-start' },
    secao: { marginBottom: spacing[2] },
    secaoCabecalho: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing[2] },
    secaoTitulo: { fontFamily: fonts.bodyMedium, fontSize: fontSize.md, color: colors.text },
    secaoContagem: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.textMuteInk },
    linha: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[4],
      paddingVertical: spacing[3],
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    linhaHora: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.text, minWidth: 44 },
    linhaCentro: { flex: 1 },
    linhaPet: { fontFamily: fonts.bodyMedium, fontSize: fontSize.base, color: colors.text },
    linhaSub: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.textMuteInk, marginTop: 2 },
    linhaDireita: { alignItems: 'flex-end', gap: spacing[1] },
    linhaAtraso: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.textMuteInk },
    verTodos: { alignSelf: 'flex-end', marginTop: spacing[2] },
  });
