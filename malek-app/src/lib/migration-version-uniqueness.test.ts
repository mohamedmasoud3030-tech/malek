import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = resolve(import.meta.dirname, '../../../supabase/migrations');
const migrationVersionPattern = /^(\d{14})_.+\.sql$/;

describe('Supabase migration versions', () => {
  it('keeps every timestamp version unique', () => {
    const files = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && migrationVersionPattern.test(entry.name))
      .map((entry) => entry.name)
      .sort();

    const byVersion = new Map<string, string[]>();
    for (const file of files) {
      const version = migrationVersionPattern.exec(file)?.[1];
      if (!version) continue;
      const siblings = byVersion.get(version) ?? [];
      siblings.push(file);
      byVersion.set(version, siblings);
    }

    const duplicates = [...byVersion.entries()]
      .filter(([, siblings]) => siblings.length > 1)
      .map(([version, siblings]) => ({ version, files: siblings }));

    expect(duplicates).toEqual([]);
  });
});
