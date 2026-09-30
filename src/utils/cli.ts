/**
 * CLI command execution utilities
 */

import { spawn } from 'child_process';
import { resolveBwInvocation } from './bw-cli.js';
import { buildBwChildEnv } from './bw-env.js';
import { buildSafeCommand, isValidBitwardenCommand } from './security.js';
import type { CliResponse } from './types.js';

/**
 * Checks whether the vault is unlocked before running a vault-dependent
 * command. Calling `bw status` is fast and always succeeds regardless of
 * vault state, so we use it as a pre-flight check to fail immediately with
 * a clear, actionable message rather than letting the actual command time-out
 * or return a cryptic CLI error.
 *
 * Returns null when the vault is unlocked and safe to proceed.
 * Returns a CliResponse with errorOutput when the vault is locked or the
 * user is not authenticated.
 */
export async function ensureVaultUnlocked(): Promise<CliResponse | null> {
  const statusResponse = await executeCliCommand('status', []);
  if (!statusResponse.output) {
    // Cannot determine status — proceed and let the real command surface the error.
    return null;
  }
  try {
    const { status } = JSON.parse(statusResponse.output) as { status: string };
    if (status === 'locked') {
      return {
        errorOutput:
          'Vault is locked. Call the "unlock" tool with your master password to unlock it, then retry.',
      };
    }
    if (status === 'unauthenticated') {
      return {
        errorOutput:
          'Not logged in to Bitwarden. Use "bw login" to authenticate first, then retry.',
      };
    }
  } catch {
    // JSON parse failed — proceed and let the vault command surface the real error.
  }
  return null;
}

/**
 * Executes a Bitwarden CLI command safely using spawn() to prevent command injection
 * Internally calls buildSafeCommand() to validate and sanitize inputs
 * @param baseCommand - The base Bitwarden command (e.g., 'list', 'get', 'create')
 * @param parameters - Array of command parameters (will be validated)
 * @returns Promise resolving to CLI response with output or error
 */
/**
 * Quita de stderr los avisos del runtime de Node (DeprecationWarning,
 * ExperimentalWarning y la línea "(Use `node --trace-...` ...)") que no son
 * errores del comando.
 */
export function stripNodeWarnings(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\(node:\d+\) \[?[A-Z]*\d*\]? ?\w*Warning:/.test(line) &&
        !/^\(Use `node --trace-/.test(line),
    )
    .join('\n')
    .trim();
}

export async function executeCliCommand(
  baseCommand: string,
  parameters: readonly string[] = [],
  extraEnv?: Record<string, string>,
): Promise<CliResponse> {
  try {
    // Build safe command array (validates and sanitizes inputs)
    const [command, ...args] = buildSafeCommand(baseCommand, parameters);

    // Validate the base command against allowlist
    if (!isValidBitwardenCommand(command)) {
      return {
        errorOutput:
          'Invalid or unsafe command. Only Bitwarden CLI commands are allowed.',
      } as const;
    }

    // Build a filtered child env. `bw` only needs PATH/HOME/APPDATA-style
    // vars plus BW_SESSION when set — it must not inherit the API client
    // credentials or any other host env the operator set on the MCP
    // server process. See bw-env.ts for the full rationale.
    // NODE_NO_WARNINGS: `bw` corre sobre Node y, en Node 22+, imprime en
    // stderr avisos de deprecación (p. ej. DEP0040 punycode) en CADA
    // comando. Como stderr se trata como error, esos avisos hacían fallar
    // operaciones que en realidad salieron bien (edit_item no guardaba).
    const childEnv = buildBwChildEnv({
      ...(process.env['BW_SESSION']
        ? { BW_SESSION: process.env['BW_SESSION'] }
        : {}),
      NODE_NO_WARNINGS: '1',
      ...extraEnv,
    });

    // Resolve how to invoke `bw` (handles the Windows npm-shim case where
    // a bare `bw` is not directly spawnable). See bw-cli.ts.
    const { command: bwExecutable, prefixArgs } = resolveBwInvocation();

    // Use spawn with array of arguments to avoid shell interpretation
    return new Promise<CliResponse>((resolve) => {
      const child = spawn(bwExecutable, [...prefixArgs, command, ...args], {
        env: childEnv,
        shell: false, // Explicitly disable shell to prevent injection
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        resolve({
          errorOutput: `Failed to execute command: ${error.message}`,
        });
      });

      child.on('close', (code: number) => {
        const result: CliResponse = {};
        if (stdout) result.output = stdout.trim();
        // Segunda red de seguridad: si igual se cuela un aviso de Node,
        // no cuenta como error cuando el comando terminó bien.
        const realStderr = stripNodeWarnings(stderr);
        if (realStderr || code !== 0)
          result.errorOutput =
            realStderr || stderr.trim() || `Command exited with code ${code}`;
        resolve(result);
      });
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      errorOutput: errorMessage,
    } as const;
  }
}
