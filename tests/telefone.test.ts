import { somenteDigitos, mascararTelefone, paraWaMe, linkWhatsApp } from '../src/utils/telefone';

describe('telefone.ts — utilitários puros (REC-03)', () => {
  describe('somenteDigitos', () => {
    it('remove tudo que não é dígito', () => {
      expect(somenteDigitos('(11) 91234-5678')).toBe('11912345678');
    });
  });

  describe('mascararTelefone', () => {
    it('aplica a máscara conforme os dígitos chegam', () => {
      expect(mascararTelefone('1')).toBe('(1');
      expect(mascararTelefone('11912345678')).toBe('(11) 91234-5678');
      expect(mascararTelefone('1133334444')).toBe('(11) 3333-4444');
    });

    it('ignora dígitos além do 11º', () => {
      expect(mascararTelefone('119123456789999')).toBe('(11) 91234-5678');
    });
  });

  describe('paraWaMe', () => {
    it('prefixa 55 em número de 10-11 dígitos (BR, DDD+número)', () => {
      expect(paraWaMe('(11) 91234-5678')).toBe('5511912345678');
      expect(paraWaMe('11 3333-4444')).toBe('551133334444');
    });

    it('CONTROLE — mantém um número que já chega com código de país (>11 dígitos)', () => {
      expect(paraWaMe('+55 11 91234-5678')).toBe('5511912345678');
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
      expect(decodeURIComponent(query)).toBe('Olá! Segue o link: https://x.io/abc é seu.');
    });
  });
});
