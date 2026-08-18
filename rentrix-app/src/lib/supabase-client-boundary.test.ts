import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = resolve(import.meta.dirname, '..');

function read(rel: string) {
  return readFileSync(resolve(srcRoot, rel), 'utf8');
}

describe('browser Supabase client boundary', () => {
  it('constructs the only shared client from the public anon key', () => {
    const source = read('lib/supabase.ts');
    expect(source).toContain('createClient<Database>(env.supabaseUrl, env.supabaseAnonKey');
    expect(source).not.toMatch(/SERVICE_ROLE|service_role|sb_secret_/);
    expect(source).toContain("schema: 'public'");
    expect(source).toContain("storageKey: 'rentrix-auth-session'");
    expect(source).toContain('autoRefreshToken: true');
  });

  it('keeps env.ts on the public Vite variables and placeholders only', () => {
    const source = read('lib/env.ts');
    expect(source).toContain('VITE_SUPABASE_URL');
    expect(source).toContain('VITE_SUPABASE_ANON_KEY');
    expect(source).not.toMatch(/SERVICE_ROLE|sb_secret_|VITE_SUPABASE_SERVICE/);
    expect(source).toContain('isConfigured');
  });

  it('does not import a service-role key anywhere under the app source tree', () => {
    const files = [
      'lib/supabase.ts',
      'lib/env.ts',
      'services/auth-service.ts',
      'hooks/use-auth.tsx',
      'hooks/use-company.tsx',
    ];
    for (const file of files) {
      expect(read(file), file).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
    }
  });
});
