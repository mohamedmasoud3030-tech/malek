/** Parse the explicit --base <ref> option shared by repository guards. */
export function parseBaseOption(argv) {
  let base = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--base' && argv[index + 1]) {
      base = argv[index + 1];
      index += 1;
    }
  }
  return base;
}
