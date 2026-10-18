import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock CLI execution: these tests cover how handleUnlock reacts to each
// `bw unlock` outcome on the password path, not the real binary.
jest.mock('../src/utils/cli.js', () => ({
  ...jest.requireActual<typeof import('../src/utils/cli.js')>(
    '../src/utils/cli.js',
  ),
  executeCliCommand: jest.fn(),
}));

import { executeCliCommand } from '../src/utils/cli.js';
import { handleUnlock } from '../src/handlers/cli.js';

const mockedExecute = executeCliCommand as jest.MockedFunction<
  typeof executeCliCommand
>;

describe('handleUnlock with password', () => {
  let originalSession: string | undefined;

  beforeEach(() => {
    originalSession = process.env['BW_SESSION'];
    mockedExecute.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalSession === undefined) delete process.env['BW_SESSION'];
    else process.env['BW_SESSION'] = originalSession;
    jest.restoreAllMocks();
  });

  it('stores the session key on success', async () => {
    mockedExecute.mockResolvedValueOnce({ output: 'new-session-key' });

    const result = await handleUnlock({ password: 'secret' });

    expect(result.isError).toBe(false);
    expect(process.env['BW_SESSION']).toBe('new-session-key');
    expect(mockedExecute).toHaveBeenCalledTimes(1);
  });

  it('passes the password only through the child environment', async () => {
    mockedExecute.mockResolvedValueOnce({ output: 'k' });

    await handleUnlock({ password: 'secret' });

    const [command, args, env] = mockedExecute.mock.calls[0]!;
    expect(command).toBe('unlock');
    expect(args).not.toContain('secret');
    expect(env).toEqual({ BW_UNLOCK_PASSWORD: 'secret' });
  });

  it('does not retry a rejected password', async () => {
    mockedExecute.mockResolvedValue({
      errorOutput: 'Invalid master password.',
    });

    const result = await handleUnlock({ password: 'wrong' });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('rejected the master password');
    expect(mockedExecute).toHaveBeenCalledTimes(1);
  });

  it('retries once when the failure is not about the password', async () => {
    mockedExecute
      .mockResolvedValueOnce({ errorOutput: 'Command exited with code 1' })
      .mockResolvedValueOnce({ output: 'retry-session-key' });

    const result = await handleUnlock({ password: 'secret' });

    expect(result.isError).toBe(false);
    expect(process.env['BW_SESSION']).toBe('retry-session-key');
    expect(mockedExecute).toHaveBeenCalledTimes(2);
  });

  it('tells the LLM not to ask for a new password after a non-password failure', async () => {
    mockedExecute.mockResolvedValue({ errorOutput: 'fetch failed' });

    const result = await handleUnlock({ password: 'secret' });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('other than the password');
    expect(result.content[0]!.text).not.toContain('fetch failed');
    expect(mockedExecute).toHaveBeenCalledTimes(2);
  });

  it('logs the raw bw error to the server log, not to the LLM', async () => {
    mockedExecute.mockResolvedValue({
      errorOutput: 'Invalid master password.',
    });

    await handleUnlock({ password: 'wrong' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid master password.'),
    );
  });
});
