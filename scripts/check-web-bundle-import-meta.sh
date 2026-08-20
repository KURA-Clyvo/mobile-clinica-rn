#!/usr/bin/env bash
# CQ-16 — Camada A do detector automatizado (roda sobre o export real do CI).
#
# Contexto: `expo export --platform web` carrega o bundle como
# `<script src="..." defer>` clássico, sem `type="module"` (decisão
# hardcoded do @expo/cli, ver comentário em babel.config.js na raiz do
# repo) — então qualquer `import.meta` que sobreviva à transformação Babel
# vira `SyntaxError: Cannot use 'import.meta' outside a module` no browser
# real, com o bundle inteiro falhando ao PARSEAR (tela em branco, nenhum
# console.error de app, só o SyntaxError do parser). O fix
# (`babel.config.js`, chave `web.unstable_transformImportMeta`) faz o Babel
# reescrever `import.meta` para `globalThis.__ExpoImportMetaRegistry` só na
# plataforma web.
#
# Este script inspeciona a saída REAL do `expo export --platform web` que o
# ".github/workflows/ci.yml" já roda no passo "Web export (prova de build
# da plataforma web)" — não roda outro export (isso duplicaria ~60-90s no
# mesmo run de CI sem ganhar fidelidade; ver tests/babel-web-import-meta.test.ts
# para a Camada B, que roda em todo `npm test` mas é cega à forma real do
# `options`/`caller` que o Metro constrói em bundling de verdade).
#
# ARMADILHA OBRIGATÓRIA (a razão deste script existir em vez de um `grep`
# inline no ci.yml): um `grep -r "import\.meta" dist/_expo/static/js/web/`
# ingênuo PASSA (exit 0, sem output) quando o glob não casa arquivo nenhum —
# bundle não gerado, diretório errado, export falhou silenciosamente antes
# deste passo, nome do diretório mudou em um bump do Expo CLI. Isso é falso
# negativo: o detector "passa" sem ter checado nada. Por isso este script
# SEMPRE falha explicitamente se zero bundles forem encontrados, antes de
# sequer tentar o grep de conteúdo.
#
# VARREDURA RECURSIVA (achado pela revisão G2 da CQ-16, 2026-08-20): a
# primeira versão deste script usava o glob de uma variável então chamada
# `BUNDLE_GLOB` (`"${BUNDLE_GLOB}"/*.js`), que só olha um nível de
# diretório. O revisor demonstrou o falso negativo: um `.js` sujo criado em
# `_expo/static/js/web/chunks/` (subdiretório) passava despercebido — o
# script reportava "1 bundle(s) encontrado(s)" (só o arquivo do nível
# raiz), nunca via o chunk, e saía com exit 0 mesmo contendo `import.meta`.
# É a MESMA classe de falso negativo que a armadilha acima já descreve, só
# que dentro do próprio script escrito pra matar essa classe. Hoje o export
# deste app produz 1 único `.js` no nível raiz (sem code splitting/rotas
# assíncronas), então não reproduz em produção — mas o detector existe pra
# pegar REGRESSÃO futura, e um bump do Expo (ou `asyncRoutes`) pode passar
# a emitir chunks em subdiretório a qualquer momento. Por isso a varredura
# usa `find -type f -name '*.js'` (recursivo, qualquer profundidade) em vez
# do glob de um nível só — e a variável foi renomeada para `BUNDLE_DIR`
# (mesma revisão): ela guarda um diretório-raiz de busca, não mais um glob.
#
# NOTA DE AMBIENTE: no CI o checkout é limpo a cada run — não há cache do
# Metro em disco de uma execução anterior, então `--clear` não é necessário
# no passo "Web export" que roda antes deste script. Isso é diferente de
# rodar `expo export` manualmente numa máquina de desenvolvedor com cache
# antigo (ver seção 3 do relatório da task CQ-16): ali, mudar
# `babel.config.js` sem `--clear` pode reaproveitar uma transformação velha
# e mascarar uma regressão. Este script não limpa cache porque não é dele
# rodar o export — só inspecionar o que já foi exportado.

set -euo pipefail

DIST_DIR="${1:-dist}"
BUNDLE_DIR="${DIST_DIR}/_expo/static/js/web"

echo "CQ-16 detector (Camada A): procurando *.js recursivamente sob ${BUNDLE_DIR}"

if [ ! -d "${BUNDLE_DIR}" ]; then
  echo "FALHA: diretório '${BUNDLE_DIR}' não existe. Nada para inspecionar." >&2
  echo "Isso é falso negativo se tratado como sucesso — o export web pode ter" >&2
  echo "falhado antes deste passo, ou o layout de saída do Expo CLI mudou." >&2
  exit 1
fi

# Array com os bundles encontrados, varredura RECURSIVA (ver nota no topo
# do arquivo). Usa `find -print0` + `read -d ''` (NUL-delimited) em vez de
# `find | while read`: um pipe roda o `while` numa subshell, e qualquer
# variável setada ali (inclusive `bundles`) desaparece ao sair do pipe —
# armadilha clássica de "propagação de status/estado não escapa do
# subshell". Process substitution (`< <(...)`) mantém o `while` na shell
# atual, então `bundles` sobrevive fora do loop. NUL-delimited (`-print0`
# / `-d ''`) evita quebra em nome de arquivo com espaço (ou newline).
bundles=()
while IFS= read -r -d '' bundle_file; do
  bundles+=("${bundle_file}")
done < <(find "${BUNDLE_DIR}" -type f -name '*.js' -print0)

if [ "${#bundles[@]}" -eq 0 ]; then
  echo "FALHA: nenhum arquivo .js encontrado em '${BUNDLE_DIR}'." >&2
  echo "Bundle web não foi gerado — detector não pode confirmar nada e" >&2
  echo "recusa reportar sucesso por omissão (essa é a armadilha que este" >&2
  echo "script existe para evitar, ver comentário no topo do arquivo)." >&2
  exit 1
fi

echo "Encontrado(s) ${#bundles[@]} bundle(s): ${bundles[*]}"

failed=0
for bundle in "${bundles[@]}"; do
  if grep -o 'import\.meta' "${bundle}" > /dev/null 2>&1; then
    echo "FALHA: '${bundle}' contém a sequência 'import.meta'." >&2
    echo "Se for um MetaProperty real (não dentro de string/comentário), isso" >&2
    echo "quebra o parse do bundle no browser real com" >&2
    echo "'SyntaxError: Cannot use import.meta outside a module' (tela em branco)." >&2
    echo "A busca é por substring, não por AST — pode casar dentro de um literal" >&2
    echo "ou comentário (falso positivo). Conferir com 'grep -o import.meta" >&2
    echo "${bundle}' antes de investigar 'babel.config.js' (chave" >&2
    echo "'web.unstable_transformImportMeta')." >&2
    failed=1
  fi
done

if [ "${failed}" -ne 0 ]; then
  exit 1
fi

echo "OK: nenhum bundle web contém import.meta fora de módulo."
exit 0
