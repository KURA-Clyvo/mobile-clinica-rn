// BR-CLI-T02 — coletor de feedback para testes de tela. Substitui o antigo
// `jest.spyOn(Alert, 'alert')`: registra um "host" falso que responde na hora e grava cada
// chamada de confirmar/avisar/escolher/toast, para as asserções dos testes de tela continuarem
// tão específicas quanto eram (título, mensagem, verbo).
import { registrarHost } from '../src/components/feedback/confirmar';
import { registrarOuvinteToast, type OpcoesToast } from '../src/components/feedback/Toast';

export type RespostasFeedback = { confirmar?: boolean; escolher?: string | null };

export function simularFeedback(respostas: RespostasFeedback = {}) {
  const avisos: { titulo: string; mensagem?: string }[] = [];
  const confirmacoes: { titulo: string; mensagem?: string; verbo: string; destrutivo?: boolean; rotuloCancelar?: string }[] = [];
  const escolhas: { titulo: string; mensagem?: string; opcoes: { id: string; rotulo: string }[] }[] = [];
  const toasts: OpcoesToast[] = [];
  const estado = { ...respostas };
  const desHost = registrarHost((p) => {
    if (p.tipo === 'avisar') {
      avisos.push({ titulo: p.titulo, mensagem: p.mensagem });
      p.resolver();
    } else if (p.tipo === 'confirmar') {
      confirmacoes.push({ titulo: p.titulo, mensagem: p.mensagem, verbo: p.verbo, destrutivo: p.destrutivo, rotuloCancelar: p.rotuloCancelar });
      p.resolver(estado.confirmar ?? false);
    } else {
      escolhas.push({ titulo: p.titulo, mensagem: p.mensagem, opcoes: p.opcoes });
      p.resolver(estado.escolher ?? null);
    }
  });
  const desToast = registrarOuvinteToast((t) => toasts.push(t));
  return {
    avisos,
    confirmacoes,
    escolhas,
    toasts,
    responder: (r: RespostasFeedback) => Object.assign(estado, r),
    dispose: () => {
      desHost();
      desToast();
    },
  };
}
