# Bitwarden MCP Server Fork — Contexto del proyecto

## Qué es esto

Fork del repositorio oficial [`bitwarden/mcp-server`](https://github.com/bitwarden/mcp-server).
Nuestro fork: [`tecnologicachile/bitwarden-mcp-server`](https://github.com/tecnologicachile/bitwarden-mcp-server).

El fork existe porque le estamos haciendo contribuciones al repo oficial y necesitamos ramas propias para los PRs.

## PRs abiertos / historial

| PR                                                       | Rama                                 | Título                                                                  | Estado                                                                   |
| -------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [#168](https://github.com/bitwarden/mcp-server/pull/168) | `fix/main-module-check`              | fix: use fileURLToPath for main module detection                        | ✅ **Mergeado** (21 abril 2026)                                          |
| [#177](https://github.com/bitwarden/mcp-server/pull/177) | `feat/custom-fields-and-collections` | feat: support custom fields, organizationId and collectionIds on items  | ⏳ **Abierto** — registrado en Jira como PM-35353, sin review humano aún |
| [#182](https://github.com/bitwarden/mcp-server/pull/182) | `fix/fail-fast-when-vault-locked`    | fix: fail fast with clear error when vault is locked or unauthenticated | 🆕 **Abierto** — recién enviado                                          |

## Descripción de cada PR

### PR #177 — Custom fields + org/collections

- **Motivación**: MuxTerm necesita leer el campo `Initial_Path` de items de Bitwarden (custom field) para hacer auto-cd al abrir terminales SSH.
- **Qué agrega**: soporte para leer/escribir `fields` (custom fields), `organizationId` y `collectionIds` en los items del vault.
- **Rama**: `feat/custom-fields-and-collections`
- **Estado**: esperando review del maintainer `withinfocus` (el mismo que aprobó el #168).

### PR #182 — Fail fast cuando vault bloqueado

- **Motivación**: cuando el vault está locked, las tools llamaban `bw` directamente y tardaban mucho o devolvían errores crípticos del CLI. El LLM no entendía qué hacer.
- **Qué agrega**: función `ensureVaultUnlocked()` en `src/utils/cli.ts` que chequea `bw status` antes de ejecutar cualquier tool que requiera vault. Si está locked → error inmediato y claro: _"Call the 'unlock' tool with your master password"_. Si no está autenticado → _"Use 'bw login' to authenticate first"_.
- **Rama**: `fix/fail-fast-when-vault-locked`
- **Excluidos del guard**: `status`, `lock`, `generate` (no necesitan vault) y todos los `org_*` tools (usan REST API propia).

## Cómo está configurado el MCP localmente

El MCP de Bitwarden está instalado y corriendo desde este fork (no desde el paquete npm oficial):

```bash
# El binario que usa Claude Code:
~/.npm-global/bin/mcp-server-bitwarden
# Apunta a este fork compilado (dist/index.js)
```

La key de sesión de Bitwarden está en `~/.claude.json` → `mcpServers.bitwarden.env.BW_SESSION`.

## Comandos útiles

```bash
# Compilar después de cambios
npm run build

# Ver estado del vault (sin necesitar vault desbloqueado)
bw status

# Correr tests con mocks (rápido, sin llamadas reales a bw)
npx jest tests/utils/cli.spec.ts tests/core.spec.ts tests/validation.spec.ts

# NO correr cli-commands.spec.ts localmente — hace llamadas reales a bw
# y consume toda la CPU esperando timeouts de red.

# Ver diff de un PR
gh pr diff 177 --repo bitwarden/mcp-server
```

## Estructura relevante

```
src/
  index.ts          — dispatcher principal de tools (aquí está el vault guard del PR #182)
  handlers/
    cli.ts          — todos los handlers de vault CLI (list, get, create_item, etc.)
    api.ts          — handlers de org API REST (no usan vault CLI)
  utils/
    cli.ts          — executeCliCommand() + ensureVaultUnlocked() (PR #182)
    api.ts          — executeApiRequest() para org tools
  tools/
    index.ts        — definiciones de tools expuestas al LLM
```

## Notas importantes

- **No corras `npm test` completo localmente** — `cli-commands.spec.ts` hace llamadas reales al servidor de Bitwarden y puede saturar la CPU esperando timeouts. Corré solo los suites específicos con mocks.
- El fallo del PR #177 con el caret `^` en TypeScript fue porque Bitwarden pinea versiones exactas de dependencias. Cualquier cambio de deps debe usar versión exacta sin `^` ni `~`.
- El maintainer principal que revisa PRs de community es `withinfocus`.
