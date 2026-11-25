import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const stages = ['Recibido', 'Cobertura revisada', 'Visita agendada', 'Parte cerrado'] as const;
export const coverages = ['Pendiente de verificar', 'Contrato', 'Garantía de fabricante', 'Fuera de cobertura'] as const;
export const availability = ['Por comprobar', 'Disponible', 'Sin existencias'] as const;

export type ServiceNotice = {
  id: string;
  stage: number;
  customer: string;
  phone: string;
  equipment: string;
  serial: string;
  issue: string;
  origin: string;
  coverage: string;
  reference: string;
  material: number | null;
  labor: number | null;
  travel: number | null;
  part: string;
  stock: string;
  technician: string;
  appointment: string;
  report: string;
  minutes: number | null;
  usedParts: string;
};

let store: DatabaseSync | undefined;
function database() {
  if (store) return store;
  const path = process.env.SERVICE_NOTICE_DB_PATH || '/app/data/service-notices.sqlite';
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS service_notices (
      id TEXT PRIMARY KEY,
      stage INTEGER NOT NULL CHECK(stage BETWEEN 0 AND 3),
      record TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS service_notice_history (
      notice_id TEXT NOT NULL,
      stage INTEGER NOT NULL,
      changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(notice_id, stage)
    );
    CREATE TRIGGER IF NOT EXISTS service_notice_created AFTER INSERT ON service_notices
    BEGIN
      INSERT INTO service_notice_history(notice_id, stage) VALUES (NEW.id, NEW.stage);
    END;
    CREATE TRIGGER IF NOT EXISTS service_notice_advanced AFTER UPDATE OF stage ON service_notices
    BEGIN
      INSERT INTO service_notice_history(notice_id, stage) VALUES (NEW.id, NEW.stage);
    END;
  `);
  store = db;
  return db;
}

export function listNotices(): ServiceNotice[] {
  return database().prepare('SELECT record FROM service_notices ORDER BY rowid DESC LIMIT 100')
    .all().map(row => JSON.parse(String(row.record)));
}

export function getNotice(id: string): ServiceNotice | null {
  const row = database().prepare('SELECT record FROM service_notices WHERE id = ?').get(id);
  return row ? JSON.parse(String(row.record)) : null;
}

export function getNoticeHistory(id: string) {
  return database().prepare('SELECT stage, changed_at FROM service_notice_history WHERE notice_id = ? ORDER BY stage')
    .all(id).map(row => ({ stage: Number(row.stage), changedAt: String(row.changed_at) + 'Z' }));
}

export function insertNotice(notice: ServiceNotice) {
  database().prepare('INSERT INTO service_notices(id, stage, record) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .run(notice.id, notice.stage, JSON.stringify(notice));
}

export function advanceNotice(notice: ServiceNotice) {
  return database().prepare('UPDATE service_notices SET stage = ?, record = ? WHERE id = ? AND stage = ?')
    .run(notice.stage, JSON.stringify(notice), notice.id, notice.stage - 1).changes === 1;
}
