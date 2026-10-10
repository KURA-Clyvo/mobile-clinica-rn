// BR-CLI-T06 -- relogio do dispositivo num lugar so, para os testes poderem congelar "agora" sem
// fake timers. E a MESMA aproximacao que `podeMarcarFalta`/`minutosEsperando` ja aceitam: o servidor usa
// IRelogioClinica (hora de SP); aparelho fora desse fuso erra a marca "agora" e os atrasos.
export function agora(): Date {
  return new Date();
}
