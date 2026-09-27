import {
  somenteDigitos,
  temPrefixoInternacional,
  mascararTelefone,
  paraEnvioServidor,
  paraWaMe,
  linkWhatsApp,
} from '../src/utils/telefone';

describe('telefone.ts — utilitários puros (REC-03)', () => {
  describe('somenteDigitos', () => {
    it('remove tudo que não é dígito', () => {
      expect(somenteDigitos('(11) 91234-5678')).toBe('11912345678');
    });
  });

  describe('temPrefixoInternacional', () => {
    it('detecta o + inicial, inclusive com espaço antes dele', () => {
      expect(temPrefixoInternacional('+55 11 98765-4321')).toBe(true);
      expect(temPrefixoInternacional('  +1 415 555 2671')).toBe(true);
    });
    it('CONTROLE — número nacional sem + não é internacional', () => {
      expect(temPrefixoInternacional('11987654321')).toBe(false);
      expect(temPrefixoInternacional('(11) 91234-5678')).toBe(false);
    });
  });

  describe('mascararTelefone', () => {
    it('aplica a máscara BR conforme os dígitos chegam (sem +)', () => {
      expect(mascararTelefone('1')).toBe('(1');
      expect(mascararTelefone('11912345678')).toBe('(11) 91234-5678');
      expect(mascararTelefone('1133334444')).toBe('(11) 3333-4444');
    });

    it('ignora dígitos além do 11º quando NÃO há + (nacional)', () => {
      expect(mascararTelefone('119123456789999')).toBe('(11) 91234-5678');
    });

    // G2 (I-1, Important): ANTES desta correção, `mascararTelefone` descartava o '+' e
    // truncava em 11 dígitos SEMPRE — um número estrangeiro/BR-com-DDI virava um BR
    // diferente e errado, em silêncio. Hoje, com '+', preserva o sinal e permite até 15.
    describe('com + (G2 I-1): preserva o prefixo e permite até 15 dígitos', () => {
      it('BR com + mantém os 13 dígitos (não trunca em 11)', () => {
        expect(mascararTelefone('+5511987654321')).toBe('+5511987654321');
      });
      it('estrangeiro com + preserva todos os dígitos', () => {
        expect(mascararTelefone('+14155552671')).toBe('+14155552671');
        expect(mascararTelefone('+351912345678')).toBe('+351912345678');
        expect(mascararTelefone('+442079460958')).toBe('+442079460958');
      });
      it('trunca em 15 dígitos mesmo com + (teto do E.164)', () => {
        expect(mascararTelefone(`+${'1'.repeat(20)}`)).toBe(`+${'1'.repeat(15)}`);
      });
      it('só o + sozinho não quebra (nenhum dígito ainda)', () => {
        expect(mascararTelefone('+')).toBe('+');
      });
    });
  });

  // G2 (I-1): o valor que VAI PARA O SERVIDOR precisa preservar o '+' — é esse sinal que
  // NormalizadorTelefone.cs usa pra decidir entre "guarda como veio" (DDI explícito) e
  // "prefixa 55" (nacional). ANTES desta correção, `criarTutor` chamava `somenteDigitos`
  // puro e um estrangeiro de 11-13 dígitos era lido pelo servidor como BR nacional.
  describe('paraEnvioServidor — mordida (I-1)', () => {
    it('BR nacional sem + -> só dígitos (comportamento antigo, correto, inalterado)', () => {
      expect(paraEnvioServidor('(11) 98765-4321')).toBe('11987654321');
    });
    it('BR com + -> preserva o + (servidor decide pelo sinal, não pelo comprimento)', () => {
      expect(paraEnvioServidor('+55 11 98765-4321')).toBe('+5511987654321');
    });
    it('estrangeiro -> preserva o + e todos os dígitos, sem adicionar 55', () => {
      expect(paraEnvioServidor('+1 415 555 2671')).toBe('+14155552671');
      expect(paraEnvioServidor('+351 912 345 678')).toBe('+351912345678');
      expect(paraEnvioServidor('+44 20 7946 0958')).toBe('+442079460958');
    });
  });

  describe('paraWaMe', () => {
    it('prefixa 55 em número de 10-11 dígitos SEM + (BR, DDD+número)', () => {
      expect(paraWaMe('(11) 91234-5678')).toBe('5511912345678');
      expect(paraWaMe('11 3333-4444')).toBe('551133334444');
    });

    it('CONTROLE — mantém um número que já chega SEM + mas com 12-13 dígitos (já tem 55)', () => {
      expect(paraWaMe('5511912345678')).toBe('5511912345678');
    });

    // G2 (I-1): ANTES desta correção, o '+' era descartado por `somenteDigitos` e um
    // estrangeiro de ≤11 dígitos ganhava um "55" espúrio (ex.: +1 415 555 2671, 11
    // dígitos sem o +, virava "551..." — BR errado). Hoje o '+' evita a soma de 55.
    describe('com + (G2 I-1): não soma 55 (o + já sinaliza DDI embutido)', () => {
      it('BR com + usa os dígitos como estão', () => {
        expect(paraWaMe('+5511987654321')).toBe('5511987654321');
      });
      it('estrangeiro com + NÃO ganha 55 (mordida real do bug antigo)', () => {
        expect(paraWaMe('+14155552671')).toBe('14155552671');
        expect(paraWaMe('+351912345678')).toBe('351912345678');
      });
    });
  });

  // Mordida (b): o número precisa estar NORMALIZADO e a mensagem CODIFICADA.
  describe('linkWhatsApp — mordida (b)', () => {
    it('monta o link com número normalizado e mensagem codificada', () => {
      const link = linkWhatsApp('(11) 91234-5678', 'Olá! Segue o link: https://x.io/abc é seu.');

      expect(link.startsWith('https://wa.me/5511912345678?text=')).toBe(true);
      // Espaço, acento e "://" não podem vazar crus na query string.
      expect(link).not.toContain(' ');
      expect(link).not.toContain('á');
      expect(link).toContain(encodeURIComponent('Olá! Segue o link: https://x.io/abc é seu.'));

      // Decodifica de volta e confirma que a mensagem sobrevive intacta.
      const query = link.split('?text=')[1];
      expect(query).toBeDefined();
      expect(decodeURIComponent(query!)).toBe('Olá! Segue o link: https://x.io/abc é seu.');
    });

    it('G2 (I-1) — número estrangeiro com + gera wa.me correto, sem 55 espúrio', () => {
      const link = linkWhatsApp('+1 415 555 2671', 'x');
      expect(link.startsWith('https://wa.me/14155552671?text=')).toBe(true);
    });
  });
});
