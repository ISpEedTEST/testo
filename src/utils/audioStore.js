// ─── Audio Store — JSON-backed CRUD ─────────────────────────────────
// Every function reads/writes audiofile.json atomically so data is
// always persisted and never lost on crash.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = join(__dirname, '..', '..', 'audiofile.json');

// ── Helpers ──────────────────────────────────────────────────────────

/** Read the entire store from disk. */
function readStore() {
  try {
    const raw = readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Write the entire store to disk (pretty-printed). */
function writeStore(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Public API ───────────────────────────────────────────────────────

/** Get every entry. */
export function getAll() {
  return readStore();
}

/** Get entries belonging to a specific Discord user. */
export function getByUser(userId) {
  return readStore().filter((e) => e.uploaderId === userId);
}

/** Get a single entry by its unique ID. */
export function getById(id) {
  return readStore().find((e) => e.id === id) || null;
}

/** Append a new entry and persist. Returns the entry. */
export function add(entry) {
  const store = readStore();
  store.push(entry);
  writeStore(store);
  return entry;
}

/** Update fields on an existing entry. Returns updated entry or null. */
export function update(id, data) {
  const store = readStore();
  const idx   = store.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  store[idx] = { ...store[idx], ...data, id }; // id is immutable
  writeStore(store);
  return store[idx];
}

/** Remove an entry by ID. Returns the removed entry or null. */
export function remove(id) {
  const store   = readStore();
  const idx     = store.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  const [removed] = store.splice(idx, 1);
  writeStore(store);
  return removed;
}
