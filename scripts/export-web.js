#!/usr/bin/env node
// `expo export` sobe um servidor Metro interno e pede o bundle a ele por HTTP. A porta
// padrão é 8081 — a mesma que a API Java (tutor) publica no docker-compose do
// DevOps-Cloud. Com a stack de pé, o export fica pendurado para sempre em "Static
// rendering is enabled" (o pedido do bundle cai no container Java). `expo export` não
// aceita --port e ignora RCT_METRO_PORT vindo do .env (lido antes do .env carregar),
// então a porta entra aqui pelo ambiente do processo.
const { spawnSync } = require('node:child_process');

//
// --clear: o cache de transformação do Metro guarda os módulos com as EXPO_PUBLIC_* já
// embutidas e NÃO invalida quando a variável muda. Medido: depois de trocar o .env (URL da
// API, EXPO_PUBLIC_USE_MOCKS), o export seguinte ainda saía com os valores antigos — é o
// "desliguei o mock e o app continua em mock". Build de publicação sempre parte do zero.
const env = { ...process.env, RCT_METRO_PORT: process.env.RCT_METRO_PORT || '8082' };
const args = ['expo', 'export', '-p', 'web', '--clear', ...process.argv.slice(2)];
const r = spawnSync('npx', args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
