import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { avisar } from '@components/feedback/confirmar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useAgendaSemana, useAgendaHoje, useCheckinAgendamento, useAtualizarStatusAgendamento } from '@hooks/useAgenda';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCCard } from '@components/primitives/KCCard';
import { KCChip } from '@components/primitives/KCChip';
import { KCButton } from '@components/primitives/KCButton';
import { KCIcon } from '@components/primitives/KCIcon';
import { QueryState } from '@components/feedback/QueryState';
import { Skeleton } from '@components/feedback/Skeleton';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { AgendamentoStatusMenu } from '@components/domain/AgendamentoStatusMenu';
import { getTransicoesPermitidas } from '@services/agenda.service';
import { ROUTES } from '@constants/routes';
import {
  formatTime,
  formatWeekRange,
  getDayLabel,
  getDayNumber,
  getMondayOf,
  addDays,
  subDays,
  isSameDay,
  isToday,
} from '@utils/date';
import {
  etapaRecepcaoLabel,
  etapaRecepcaoTone,
  origemLabel,
  origemTone,
  origemUrgenciaLabel,
  minutosEsperando,
  podeRegistrarChegada,
  podeMarcarFalta,
} from '@utils/etapaRecepcao';
import { seloRespostaTutor, podeOferecerRemarcar } from '@utils/respostaConfirmacao';
import { STRINGS } from '@constants/strings';
import type { AgendamentoResponse } from '../../types/api';
// FM-04 (revisão pós-medição do maestro): statusTone/statusLabel eram locais
// deste arquivo e tinham uma cópia divergente em dashboard.tsx — ver
// utils/statusAgendamento.ts, fonte única compartilhada pelas duas telas.
import { statusAgendamentoTone as statusTone, statusAgendamentoLabel as statusLabel } from '@utils/statusAgendamento';

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navBtn: { padding: 4 },
    weekRange: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
    },
    dayTabsScroll: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexGrow: 0,
    },
    dayTabsContent: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 4,
    },
    dayTab: {
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      minWidth: 44,
      // CQ-08 fix wave 3 (achado I-1 da G2 rodada 2): `minWidth:44` sozinho
      // só provava o eixo largura — WCAG 2.5.5 exige 44×44, os DOIS eixos.
      // `paddingVertical:8` sobre texto pequeno não garante 44px de altura.
      minHeight: 44,
    },
    dayTabSelected: {
      backgroundColor: colors.primary,
    },
    dayLabel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 11,
      color: colors.textMuteInk,
    },
    dayLabelSelected: { color: colors.textOnPrimary },
    dayLabelToday: { color: colors.primary },
    dayNumber: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 16,
      color: colors.text,
      marginTop: 2,
    },
    dayNumberSelected: { color: colors.textOnPrimary },
    dayNumberToday: { color: colors.primary },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 3,
    },
    todayDotSelected: { backgroundColor: colors.textOnPrimary },
    list: { flex: 1 },
    listContent: {
      padding: 16,
      paddingBottom: 32,
    },
    apptCard: { marginBottom: 10 },
    apptRow: { flexDirection: 'row', gap: 12 },
    timeBlock: {
      alignItems: 'center',
      width: 44,
      flexShrink: 0,
    },
    timeText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.text,
    },
    durationText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 10,
      color: colors.textMuteInk,
      marginTop: 2,
    },
    divider: {
      width: 1,
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },
    apptContent: { flex: 1, gap: 4 },
    apptHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    petName: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    petDetail: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textSoft,
    },
    tutorText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMuteInk,
    },
    // FM-04: teleBtn e statusBtn (novo) agora moram lado a lado dentro de
    // actionsRow — o marginTop:8 saiu daqui e foi para o container, senão a
    // linha inteira duplicaria o respiro em vez de só o topo do bloco.
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    teleBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    teleBtnText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 11,
      color: colors.textOnPrimary,
    },
    // FM-04: botão "..." que abre o menu contextual de status (Ruling D-13 —
    // vive no card da agenda, não numa tela de "fechar atendimento" separada).
    // Estilo neutro (borda + surface), de propósito diferente do teleBtn
    // (primary, cor de destaque) — teleconsulta é a ação principal do card;
    // mudar status é secundária.
    statusBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    statusBtnText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 11,
      color: colors.text,
    },

    // REC-12 — modo "Hoje" (toggle + cards da recepção).
    modoToggleRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    modoBtn: {
      flex: 1,
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    modoBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    modoBtnText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 13,
      color: colors.text,
    },
    modoBtnTextActive: {
      color: colors.textOnPrimary,
    },
    hojeCard: { marginBottom: 10 },
    hojeRow: { flexDirection: 'row', gap: 12 },
    hojeFotoWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.bgSunk,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    hojeFoto: { width: 48, height: 48 },
    hojeContent: { flex: 1, gap: 4 },
    hojeHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    hojePetName: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    hojeMetaText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMuteInk,
    },
    hojeEsperaText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 12,
      color: colors.clayInk,
    },
    hojeBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    hojeActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      flexWrap: 'wrap',
    },
    hojeActionBtnPrimary: {
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    hojeActionBtnSecondary: {
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    hojeActionBtnTextPrimary: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 12,
      color: colors.textOnPrimary,
    },
    hojeActionBtnTextSecondary: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 12,
      color: colors.text,
    },
    notaOrigem: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 11,
      color: colors.textMuteInk,
      textAlign: 'center',
      paddingTop: 8,
      paddingBottom: 4,
    },

    // Fix wave G2 (m-3) — estado de erro do modo "Hoje", distinto do estado
    // vazio legítimo (KCEmptyState acima): um erro de rede não pode dizer
    // "nenhuma consulta", que é uma afirmação falsa sobre o dia.
    hojeErroContainer: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    hojeErroTitulo: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
      textAlign: 'center',
      marginTop: 12,
    },
    hojeErroDesc: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textMuteInk,
      textAlign: 'center',
      marginTop: 4,
    },
    hojeErroBtn: {
      marginTop: 16,
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    hojeErroBtnText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 13,
      color: colors.textOnPrimary,
    },
  });

