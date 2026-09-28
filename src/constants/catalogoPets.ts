// REC-04 — catálogo de espécie/raça para a tela "Novo pet".
//
// 🔴 ACHADO: NÃO EXISTE endpoint no backend-clinica-dotnet para listar
// espécie/raça. Medido: `ls src/Kura.Api/Controllers` (origin/main
// `e33da98`) lista 17 controllers, NENHUM chamado `Especie*`/`Raca*` nem
// referenciando essas entidades — controle positivo: `MedicamentosController`
// (mesma classe de catálogo de referência) TEM CRUD completo
// (GET/GET-by-id/POST/PUT/DELETE), então "catálogo sem controller" não é o
// padrão do projeto para este tipo de tabela, é uma lacuna real desta
// (`Especie`/`Raca` têm entidade em `Kura.Domain/Entities/` mas nenhum
// controller as expõe). `POST /api/v1/pets` exige `idEspecie`/`idRaca`
// (`long`, FK obrigatória) sem ter como o app CONSULTAR quais IDs existem.
//
// SOLUÇÃO DESTA TASK: réplica ANCORADA (regra 11 do CLAUDE.md do
// workspace) do seed que o Flyway grava nos dois profiles — mesmos IDs em
// dev (db/callback/afterMigrate__seeds_dev.sql) e prod
// (db/migration/V14__seed_referencia.sql, que é quem roda no compose do
// DevOps-Cloud, onde não há bootstrap manual desde a TASK-26/37).
//
// FONTE:   backend-tutor-java
//          src/main/resources/db/migration/V14__seed_referencia.sql
// COMMIT:  d1522ee (origin/main, 2026-09-27)
// CONFERIDO EM: 2026-09-27 (REC-04, sessão de implementação)
// REPRODUZIR:
//     git -C backend-tutor-java show d1522ee:src/main/resources/db/migration/V14__seed_referencia.sql | sed -n '34,90p'
//
// ⚠️ ESTE ARQUIVO É UM ESPELHO, NÃO UMA FONTE — se o seed mudar (nova
// espécie/raça, ou uma clínica precisar de raça fora deste catálogo fixo de
// 4), este arquivo desalinha em silêncio. Não há como evitar isso sem o
// endpoint faltante (candidato a task futura: `GET /api/v1/especies`,
// `GET /api/v1/racas`, no padrão de `MedicamentosController`). Registrado
// em rec-04-report.md como gap conhecido, não corrigido nesta task (exigiria
// tocar `backend-clinica-dotnet`, fora do repo desta task).
export interface EspecieCatalogo {
  id: number;
  nome: string;
}

export interface RacaCatalogo {
  id: number;
  idEspecie: number;
  nome: string;
}

// Nomes ACENTUADOS aqui de propósito (o seed grava `NM_ESPECIE='Cao'`, sem
// cedilha) — só o `id` é o que viaja no corpo de `POST /pets`
// (PetCreateWireDto.idEspecie/idRaca), nunca o nome. Consequência cosmética
// registrada: a resposta REAL do servidor após criar o pet ecoa
// `nmEspecie`/`nmRaca` como gravados na tabela ('Cao', sem acento) — o nome
// mostrado aqui no seletor pode diferir do que a tela de detalhe do pet
// exibir depois, por um acento. Baixo risco, não corrigido (corrigir
// exigiria alterar o dado semeado, fora do escopo desta task).
export const ESPECIES: EspecieCatalogo[] = [
  { id: 1, nome: 'Cão' },
  { id: 2, nome: 'Gato' },
];

export const RACAS: RacaCatalogo[] = [
  { id: 1, idEspecie: 1, nome: 'Labrador' },
  { id: 2, idEspecie: 1, nome: 'Poodle' },
  { id: 3, idEspecie: 2, nome: 'Siamês' },
  { id: 4, idEspecie: 2, nome: 'SRD-felino' },
];

export function racasPorEspecie(idEspecie: number): RacaCatalogo[] {
  return RACAS.filter((r) => r.idEspecie === idEspecie);
}
