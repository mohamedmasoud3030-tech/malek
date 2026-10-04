import { createHash } from 'node:crypto';

export function canonicalGitText(text) {
  return text.replace(/\r\n/g, '\n');
}

export function gitBlobSha(text) {
  const content = canonicalGitText(text);
  const header = `blob ${Buffer.byteLength(content, 'utf8')}\0`;
  return createHash('sha1').update(header).update(content).digest('hex');
}

export function sha256GitText(text) {
  return createHash('sha256').update(canonicalGitText(text), 'utf8').digest('hex');
}
