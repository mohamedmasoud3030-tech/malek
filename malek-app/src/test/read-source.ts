import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Read a production source file from a contract test, relative to that test.
 *
 * Keeping this small helper centralizes UTF-8 reads while leaving each
 * contract's target path and assertions explicit. Source-text contracts stay
 * pinned to their named files; only the file-reading mechanics are shared.
 *
 * Argument order follows `path.resolve` after the test module URL is converted
 * to its directory: `readSource(import.meta.url, '..', 'shared', 'x.ts')`.
 */
export function readSource(testModuleUrl: string, ...segments: string[]): string {
  return readFileSync(resolve(dirname(fileURLToPath(testModuleUrl)), ...segments), 'utf8');
}
