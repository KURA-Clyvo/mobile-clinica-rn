// BR-CLI-T09 (BR-CLI-11): nas telas e componentes tocados pelo ciclo Branding, `fontSize` e
// `borderRadius` vêm dos tokens de `src/theme/tokens.ts` (escala do DS), nunca de número literal.
//
// A lista é FIXA, derivada em 2026-10-11 com:
//   git diff --name-only cf2bd4b..main -- 'src/app' 'src/components'   (filtrada em *.tsx)
// onde cf2bd4b = main antes do ciclo Branding. Tela nova fora da lista não é coberta de propósito
// (este gate prova o que o ciclo tocou); para ampliar, acrescente o arquivo à lista.
import fs from 'fs';
import path from 'path';

const TOCADOS = [
  'src/app/(app)/_layout.tsx',
  'src/app/(app)/agenda-novo.tsx',
  'src/app/(app)/agenda.tsx',
  'src/app/(app)/consulta/[idPet].tsx',
  'src/app/(app)/dashboard.tsx',
  'src/app/(app)/financeiro/index.tsx',
  'src/app/(app)/luna.tsx',
  'src/app/(app)/pacientes/[id].tsx',
  'src/app/(app)/pacientes/index.tsx',
  'src/app/(app)/pacientes/novo.tsx',
  'src/app/(app)/receituario/[idPet].tsx',
  'src/app/(app)/servicos-preco/index.tsx',
  'src/app/(app)/settings.tsx',
  'src/app/(app)/teleorientacao/[idPet].tsx',
  'src/app/(app)/tutores/novo.tsx',
  'src/app/(app)/usuarios/index.tsx',
  'src/app/_layout.tsx',
  'src/app/index.tsx',
  'src/app/login.tsx',
  'src/app/register.tsx',
  'src/components/brand/Abertura.tsx',
  'src/components/brand/FontesProntas.tsx',
  'src/components/brand/KuraMark.tsx',
  'src/components/domain/AgendamentoStatusMenu.tsx',
  'src/components/domain/AlertCard.tsx',
  'src/components/domain/ConviteTutorView.tsx',
  'src/components/domain/LancarCobrancaCard.tsx',
  'src/components/domain/LunaDiagnostico.tsx',
  'src/components/domain/LunaSuggestionBadge.tsx',
  'src/components/domain/MetricCard.tsx',
  'src/components/domain/OnboardingChecklist.tsx',
  'src/components/domain/PetForm.tsx',
  'src/components/domain/PetListItem.tsx',
  'src/components/domain/ProximosDoDia.tsx',
  'src/components/domain/RascunhoLuna.tsx',
  'src/components/domain/ServicoPrecoFormModal.tsx',
  'src/components/domain/TimelineItem.tsx',
  'src/components/domain/TriagemCard.tsx',
  'src/components/domain/TrocarSenhaModal.tsx',
  'src/components/domain/UsuarioClinicaFormModal.tsx',
  'src/components/domain/WhatsAppModal.tsx',
  'src/components/feedback/ConfirmHost.tsx',
  'src/components/feedback/ErrorState.tsx',
  'src/components/feedback/QueryState.tsx',
  'src/components/feedback/Skeleton.tsx',
  'src/components/feedback/Toast.tsx',
  'src/components/layout/AppHeader.tsx',
  'src/components/layout/NavDrawer.tsx',
  'src/components/primitives/KCBadge.tsx',
  'src/components/primitives/KCButton.tsx',
  'src/components/primitives/KCChip.tsx',
  'src/components/primitives/KCEmptyState.tsx',
  'src/components/primitives/KCIcon.tsx',
  'src/components/primitives/KCSwitchRow.tsx',
  'src/components/primitives/KCTextField.tsx',
];

const LITERAL = /\b(fontSize|borderRadius)\s*:\s*-?\d/;
const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const achados = (t: string) =>
  semComentarios(t)
    .split(String.fromCharCode(10))
    .map((l, i) => ({ l: l.trim(), i: i + 1 }))
    .filter(({ l }) => LITERAL.test(l));

describe('gate: tipografia e raio por token nas telas tocadas pelo ciclo', () => {
  it('o regex pega as iscas (controle positivo)', () => {
    expect(achados('a: { fontSize: 14 }')).toHaveLength(1);
    expect(achados('a: { borderRadius: 8, x: 1 }')).toHaveLength(1);
    expect(achados('a: { fontSize: fontSize.sm, borderRadius: radius.md }')).toHaveLength(0);
  });

  it('a lista existe em disco e enxerga estilos (controle)', () => {
    const comEstilo = TOCADOS.filter((f) => fs.existsSync(path.join(__dirname, '..', f)));
    expect(comEstilo).toHaveLength(TOCADOS.length);
  });

  it.each(TOCADOS.map((f) => [f]))('%s: 0 fontSize/borderRadius literais', (f) => {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    expect(achados(src)).toEqual([]);
  });
});