// REC-12 — R5: nota fixa "origem registrada desde <data>". A data CERTA é a
// de PRODUÇÃO da REC-10 (dia em que DS_ORIGEM passa a ser escrito como
// RECEPCAO/TRIAGEM_LUNA pelo .NET, não só PORTAL pelo Java) — nunca "hoje do
// deploy" (mostraria uma data que anda sozinha a cada rebuild, sem relação
// com quando o dado passou a existir de verdade). No momento desta task,
// REC-10 ainda vive em branch (`backend-clinica-dotnet`
// `feat/rec-10-criar-agendamento`, não mesclada em `main`) — sem data real
// de produção, `null` é o valor honesto. TODO: preencher com a data de
// fechamento do ciclo REC quando a REC-18 (config da D-1 + smoke + seed)
// fechar — ver `.superpowers/sdd/KURA_BACKLOG_RECEPCAO/progress.md` no repo
// de planejamento (`dev VsClaude`) para a data exata.
const DATA_INICIO_REGISTRO_ORIGEM: string | null = null;

function notaOrigemTexto(): string {
  return DATA_INICIO_REGISTRO_ORIGEM
    ? `Origem registrada desde ${DATA_INICIO_REGISTRO_ORIGEM}`
    : 'Origem registrada desde a entrada em produção deste recurso (data a confirmar)';
}

type ModoAgenda = 'semana' | 'hoje';

interface ModoAgendaToggleProps {
  modo: ModoAgenda;
  onChange: (modo: ModoAgenda) => void;
}

// Componente-função PRÓPRIO, de propósito: `discoverInteractiveTouchables`
// (src/a11y/) chaveia touchables por NOME DE COMPONENTE, não por posição no
// arquivo. Se estes 2 botões vivessem soltos dentro de `AgendaScreen`, eles
// REBINDARIAM em silêncio as chaves `AgendaScreen#1/#2/#3` (hoje
// `btn-prev-week`/`btn-next-week`/`day-tab-*`) — exatamente o risco que o
// comentário do walker documenta. Um componente próprio preserva as chaves
// existentes intactas, ao custo de uma chave nova (`ModoAgendaToggle#1/#2`).
function ModoAgendaToggle({ modo, onChange }: ModoAgendaToggleProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.modoToggleRow}>
      <TouchableOpacity
        testID="btn-modo-semana"
        accessibilityLabel="Ver agenda da semana"
        style={[styles.modoBtn, modo === 'semana' && styles.modoBtnActive]}
        onPress={() => onChange('semana')}
      >
        <Text style={[styles.modoBtnText, modo === 'semana' && styles.modoBtnTextActive]}>
          Semana
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="btn-modo-hoje"
        accessibilityLabel="Ver agenda de hoje"
        style={[styles.modoBtn, modo === 'hoje' && styles.modoBtnActive]}
        onPress={() => onChange('hoje')}
      >
        <Text style={[styles.modoBtnText, modo === 'hoje' && styles.modoBtnTextActive]}>Hoje</Text>
      </TouchableOpacity>
    </View>
  );
}

