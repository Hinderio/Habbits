# Incremental sync rollout

## Active without database changes

The ledger guard resolves existing IDs in groups of up to 100 distinct source IDs,
separated by user and source type. It reads all pages (including server-imposed
caps), preserves normalization/upsert options and reuses existing primary keys.
If lookup fails, the upsert returns an error and the app retains pending changes;
it does not risk inserting duplicates with unresolved IDs. The existing database
uniqueness rules are not changed.

## Database activation required

Apply `sql/add-incremental-sync.sql` in the Supabase SQL Editor after testing it in
a staging/disposable database. It has NOT been executed against the live database
by this change. The client works with the old schema: a missing RPC is probed at
most once per five minutes (initial concurrent table reads may each probe), then
uses the existing paginated full reads. A reload also retries discovery.

The migration adds two private sync metadata tables, triggers and an authenticated
`habitflow_sync_pull` RPC for the twelve existing sync tables. It does not rewrite
business data. Optional tables absent during installation keep using full reads;
rerun the migration after creating them. The RPC preserves business-table RLS.
Clients can read only their own metadata and cannot write clocks or tombstones.
The functions that write metadata are callable only from the installed triggers.

Per-user revisions use a transactional clock. Authenticated write statements lock
the clock before taking business-row locks. Unlike a sequence or `updated_at`
watermark, a visible revision cannot skip an earlier uncommitted transaction.
The RPC uses one PostgreSQL MVCC snapshot for its clock, journal and business rows.
It captures inserts, edits (including ledger rows without `updated_at`) and deletes.
Only the latest change per user/table/row is retained; deletion markers remain.

The first read after page load/account switch fetches a full snapshot. Subsequent
reads return only changed rows and explicit tombstones, paginated in batches of
1000. This includes the mobile smoking poll; its eight-second interval stays the
same. The client rebuilds a **complete** remote snapshot in memory before calling
the existing merge/deletion functions. Failed, malformed or incomplete delta
pages never advance its cache, and fall back to full pagination. Reads of the
same table are serialized, so a post-write pull cannot reuse a pre-write request.
Caches are isolated by account and reset on auth changes. Offline persistence,
pending writes, local delete markers, and existing collection-specific authority
rules remain intact. The mobile path retains its existing merge-only behavior;
remote deletions are applied by the regular full sync using reconstructed snapshots.

This reduces downloaded rows, not the number of table polls or all client-side
merge/scoring work. Caches hold one additional raw snapshot per active sync table
in memory and are not persisted to localStorage.

## Verification and rollback

Run `node --test tests/*.test.cjs`. The new tests exercise batching, capped pages,
failed lookups, delta reconstruction, pagination failures, pending local rows,
auth changes, read/write overlap, missing migrations and legacy fallback. SQL
checks in the Node suite are structural; they are not a PostgreSQL execution test.

`psql -v ON_ERROR_STOP=1 -d <empty-disposable-database> -f tests/sql/incremental-sync.integration.sql`
creates mock auth/roles/business tables, applies the real migration, and checks
initial snapshots, changed rows, paging, deletes, rollback, timestamp-free ledger
edits and RLS. Run ONLY against a new disposable database. Concurrent writers
and a real two-device/offline/reconnect scenario should also be verified in staging.

To disable delta reads, revoke authenticated EXECUTE on
`public.habitflow_sync_pull(text,text,integer)`; the client falls back to full reads.
Reload clients when removing triggers/metadata. Do not truncate/prune the journal,
reset clocks, disable tracking triggers or TRUNCATE business tables while clients
hold delta cursors. Such maintenance requires disabling the RPC and reloading
clients to establish new full baselines. Metadata is not subject to automatic
retention; deleting an auth account cascades its metadata away.
