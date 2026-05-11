import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { usePetDetail } from '@hooks/usePetDetail';
import { usePetTimeline } from '@hooks/usePetTimeline';
import { KCPetPortrait } from '@components/primitives/KCPetPortrait';
import { KCChip } from '@components/primitives/KCChip';
import { KCCard } from '@components/primitives/KCCard';
import { KCButton } from '@components/primitives/KCButton';
import { KCIcon } from '@components/primitives/KCIcon';
import { racaToPalette } from '@utils/mappers';
import { calcularIdade, formatDateShort } from '@utils/date';
import { STRINGS } from '@constants/strings';
import { ROUTES } from '@constants/routes';
import type { TimelineEventResponse } from '../../../types/api';

type TabKey = 'timeline' | 'vacinas' | 'docs';

const PORTE_LABEL: Record<string, string> = {
  P: 'Pequeno',
  M: 'Médio',
  G: 'Grande',
  GG: 'Extra Grande',
};

const TIPO_MAP: Record<
  TimelineEventResponse['nmTipo'],
  { label: string; iconName: 'consult' | 'check' | 'rx' | 'alert' | 'tele'; bgKey: keyof typeof lightColors; colorKey: keyof typeof lightColors }
> = {
  CONSULTA:       { label: 'Consulta',       iconName: 'consult', bgKey: 'primaryPale', colorKey: 'primary' },
  VACINA:         { label: 'Vacinação',       iconName: 'check',   bgKey: 'successBg',  colorKey: 'success' },
  PRESCRICAO:     { label: 'Prescrição',      iconName: 'rx',      bgKey: 'infoBg',     colorKey: 'info' },
  EXAME:          { label: 'Exame',           iconName: 'alert',   bgKey: 'warningBg',  colorKey: 'warning' },
  TELEORIENTACAO: { label: 'Teleorientação',  iconName: 'tele',    bgKey: 'sagePale',   colorKey: 'sage' },
};

function TimelineItemRow({
  evento,
  isLast,
  colors,
}: {
  evento: TimelineEventResponse;
  isLast: boolean;
  colors: typeof lightColors;
}) {
  const [expanded, setExpanded] = useState(false);
  const { label, iconName, bgKey, colorKey } = TIPO_MAP[evento.nmTipo];
  const bg = colors[bgKey] as string;
  const color = colors[colorKey] as string;

  return (
    <View style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16 }}>
      <View style={{ width: 40, alignItems: 'center' }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <KCIcon name={iconName} size={18} color={color} />
        </View>
        {!isLast && (
          <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 }} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text }}>{label}</Text>
          <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute }}>
            {formatDateShort(evento.dtEvento)}
          </Text>
        </View>
        <Text
          style={{ fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.textSoft }}
          numberOfLines={expanded ? undefined : 2}
        >
          {evento.dsObservacao}
        </Text>
        <TouchableOpacity onPress={() => setExpanded((v) => !v)}>
          <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.primary, marginTop: 2 }}>
            {expanded ? 'Ver menos' : 'Ver mais'}
          </Text>
        </TouchableOpacity>
        {evento.nmVeterinario ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <KCIcon name="consult" size={12} color={colors.textMute} />
            <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute }}>
              {evento.nmVeterinario}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TimelineTab({ id, colors }: { id: number; colors: typeof lightColors }) {
  const { data = [], isLoading } = usePetTimeline(id);

  if (isLoading) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        {[1, 2, 3].map((k) => (
          <View key={k} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSunk, opacity: 0.4 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ height: 14, backgroundColor: colors.bgSunk, borderRadius: 6, opacity: 0.4 }} />
              <View style={{ height: 12, width: '60%', backgroundColor: colors.bgSunk, borderRadius: 6, opacity: 0.4 }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}>
        <KCIcon name="paw" size={40} color={colors.textMute} />
        <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 15, color: colors.textMute }}>
          Nenhum evento registrado
        </Text>
      </View>
    );
  }

  return (
    <View>
      {data.map((evento, index) => (
        <TimelineItemRow
          key={evento.idEventoClinico}
          evento={evento}
          isLast={index === data.length - 1}
          colors={colors}
        />
      ))}
    </View>
  );
}

function StubTab({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 40 }}>
      <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 15, color: colors.textMute }}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    header: {
      backgroundColor: colors.primary,
      alignItems: 'center',
      paddingBottom: 24,
      paddingHorizontal: 16,
    },
    petName: {
      fontFamily: 'Cormorant_500Medium',
      fontSize: 20,
      color: colors.textOnPrimary,
      marginTop: 12,
    },
    petSubtitle: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.textOnPrimary,
      opacity: 0.8,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    actionRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      flexWrap: 'wrap',
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.bgElev,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.textMute,
    },
    tabTextActive: {
      fontFamily: 'Lexend_500Medium',
      color: colors.primary,
    },
    skeletonCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.bgSunk,
      opacity: 0.4,
    },
    skeletonText: {
      height: 14,
      borderRadius: 6,
      backgroundColor: colors.bgSunk,
      opacity: 0.4,
    },
    errorCard: {
      margin: 16,
      alignItems: 'center',
      gap: 12,
    },
    errorText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.text,
    },
  });

