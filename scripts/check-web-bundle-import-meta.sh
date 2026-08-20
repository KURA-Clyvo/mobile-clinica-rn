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
BUNDLE_GLOB="${DIST_DIR}/_expo/static/js/web"

echo "CQ-16 detector (Camada A): procurando bundles web em ${BUNDLE_GLOB}/*.js"

if [ ! -d "${BUNDLE_GLOB}" ]; then
  echo "FALHA: diretório '${BUNDLE_GLOB}' não existe. Nada para inspecionar." >&2
  echo "Isso é falso negativo se tratado como sucesso — o export web pode ter" >&2
  echo "falhado antes deste passo, ou o layout de saída do Expo CLI mudou." >&2
  exit 1
fi

# Array com os bundles encontrados (evita o problema clássico de glob que
# não casa nada expandir para o literal "*.js" e nunca entrar no `for`).
shopt -s nullglob
bundles=("${BUNDLE_GLOB}"/*.js)
shopt -u nullglob

if [ "${#bundles[@]}" -eq 0 ]; then
  echo "FALHA: nenhum arquivo .js encontrado em '${BUNDLE_GLOB}'." >&2
  echo "Bundle web não foi gerado — detector não pode confirmar nada e" >&2
  echo "recusa reportar sucesso por omissão (essa é a armadilha que este" >&2
  echo "script existe para evitar, ver comentário no topo do arquivo)." >&2
  exit 1
fi

echo "Encontrado(s) ${#bundles[@]} bundle(s): ${bundles[*]}"

failed=0
for bundle in "${bundles[@]}"; do
  if grep -o 'import\.meta' "${bundle}" > /dev/null 2>&1; then
    echo "FALHA: '${bundle}' contém 'import.meta' fora de módulo." >&2
    echo "Isso quebra o parse do bundle no browser real com" >&2
    echo "'SyntaxError: Cannot use import.meta outside a module' (tela em branco)." >&2
    echo "Verificar 'babel.config.js' — a chave" >&2
    echo "'web.unstable_transformImportMeta' deve estar 'true'." >&2
    failed=1
  fi
done

if [ "${failed}" -ne 0 ]; then
  exit 1
fi

echo "OK: nenhum bundle web contém import.meta fora de módulo."
exit 0