// REC-17 — selo da resposta do tutor ao lembrete D-1 + ação "Remarcar".
// Componente-função PRÓPRIO (mesma razão de `ModoAgendaToggle`/`AgendaHojeCard`):
// compartilhado pelos DOIS cards (Hoje e Semana) e com chave própria
// `RespostaTutorSelo#1` na descoberta de touchables, sem rebindar as existentes.
function RespostaTutorSelo({ appointment: a }: { appointment: AgendamentoResponse }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const selo = seloRespostaTutor(a.dsRespostaConfirmacao);
  if (!selo) return null;
  const mostrarRemarcar = podeOferecerRemarcar(a.dsRespostaConfirmacao, a.dsEtapaRecepcao);
  return (
    <View style={styles.hojeBadgeRow}>
      <KCChip tone={selo.tone} testID={`resposta-tutor-${a.id}`}>
        {selo.label}
      </KCChip>
      {mostrarRemarcar && (
        <TouchableOpacity
          style={styles.hojeActionBtnSecondary}
          // Só `idPet`/`idTutor`: são os únicos dados do agendamento que o
          // formulário da REC-14 consome (veterinário/tipo/data ficam à escolha
          // da recepção, que vai combinar o novo horário com o tutor).
          onPress={() => router.push(ROUTES.app.agendaNovo({ idPet: a.pet.id, idTutor: a.tutor.id }))}
          testID={`btn-remarcar-${a.id}`}
          accessibilityLabel={`Remarcar consulta de ${a.pet.nmPet}`}
        >
          <Text style={styles.hojeActionBtnTextSecondary}>Remarcar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface AgendaHojeCardProps {
  appointment: AgendamentoResponse;
  onChegou: (appointment: AgendamentoResponse) => void;
  onFaltou: (appointment: AgendamentoResponse) => void;
  onAbrirProntuario: (appointment: AgendamentoResponse) => void;
  pendingId?: number;
}

// Componente-função PRÓPRIO — mesma razão de `ModoAgendaToggle` acima: os 3
// botões (Chegou/Faltou/Abrir prontuário) ganham `AgendaHojeCard#1/#2/#3`,
// sem tocar as chaves de `AgendaAppointmentCard` (modo Semana, inalterado).
function AgendaHojeCard({
  appointment: a,
  onChegou,
  onFaltou,
  onAbrirProntuario,
  pendingId,
}: AgendaHojeCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  // A-3: `a.dsEtapaRecepcao` já vem PRONTA do servidor — este componente só
  // exibe, nunca recalcula a partir de status+timestamps.
  const etapa = a.dsEtapaRecepcao;
  const mostrarChegou = podeRegistrarChegada(etapa);
  const mostrarFaltou = podeMarcarFalta(etapa, a.dtInicio);
  // A-6: tempo de espera é POR LINHA, calculado na tela a partir de
  // `dtCheckin` — nunca agregado, nunca a partir de outro relógio.
  const espera = etapa === 'CHEGOU' && a.dtCheckin ? minutosEsperando(a.dtCheckin) : null;
  const pendente = pendingId === a.id;

  // Fix wave G2 (m-9, WCAG 1.4.1): o nível de urgência da triagem entra no
  // TEXTO do selo também — a cor sozinha (2.82-2.97 de contraste, medido
  // pelo G2) não distingue ALTA de MEDIA para quem não enxerga a cor.
  const urgenciaTexto =
    a.dsOrigem === 'TRIAGEM_LUNA' ? origemUrgenciaLabel(a.dsNivelUrgenciaOrigem) : null;
  const origemTexto = urgenciaTexto
    ? `${origemLabel(a.dsOrigem)} · ${urgenciaTexto}`
    : origemLabel(a.dsOrigem);

  // Fix wave G2 (m-7): `AGENDAMENTO.ID_PET` é nullable no backend — sem
  // produtor conhecido hoje (Java e REC-10 sempre exigem pet), mas latente.
  // Sem `idPet`, "Abrir prontuário" levaria a `/consulta/0` (rota inválida) —
  // o botão fica desabilitado em vez de navegar para lugar nenhum.
  const temPet = Boolean(a.pet?.id);

  // Fix wave G2 (m-8): URL assinada da foto (FT-04) tem validade — quando
  // expira ou falha, `<Image>` sem `onError` deixava um círculo vazio
  // (`bgSunk`), sem o ícone de reserva que a ausência de foto já usa.
  const [fotoQuebrada, setFotoQuebrada] = React.useState(false);
  const mostrarFoto = Boolean(a.dsFotoThumbUrl) && !fotoQuebrada;

  return (
    <KCCard style={styles.hojeCard} testID="agenda-hoje-card">
      <View style={styles.hojeRow}>
        <View style={styles.hojeFotoWrap}>
          {mostrarFoto && a.dsFotoThumbUrl ? (
            <Image
              source={{ uri: a.dsFotoThumbUrl }}
              style={styles.hojeFoto}
              testID={`foto-pet-${a.id}`}
              accessibilityLabel={`Foto de ${a.pet.nmPet}`}
              onError={() => setFotoQuebrada(true)}
            />
          ) : (
            <View testID={`foto-pet-fallback-${a.id}`}>
              <KCIcon name="paw" size={22} color={colors.textMuteInk} />
            </View>
          )}
        </View>
        <View style={styles.hojeContent}>
          <View style={styles.hojeHeaderRow}>
            <Text style={styles.hojePetName} numberOfLines={1}>
              {a.pet.nmPet}
            </Text>
            <Text style={styles.hojeMetaText}>{formatTime(a.dtInicio)}</Text>
          </View>
          <Text style={styles.hojeMetaText} numberOfLines={1}>
            {a.tutor.nmTutor} · {a.veterinario.nmVeterinario}
          </Text>
          <View style={styles.hojeBadgeRow}>
            <KCChip tone={etapaRecepcaoTone(etapa)} testID={`etapa-${a.id}`}>
              {etapaRecepcaoLabel(etapa)}
            </KCChip>
            <KCChip
              tone={origemTone(a.dsOrigem, a.dsNivelUrgenciaOrigem)}
              testID={`origem-${a.id}`}
            >
              {origemTexto}
            </KCChip>
          </View>
          <RespostaTutorSelo appointment={a} />
          {espera !== null && (
            <Text style={styles.hojeEsperaText} testID={`espera-${a.id}`}>
              Esperando há {espera} min
            </Text>
          )}
          <View style={styles.hojeActionsRow}>
            {mostrarChegou && (
              <TouchableOpacity
                style={styles.hojeActionBtnPrimary}
                onPress={() => onChegou(a)}
                disabled={pendente}
                testID={`btn-chegou-${a.id}`}
                accessibilityLabel={`Registrar chegada de ${a.pet.nmPet}`}
              >
                <Text style={styles.hojeActionBtnTextPrimary}>Chegou</Text>
              </TouchableOpacity>
            )}
            {mostrarFaltou && (
              <TouchableOpacity
                style={styles.hojeActionBtnSecondary}
                onPress={() => onFaltou(a)}
                disabled={pendente}
                testID={`btn-faltou-${a.id}`}
                accessibilityLabel={`Registrar falta de ${a.pet.nmPet}`}
              >
                <Text style={styles.hojeActionBtnTextSecondary}>Faltou</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.hojeActionBtnSecondary, !temPet && { opacity: 0.4 }]}
              onPress={() => temPet && onAbrirProntuario(a)}
              disabled={!temPet}
              testID={`btn-abrir-prontuario-${a.id}`}
              accessibilityLabel={`Abrir prontuário de ${a.pet.nmPet}`}
              accessibilityState={{ disabled: !temPet }}
            >
              <Text style={styles.hojeActionBtnTextSecondary}>Prontuário</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KCCard>
  );
}

interface AgendaAppointmentCardProps {
  appointment: AgendamentoResponse;
  onAbrirStatusMenu: (appointment: AgendamentoResponse) => void;
}

function AgendaAppointmentCard({ appointment: a, onAbrirStatusMenu }: AgendaAppointmentCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  // FM-04 — Ruling D-13: o menu só oferece os destinos que a máquina de
  // estados permite a partir do status ATUAL (dsStatusOrigem cru, não
  // sgStatus traduzido — ver comentário em AgendamentoResponse, types/api.ts).
  // Um agendamento terminal (REALIZADO/CANCELADO/NAO_COMPARECEU) devolve []
  // aqui e o botão "..." nem aparece — é o teste "REALIZADO não oferece
  // ação nenhuma" do brief.
  const destinosDisponiveis = getTransicoesPermitidas(a.dsStatusOrigem);
  const temTeleconsulta = a.sgStatus !== 'CANCELADA';
  const temAcoesStatus = destinosDisponiveis.length > 0;

  return (
    <KCCard style={styles.apptCard} testID="agenda-appointment">
      <View style={styles.apptRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeText}>{formatTime(a.dtInicio)}</Text>
          <Text style={styles.durationText}>{a.nrDuracaoMinutos}min</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.apptContent}>
          <View style={styles.apptHeader}>
            <Text style={styles.petName} numberOfLines={1}>{a.pet.nmPet}</Text>
            <KCChip tone={statusTone(a.sgStatus)}>{statusLabel(a.sgStatus)}</KCChip>
          </View>
          {/* Separador so aparece quando ha os DOIS lados. Sem esta guarda,
              um agendamento sem especie/raca renderiza um '·' orfao numa
              linha propria — medido na demo de 2026-08-20, tela Agenda, onde
              o contrato de agendamento nao carrega dados do pet. */}
          {[a.pet.nmEspecie, a.pet.nmRaca].filter(Boolean).length > 0 && (
            <Text style={styles.petDetail} numberOfLines={1}>
              {[a.pet.nmEspecie, a.pet.nmRaca].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Text style={styles.tutorText} numberOfLines={1}>{a.tutor.nmTutor}</Text>
          <RespostaTutorSelo appointment={a} />
          {(temTeleconsulta || temAcoesStatus) && (
            <View style={styles.actionsRow}>
              {temTeleconsulta && (
                <TouchableOpacity
                  style={styles.teleBtn}
                  onPress={() => router.push(ROUTES.app.teleorientacao(a.pet.id, a.id))}
                  testID="btn-iniciar-teleconsulta"
                  accessibilityLabel="Iniciar teleconsulta"
                >
                  <KCIcon name="cam" size={12} color={colors.textOnPrimary} />
                  <Text style={styles.teleBtnText}>Teleconsulta</Text>
                </TouchableOpacity>
              )}
              {temAcoesStatus && (
                <TouchableOpacity
                  style={styles.statusBtn}
                  onPress={() => onAbrirStatusMenu(a)}
                  testID={`btn-status-menu-${a.id}`}
                  accessibilityLabel="Alterar status do agendamento"
                >
                  <KCIcon name="more" size={12} color={colors.text} />
                  <Text style={styles.statusBtnText}>Status</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </KCCard>
  );
}

export default function AgendaScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  // REC-12 — R1: modo aditivo, default 'semana' PRESERVA o comportamento
  // existente (a suíte pré-REC-12 nunca pressiona um toggle, então precisa
  // continuar vendo o modo Semana sem precisar de nenhuma ação extra).
  const [modo, setModo] = React.useState<ModoAgenda>('semana');

  // Fix wave G2 (I-1) — a tela "Hoje" fica aberta o dia todo na recepção; sem
  // isto, "Esperando há N min" e o gate de "Faltou" só recomputavam no
  // próximo re-render por outro motivo (pull-to-refresh, troca de modo) —
  // ambos são lidos de `new Date()` a cada render, então um tick que força
  // re-render já basta, sem duplicar lógica. `focado` segue o padrão já
  // estabelecido em `tutores/novo.tsx` (react-navigation v7 NÃO desmonta a
  // tela ao perder o foco — sem isto o tick continuaria rodando com a tela
  // fora de vista). O intervalo só existe quando `modo === 'hoje'` E a tela
  // está em foco — os dois viram dependência do efeito, então trocar de modo
  // ou perder foco LIMPA o intervalo (não só ignora o tick).
  const [focado, setFocado] = React.useState(true);
  useFocusEffect(
    React.useCallback(() => {
      setFocado(true);
      return () => setFocado(false);
    }, []),
  );
  const [, forcarTick] = React.useState(0);
  React.useEffect(() => {
    if (modo !== 'hoje' || !focado) return undefined;
    const intervalo = setInterval(() => forcarTick((n) => n + 1), 30_000);
    return () => clearInterval(intervalo);
  }, [modo, focado]);

  const [semanaBase, setSemanaBase] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState(() => new Date());
  // FM-04: um único menu no nível da tela (não um Modal por card) — evita
  // overlays empilhados e mantém o estado de "qual agendamento está com o
  // menu aberto" num só lugar.
  const [statusMenuAppointment, setStatusMenuAppointment] =
    React.useState<AgendamentoResponse | null>(null);

  const semanaQuery = useAgendaSemana(semanaBase);
  const { data, isLoading, semanaStart, semanaEnd, refetch } = semanaQuery;

  // REC-12 — hooks sempre chamados incondicionalmente (regra dos hooks),
  // mesmo quando `modo === 'semana'` — mesmo padrão já usado por
  // `AgendamentoStatusMenu` (sempre montado, `visible=false` quando não
  // deveria aparecer). `dataHoje` não é usado fora do modo 'hoje'.
  const {
    data: dataHoje,
    isLoading: isLoadingHoje,
    isError: isErrorHoje,
    refetch: refetchHoje,
  } = useAgendaHoje();
  const checkinMutation = useCheckinAgendamento();
  const faltouMutation = useAtualizarStatusAgendamento();
  const [pendingHojeId, setPendingHojeId] = React.useState<number | undefined>(undefined);

  const appointmentsHoje = React.useMemo(() => {
    if (!dataHoje) return [];
    return [...dataHoje].sort(
      (a, b) => new Date(a.dtInicio).getTime() - new Date(b.dtInicio).getTime(),
    );
  }, [dataHoje]);

  const [refreshingHoje, setRefreshingHoje] = React.useState(false);
  const onRefreshHoje = React.useCallback(async () => {
    setRefreshingHoje(true);
    await refetchHoje();
    setRefreshingHoje(false);
  }, [refetchHoje]);

  // m-7 (g2-rec09.md): a resposta do POST/PATCH não tem foto/urgência — a
  // mutação NUNCA usa o valor de retorno como estado da linha; `onSettled`
  // (dentro da DEFINIÇÃO do hook, useAgenda.ts) já invalida a query e o
  // refetch traz a linha completa de novo. Aqui só tratamos sucesso/erro pra
  // dar feedback.
  //
  // Fix wave G2 (m-6): trocado `mutate(vars, {onSettled, onError})` por
  // `await mutateAsync(vars)` + try/catch/finally. TanStack Query v5 só
  // resolve os callbacks passados na CHAMADA (2º argumento de `mutate`) para
  // a ÚLTIMA mutação em voo do hook — duas chamadas em sequência rápida
  // (ex.: dois toques em "Chegou" em linhas diferentes) faziam o aviso da
  // PRIMEIRA se perder silenciosamente quando a segunda ainda estava em
  // trânsito. `mutateAsync` devolve uma Promise própria POR CHAMADA: cada
  // `await`/`catch` aqui resolve com o resultado da SUA PRÓPRIA invocação,
  // sem depender de estado compartilhado do hook. `onSettled` continua só na
  // definição do hook (invalida a query nos dois casos, sempre).
  const handleChegou = async (a: AgendamentoResponse) => {
    setPendingHojeId(a.id);
    try {
      await checkinMutation.mutateAsync({ idAgendamento: a.id, nrVersion: a.nrVersion });
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 409) {
        void avisar({
          titulo: 'Agendamento desatualizado',
          mensagem: 'Este agendamento foi alterado por outro processo. A lista foi recarregada — confira o estado atual antes de tentar de novo.',
        });
      } else {
        void avisar({
          titulo: 'Não foi possível registrar a chegada',
          mensagem: apiErr.message ?? 'Tente novamente em instantes.',
        });
      }
    } finally {
      // Guarda: `pendingHojeId` é um slot único (limitação conhecida, fora
      // do escopo desta fix wave) — se outra chamada já assumiu o slot
      // enquanto esta estava em voo, não apagar o id DELA.
      setPendingHojeId((atual) => (atual === a.id ? undefined : atual));
    }
  };

  const handleFaltou = async (a: AgendamentoResponse) => {
    setPendingHojeId(a.id);
    try {
      await faltouMutation.mutateAsync({
        idAgendamento: a.id,
        dsStatus: 'NAO_COMPARECEU',
        nrVersion: a.nrVersion,
      });
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 409) {
        void avisar({
          titulo: 'Agendamento desatualizado',
          mensagem: 'Este agendamento foi alterado por outro processo. A lista foi recarregada — confira o estado atual antes de tentar de novo.',
        });
      } else {
        void avisar({
          titulo: 'Não foi possível registrar a falta',
          mensagem: apiErr.message ?? 'Tente novamente em instantes.',
        });
      }
    } finally {
      setPendingHojeId((atual) => (atual === a.id ? undefined : atual));
    }
  };

  // REC-13: a chamada real de `/inicio-atendimento` acontece dentro de
  // consulta/[idPet].tsx ao montar — aqui só a navegação, carregando
  // `idAgendamento` e `nrVersion` (o valor EM MEMÓRIA desta linha da lista,
  // não um refetch) pra tela poder chamar o endpoint com o lock otimista
  // correto.
  const handleAbrirProntuario = (a: AgendamentoResponse) => {
    router.push(ROUTES.app.consulta(a.pet.id, a.id, a.nrVersion));
  };

  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(semanaStart, i)),
    [semanaStart],
  );

  const appointmentsForDay = React.useMemo(() => {
    if (!data) return [];
    return data
      .filter((a) => isSameDay(new Date(a.dtInicio), selectedDay))
      .sort((a, b) => new Date(a.dtInicio).getTime() - new Date(b.dtInicio).getTime());
  }, [data, selectedDay]);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const goToPrevWeek = () => {
    const prev = subDays(semanaBase, 7);
    setSemanaBase(prev);
    setSelectedDay(getMondayOf(prev));
  };

  const goToNextWeek = () => {
    const next = addDays(semanaBase, 7);
    setSemanaBase(next);
    setSelectedDay(getMondayOf(next));
  };

  return (
    // CQ-15: `paddingHorizontal={0}` — agenda já controla seu próprio respiro
    // horizontal por região (weekNav, dayTabsContent, listContent), cada uma
    // com um valor diferente; deixar o ScreenContainer aplicar o padding
    // responsivo dele por cima somaria aos paddings locais em vez de
    // substituí-los. O ganho aqui é `maxContentWidth` + centralização +
    // SafeAreaView compartilhada, não o padding.
    // CQ-15 fix wave (G2 Important #2, por consistência): `style={{paddingBottom:0}}`
    // cancela o `paddingBottom:24` do modo flat, que encolheria o filho flex
    // (o `ScrollView` da lista) em 24px. Sem efeito visível aqui (mesma cor
    // de fundo), mas aplicado pela mesma razão que em `teleorientacao`, para
    // não deixar a tela dependente de o fundo ser opaco pra mascarar o corte.
    // G2 Minor #5, não corrigido: a tela usava `edges={['top']}` explícito
    // antes da migração; o ScreenContainer aplica todas as bordas por
    // padrão, então em landscape/notch lateral os insets left/right passam
    // a encolher a `weekNav` (full-bleed). Provavelmente inofensivo — a
    // primitiva agora tem a prop `edges` (ver ScreenContainer.tsx) pra
    // restaurar isso caso vire regressão visível de verdade.
    <ScreenContainer scroll={false} paddingHorizontal={0} style={{ paddingBottom: 0 }}>
      <ModoAgendaToggle modo={modo} onChange={setModo} />

      {/* REC-14 — KCButton (não TouchableOpacity cru): não acrescenta tocável novo ao
          inventário de `touchTargetRegistry.tsx` (CQ-08). Visível nos 2 modos (Semana e
          Hoje) — aditivo, mesmo cuidado que a REC-12 já teve com o resto desta tela. */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <KCButton
          variant="secondary"
          size="sm"
          onPress={() => router.push(ROUTES.app.agendaNovo())}
          testID="btn-novo-agendamento"
          accessibilityLabel={STRINGS.agenda.novoAgendamento}
        >
          {STRINGS.agenda.novoAgendamento}
        </KCButton>
      </View>

      {modo === 'semana' && (
        <>
          <View style={styles.weekNav}>
            <TouchableOpacity
              onPress={goToPrevWeek}
              testID="btn-prev-week"
              style={styles.navBtn}
              accessibilityLabel={STRINGS.agenda.semanaAnterior}
            >
              <KCIcon name="back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.weekRange} testID="week-range">
              {formatWeekRange(semanaStart, semanaEnd)}
            </Text>
            <TouchableOpacity
              onPress={goToNextWeek}
              testID="btn-next-week"
              style={styles.navBtn}
              accessibilityLabel={STRINGS.agenda.proximaSemana}
            >
              <KCIcon name="arrowR" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayTabsScroll}
            contentContainerStyle={styles.dayTabsContent}
          >
            {weekDays.map((day, i) => {
              const selected = isSameDay(day, selectedDay);
              const today = isToday(day);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedDay(day)}
                  testID={`day-tab-${i}`}
                  style={[styles.dayTab, selected && styles.dayTabSelected]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      selected && styles.dayLabelSelected,
                      today && !selected && styles.dayLabelToday,
                    ]}
                  >
                    {getDayLabel(day)}
                  </Text>
                  <Text
                    style={[
                      styles.dayNumber,
                      selected && styles.dayNumberSelected,
                      today && !selected && styles.dayNumberToday,
                    ]}
                  >
                    {getDayNumber(day)}
                  </Text>
                  {today && (
                    <View style={[styles.todayDot, selected && styles.todayDotSelected]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            <QueryState
              query={semanaQuery}
              isEmpty={() => appointmentsForDay.length === 0}
              skeleton={<Skeleton variant="list" count={4} />}
              empty={
                <KCEmptyState
                  icon="agenda"
                  title={STRINGS.agenda.semConsultas}
                  description={STRINGS.agenda.semConsultasDesc}
                  testID="empty-agenda"
                />
              }
              errorTitle="Não foi possível carregar a agenda da semana"
            >
              {() => (
                <>
                  {appointmentsForDay.map((a) => (
                    <AgendaAppointmentCard
                      key={a.id}
                      appointment={a}
                      onAbrirStatusMenu={setStatusMenuAppointment}
                    />
                  ))}
                </>
              )}
            </QueryState>
          </ScrollView>

          <AgendamentoStatusMenu
            visible={statusMenuAppointment !== null}
            onClose={() => setStatusMenuAppointment(null)}
            idAgendamento={statusMenuAppointment?.id ?? 0}
            nrVersion={statusMenuAppointment?.nrVersion ?? 0}
            dsStatusOrigem={statusMenuAppointment?.dsStatusOrigem ?? ''}
            nmPet={statusMenuAppointment?.pet.nmPet ?? ''}
          />
        </>
      )}

      {modo === 'hoje' && (
        <ScrollView
          testID="agenda-hoje-lista"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshingHoje}
              onRefresh={onRefreshHoje}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {isLoadingHoje ? (
            <Skeleton variant="list" count={4} />
          ) : isErrorHoje ? (
            // Fix wave G2 (m-3, P2): erro de rede antes disto renderizava o
            // MESMO `empty-agenda` do estado vazio legítimo — "nenhuma
            // consulta" é uma afirmação FALSA quando a chamada falhou, não
            // uma leitura correta de um dia sem agendamento. Estado próprio,
            // com ação de "tentar de novo" que dispara o mesmo refetch do
            // pull-to-refresh.
            <View style={styles.hojeErroContainer} testID="agenda-hoje-erro">
              <KCIcon name="alert" size={40} color={colors.textMuteInk} />
              <Text style={styles.hojeErroTitulo}>{STRINGS.agenda.erroHojeTitulo}</Text>
              <Text style={styles.hojeErroDesc}>{STRINGS.agenda.erroHojeDesc}</Text>
              <TouchableOpacity
                style={styles.hojeErroBtn}
                onPress={onRefreshHoje}
                testID="btn-tentar-novo-hoje"
                accessibilityRole="button"
                accessibilityLabel={STRINGS.agenda.tentarNovamente}
              >
                <Text style={styles.hojeErroBtnText}>{STRINGS.agenda.tentarNovamente}</Text>
              </TouchableOpacity>
            </View>
          ) : appointmentsHoje.length === 0 ? (
            <KCEmptyState
              icon="agenda"
              title={STRINGS.agenda.semConsultas}
              description={STRINGS.agenda.semConsultasDesc}
              testID="empty-agenda"
            />
          ) : (
            <>
              {appointmentsHoje.map((a) => (
                <AgendaHojeCard
                  key={a.id}
                  appointment={a}
                  onChegou={handleChegou}
                  onFaltou={handleFaltou}
                  onAbrirProntuario={handleAbrirProntuario}
                  pendingId={pendingHojeId}
                />
              ))}
              <Text style={styles.notaOrigem} testID="nota-origem-hoje">
                {notaOrigemTexto()}
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
