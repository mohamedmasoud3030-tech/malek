import assert from 'node:assert/strict';
import test from 'node:test';

import { gitBlobSha, sha256GitText } from './governance-text-hash.mjs';

test('governance hashes use canonical Git text across LF and CRLF checkouts', () => {
  const lf = '{\n  "locked": true\n}\n';
  const crlf = lf.replace(/\n/g, '\r\n');

  assert.equal(gitBlobSha(crlf), gitBlobSha(lf));
  assert.equal(sha256GitText(crlf), sha256GitText(lf));
});
