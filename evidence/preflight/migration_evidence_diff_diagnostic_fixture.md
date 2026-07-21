# Migration evidence diagnostic fixture excerpt

A fake read-only psql executable returned two matching ledger entries plus one remote-only test entry. The script intentionally exited non-zero and printed both local-only and remote-only classes without exposing the DB URL.

Local-only migrations absent from live ledger: 127
Remote-only ledger entries absent from local migrations: 1
Remote-only ledger entry: 20990101000000_remote_only_test
Status: FAILED - local and live migration ledgers differ
Failure reason: migration drift detected by read-only comparison; do not run repair or push automatically
