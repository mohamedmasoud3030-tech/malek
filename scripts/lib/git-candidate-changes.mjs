import { execFileSync } from 'node:child_process';

/** Candidate = branch changes plus staged/unstaged/untracked working files.
 * Use the merge base for branch semantics, but inspect the actual files that
 * local gates read. NUL delimiters preserve whitespace and quoted filenames. */
export function candidateChanges(root, baseRef, paths = []) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  const mergeBase = git(['merge-base', baseRef, 'HEAD']).trim();
  const tokens = git(['diff', '--name-status', '-z', '--find-renames', mergeBase, '--', ...paths]).split('\0');
  const entries = [];
  for (let index = 0; index < tokens.length && tokens[index];) {
    const status = tokens[index++][0];
    const path = tokens[index++];
    if (!path) throw new Error('Malformed Git candidate change record');
    if (status === 'R' || status === 'C') {
      const newPath = tokens[index++];
      if (!newPath) throw new Error('Malformed Git candidate rename/copy record');
      entries.push(status === 'R' ? { status, oldPath: path, newPath } : { status: 'A', path: newPath });
    } else {
      entries.push({ status, path });
    }
  }
  for (const path of git(['ls-files', '--others', '--exclude-standard', '-z', '--', ...paths]).split('\0').filter(Boolean)) {
    entries.push({ status: 'A', path });
  }
  return entries;
}
