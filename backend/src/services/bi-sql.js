import sql from 'mssql';

let poolPromise;

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'si', 'sí'].includes(String(value).toLowerCase());
}

function parseServerAddress(rawServer) {
  const value = String(rawServer || '').trim();
  if (!value) return {};

  const [serverAndPort, instanceName] = value.split('\\');
  const [server, portValue] = serverAndPort.split(',');
  const port = Number(portValue || process.env.BI_SQL_PORT || process.env.DB_PORT || 1433);

  return {
    server,
    port: Number.isFinite(port) ? port : 1433,
    instanceName: portValue ? undefined : instanceName,
  };
}

export function getBiSqlConfig() {
  const rawServer = process.env.BI_SQL_SERVER || process.env.DB_SERVER;
  const database = process.env.BI_SQL_DATABASE || process.env.DB_NAME || 'CRM_DB';
  const user = process.env.BI_SQL_USER || process.env.DB_USER;
  const password = process.env.BI_SQL_PASSWORD || process.env.DB_PASSWORD;
  const { server, port, instanceName } = parseServerAddress(rawServer);

  if (!server || !user || !password) {
    return null;
  }

  const options = {
    database,
    encrypt: parseBoolean(process.env.BI_SQL_ENCRYPT, false),
    trustServerCertificate: parseBoolean(process.env.BI_SQL_TRUST_CERT, true),
    enableArithAbort: true,
  };

  if (instanceName) options.instanceName = instanceName;

  return {
    server,
    port,
    database,
    user,
    password,
    options,
    pool: {
      max: Number(process.env.BI_SQL_POOL_MAX || 6),
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: Number(process.env.BI_SQL_REQUEST_TIMEOUT_MS || 30000),
    connectionTimeout: Number(process.env.BI_SQL_CONNECTION_TIMEOUT_MS || 15000),
  };
}

export function isBiSqlConfigured() {
  return Boolean(getBiSqlConfig());
}

export async function getBiSqlPool() {
  const config = getBiSqlConfig();
  if (!config) {
    throw new Error('BI_SQL_NOT_CONFIGURED');
  }

  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .catch((error) => {
        poolPromise = undefined;
        throw error;
      });
  }

  return poolPromise;
}

export async function biQuery(query, params = {}) {
  const pool = await getBiSqlPool();
  const request = pool.request();

  for (const [name, value] of Object.entries(params)) {
    request.input(name, value);
  }

  const result = await request.query(query);
  return result.recordset || [];
}

export async function biOne(query, params = {}) {
  const rows = await biQuery(query, params);
  return rows[0] || {};
}

export { sql };
