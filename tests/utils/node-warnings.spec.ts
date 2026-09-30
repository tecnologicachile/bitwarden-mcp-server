import { stripNodeWarnings } from '../../src/utils/cli.js';

// Fork de Tecnológica: `bw` sobre Node 22+ escribe avisos de deprecación en
// stderr en cada comando. No deben contarse como error (edit_item no guardaba).
describe('stripNodeWarnings', () => {
  it('drops Node deprecation warnings and the trace hint', () => {
    const stderr =
      '(node:4002089) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.\n' +
      '(Use `node --trace-deprecation ...` to show where the warning was created)\n';
    expect(stripNodeWarnings(stderr)).toBe('');
  });

  it('drops experimental warnings too', () => {
    expect(
      stripNodeWarnings(
        '(node:12) ExperimentalWarning: something is experimental',
      ),
    ).toBe('');
  });

  it('keeps real bw errors', () => {
    const stderr =
      '(node:1) [DEP0040] DeprecationWarning: punycode\nNot found.\n';
    expect(stripNodeWarnings(stderr)).toBe('Not found.');
  });

  it('keeps unrelated lines untouched', () => {
    expect(stripNodeWarnings('You are not logged in.')).toBe(
      'You are not logged in.',
    );
  });
});
