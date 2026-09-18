#!/usr/bin/env node
// `expo export` sobe um servidor Metro interno e pede o bundle a ele por HTTP. A porta
// padrão é 8081 — a mesma que a API Java (tutor) publica no docker-compose do
// DevOps-Cloud. Com a stack de pé, o export fica pendurado para sempre em "Static
// rendering is enabled" (o pedido do bundle cai no container Java). `expo export` não
// aceita --port e ignora RCT_METRO_PORT vindo do .env (lido antes do .env carregar),
// então a porta entra aqui pelo ambiente do processo.
const { spawnSync } = require('node:child_process');

const env = { ...process.env, RCT_METRO_PORT: process.env.RCT_METRO_PORT || '8082' };
const args = ['expo', 'export', '-p', 'web', ...process.argv.slice(2)];
const r = spawnSync('npx', args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