export default function PacienteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const petId = id ? parseInt(id, 10) : null;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('timeline');

  const { data: pet, isLoading, isError } = usePetDetail(petId);

  if (isLoading) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} testID="loading-skeleton">
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.skeletonCircle} />
          <View style={[styles.skeletonText, { width: 120, marginTop: 12 }]} />
          <View style={[styles.skeletonText, { width: 80, marginTop: 6 }]} />
        </View>
        <View style={styles.actionRow}>
          {[1, 2, 3].map((k) => (
            <View key={k} style={[styles.skeletonText, { width: 80, height: 36, borderRadius: 10 }]} />
          ))}
        </View>
        <KCCard style={{ margin: 16 }}>
          <View style={[styles.skeletonText, { width: '70%', marginBottom: 8 }]} />
          <View style={[styles.skeletonText, { width: '50%' }]} />
        </KCCard>
      </ScrollView>
    );
  }

  if (isError || !pet) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <KCCard style={styles.errorCard}>
          <KCIcon name="alert" size={40} color={colors.danger} />
          <Text style={styles.errorText}>Paciente não encontrado</Text>
          <KCButton variant="secondary" size="sm" onPress={() => router.back()}>
            {STRINGS.acoes.voltar}
          </KCButton>
        </KCCard>
      </View>
    );
  }

  const handleCopyPhone = async (phone: string) => {
    await Clipboard.setStringAsync(phone);
    Alert.alert('', 'Telefone copiado');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} testID="pet-detail-scroll">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <KCPetPortrait palette={racaToPalette(pet.nmRaca)} size={96} ring />
        <Text style={styles.petName}>{pet.nmPet}</Text>
        <Text style={styles.petSubtitle}>{`${pet.nmRaca} · ${pet.nmEspecie}`}</Text>
        <View style={styles.chipRow}>
          <KCChip tone="ocean">{calcularIdade(pet.dtNascimento)}</KCChip>
          <KCChip tone="ocean">{pet.sgSexo === 'M' ? 'Macho' : 'Fêmea'}</KCChip>
          <KCChip tone="ocean">{PORTE_LABEL[pet.sgPorte] ?? pet.sgPorte}</KCChip>
        </View>
      </View>

      {/* Botões de ação */}
      <View style={styles.actionRow}>
        <KCButton
          variant="primary"
          size="sm"
          disabled={!pet}
          onPress={() => router.push(ROUTES.app.consulta(pet.id))}
          testID="btn-consulta"
        >
          Consulta
        </KCButton>
        <KCButton
          variant="secondary"
          size="sm"
          disabled={!pet}
          onPress={() => router.push(ROUTES.app.teleorientacao(pet.id))}
          testID="btn-tele"
        >
          Teleorient.
        </KCButton>
        <KCButton
          variant="secondary"
          size="sm"
          disabled={!pet}
          onPress={() => router.push(ROUTES.app.receituario(pet.id))}
          testID="btn-rx"
        >
          Receituário
        </KCButton>
      </View>

      {/* Tutores */}
      <KCCard style={{ marginHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <KCIcon name="patients" size={16} color={colors.textMute} />
          <Text style={{ fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text }}>
            Tutores
          </Text>
        </View>
        {pet.tutores.length === 0 ? (
          <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.textMute }}>
            {STRINGS.PACIENTES.NO_TUTOR}
          </Text>
        ) : (
          pet.tutores.map((tutor, idx) => (
            <View
              key={tutor.id}
              style={{
                flexDirection: 'row',
                paddingVertical: 10,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: colors.border,
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text }}>
                  {tutor.nmTutor}
                </Text>
                <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute }}>
                  {tutor.dsEmail}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCopyPhone(tutor.dsTelefone)}
                testID={`copy-phone-${tutor.id}`}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <KCIcon name="share" size={14} color={colors.primary} />
                  <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.primary }}>
                    {tutor.dsTelefone}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          ))
        )}
      </KCCard>

      {/* Tabs */}
      <View style={[styles.tabBar, { marginTop: 16 }]}>
        {(['timeline', 'vacinas', 'docs'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            testID={`tab-${tab}`}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'timeline' ? STRINGS.pacientes.timeline : tab === 'vacinas' ? STRINGS.pacientes.vacinas : STRINGS.pacientes.documentos}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ paddingBottom: 40 }}>
        {activeTab === 'timeline' && <TimelineTab id={pet.id} colors={colors} />}
        {activeTab === 'vacinas' && <StubTab label="Vacinas em breve" />}
        {activeTab === 'docs' && <StubTab label="Documentos em breve" />}
      </View>
    </ScrollView>
  );
}
