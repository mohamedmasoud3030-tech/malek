import test from 'node:test';
import assert from 'node:assert/strict';
import { requireIsolatedEnvironment } from './isolated-environment.mjs';

const names = [
  'E2E_ENVIRONMENT_KIND',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'PRODUCTION_SUPABASE_PROJECT_REF',
];

function withEnvironment(values, run) {
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  Object.assign(process.env, values);
  try {
    run();
  } finally {
    for (const name of names) {
      if (previous.get(name) === undefined) delete process.env[name];
      else process.env[name] = previous.get(name);
    }
  }
}

function validEnvironment(kind = 'local', url = 'http://127.0.0.1:54321') {
  return {
    E2E_ENVIRONMENT_KIND: kind,
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: 'local-test-anon-key',
    PRODUCTION_SUPABASE_PROJECT_REF: 'prod-project-ref',
  };
}

test('allows a non-production local environment and returns its parsed URL', () => {
  withEnvironment(validEnvironment(), () => {
    const result = requireIsolatedEnvironment({
      required: names,
      allowedKinds: ['local', 'staging'],
      label: 'Storage smoke',
    });
    assert.equal(result.kind, 'local');
    assert.equal(result.supabaseUrl.hostname, '127.0.0.1');
  });
});

test('allows an explicitly permitted QA environment kind', () => {
  withEnvironment(validEnvironment('qa', 'https://qa-project.supabase.co'), () => {
    const result = requireIsolatedEnvironment({
      required: names,
      allowedKinds: ['local', 'qa'],
      label: 'single-office smoke',
    });
    assert.equal(result.kind, 'qa');
  });
});

test('refuses the production Supabase project before a client can be created', () => {
  withEnvironment(validEnvironment('staging', 'https://prod-project-ref.supabase.co'), () => {
    assert.throws(
      () => requireIsolatedEnvironment({
        required: names,
        allowedKinds: ['local', 'staging'],
        label: 'Storage smoke',
      }),
      /Refusing Storage smoke against the production Supabase project/,
    );
  });
});

test('refuses a production subdomain that uses the configured project ref', () => {
  withEnvironment(validEnvironment('staging', 'https://prod-project-ref.storage.supabase.co'), () => {
    assert.throws(
      () => requireIsolatedEnvironment({
        required: names,
        allowedKinds: ['local', 'staging'],
        label: 'Storage smoke',
      }),
      /Refusing Storage smoke against the production Supabase project/,
    );
  });
});

test('refuses a kind not explicitly allowed by this smoke', () => {
  withEnvironment(validEnvironment('qa'), () => {
    assert.throws(
      () => requireIsolatedEnvironment({
        required: names,
        allowedKinds: ['local', 'staging'],
        label: 'Storage smoke',
      }),
      /allowed only for: local, staging/,
    );
  });
});
