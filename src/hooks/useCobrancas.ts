import { useMutation } from '@tanstack/react-query';
import { lancarCobranca } from '@services/cobrancas.service';
import type { CobrancaCreateRequest } from '../types/api';

// FM-06 -- `retry: 0`, mesmo padrão de useServicosPreco/useCriarConsulta: um
// 404 (evento de outra clínica/inexistente) ou 422 (serviço de preço
// indisponível/desativado) é regra de negócio, retentar não muda o
// resultado. SEM `invalidateQueries` -- não existe query de leitura para
// este recurso na tela do veterinário (os 2 GET de CobrancasController são
// SomenteGestor, ver cobrancas.service.ts); nada para invalidar.
export function useLancarCobranca() {
  return useMutation({
    mutationFn: (vars: { idEventoClinico: number; req: CobrancaCreateRequest }) =>
      lancarCobranca(vars.idEventoClinico, vars.req),
    retry: 0,
  });
}
