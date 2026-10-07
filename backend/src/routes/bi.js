import { Router } from 'express';
import { biOne, biQuery, getBiSqlConfig, isBiSqlConfigured } from '../services/bi-sql.js';

export const biRouter = Router();

function asNumber(value) {
  return Number(value || 0);
}

function money(value) {
  return Math.round(asNumber(value) * 100) / 100;
}

function pct(value) {
  return Math.round(asNumber(value) * 10) / 10;
}

function normalizeRows(rows) {
  return (rows || []).map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  ));
}

function monthParams(req) {
  const year = Number(req.query.year || req.query.anio || new Date().getFullYear());
  const month = req.query.month || req.query.mes ? Number(req.query.month || req.query.mes) : null;
  const limit = Math.min(Math.max(Number(req.query.limit || req.query.limite || 20), 1), 100);

  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    previousYear: Number.isFinite(year) ? year - 1 : new Date().getFullYear() - 1,
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : null,
    limit,
  };
}

async function loadOverview({ year, previousYear, month, limit }) {
  const dateFilter = month
    ? 'YEAR(FechaFactura) = @year AND MONTH(FechaFactura) = @month'
    : 'YEAR(FechaFactura) = @year';
  const previousDateFilter = month
    ? 'YEAR(FechaFactura) = @previousYear AND MONTH(FechaFactura) = @month'
    : 'YEAR(FechaFactura) = @previousYear';
  const orderDateFilter = month
    ? 'YEAR(FechaCreacionAudi) = @year AND MONTH(FechaCreacionAudi) = @month'
    : 'YEAR(FechaCreacionAudi) = @year';
  const otDateFilter = month
    ? 'YEAR(FechaSolicitud) = @year AND MONTH(FechaSolicitud) = @month'
    : 'YEAR(FechaSolicitud) = @year';
  const receivablesDateFilter = month
    ? 'YEAR(co.FechaVencimiento) = @year AND MONTH(co.FechaVencimiento) = @month'
    : 'YEAR(co.FechaVencimiento) = @year';

  const params = { year, previousYear, month, limit };

  const [
    connection,
    financial,
    commercial,
    operations,
    installations,
    warehouse,
    monthlyRevenue,
    monthlyQuotes,
    topCustomers,
    pendingReceivables,
    technicians,
    recentWorkOrders,
    stockAlerts,
    topParts,
  ] = await Promise.all([
    biOne(`
      SELECT
        @@SERVERNAME AS serverName,
        DB_NAME() AS databaseName,
        GETDATE() AS serverDate
    `),
    biOne(`
      SELECT
        ISNULL(SUM(CASE WHEN ${dateFilter} THEN BaseImponible ELSE 0 END), 0) AS revenueNet,
        ISNULL(SUM(CASE WHEN ${dateFilter} THEN ImpIva ELSE 0 END), 0) AS revenueVat,
        ISNULL(SUM(CASE WHEN ${dateFilter} THEN ImpTotal ELSE 0 END), 0) AS revenueTotal,
        ISNULL(SUM(CASE WHEN ${previousDateFilter} THEN BaseImponible ELSE 0 END), 0) AS previousRevenueNet,
        ISNULL(SUM(CASE WHEN ${previousDateFilter} THEN ImpIva ELSE 0 END), 0) AS previousRevenueVat,
        ISNULL(SUM(CASE WHEN ${previousDateFilter} THEN ImpTotal ELSE 0 END), 0) AS previousRevenueTotal,
        COUNT(DISTINCT CASE WHEN ${dateFilter} THEN IDFactura END) AS invoices,
        COUNT(DISTINCT CASE WHEN ${dateFilter} THEN IDClienteInicial END) AS customers
      FROM tbFacturaVentaCabecera
      WHERE YEAR(FechaFactura) IN (@year, @previousYear)
    `, params),
    biOne(`
      WITH filtered AS (
        SELECT IDOfertaComercial, FechaCreacionAudi
        FROM tbOfertaComercialCabecera
        WHERE ${orderDateFilter}
      ),
      lineTotals AS (
        SELECT
          d.IDOfertaComercial,
          ISNULL(SUM(d.ImpOfertaVentaA), 0) AS quotedAmount,
          ISNULL(SUM(iva.ImpIVA), 0) AS quotedVat
        FROM tbOfertaComercialDetalle d
        LEFT JOIN vFrmMntoOfertaComercialIVA iva ON d.IDLineaOfertaDetalle = iva.IDLineaOfertaDetalle
        INNER JOIN filtered p ON d.IDOfertaComercial = p.IDOfertaComercial
        GROUP BY d.IDOfertaComercial
      )
      SELECT
        COUNT(*) AS quotes,
        ISNULL(SUM(lineTotals.quotedAmount), 0) AS quotedAmount,
        ISNULL(SUM(lineTotals.quotedVat), 0) AS quotedVat,
        ISNULL(AVG(lineTotals.quotedAmount), 0) AS averageQuote,
        SUM(CASE WHEN DATEDIFF(DAY, filtered.FechaCreacionAudi, GETDATE()) > 30 THEN 1 ELSE 0 END) AS staleQuotes
      FROM filtered
      LEFT JOIN lineTotals ON filtered.IDOfertaComercial = lineTotals.IDOfertaComercial
    `, params),
    biOne(`
      SELECT
        COUNT(*) AS workOrders,
        COUNT(DISTINCT IDOperarioResponsable) AS activeTechnicians,
        COUNT(DISTINCT IDCliente) AS servedCustomers
      FROM tbMntoOT
      WHERE ${otDateFilter}
    `, params),
    biOne(`
      SELECT
        COUNT(*) AS notices,
        COUNT(DISTINCT IDCliente) AS customers,
        COUNT(DISTINCT IDTipoOT) AS types
      FROM tbMntoOT
      WHERE ${otDateFilter}
    `, params),
    biOne(`
      SELECT
        COUNT(DISTINCT ae.IDArticulo) AS stockReferences,
        ISNULL(SUM(ae.StockFisico), 0) AS units,
        SUM(CASE WHEN ISNULL(ae.StockFisico, 0) <= 0 THEN 1 ELSE 0 END) AS outOfStock,
        SUM(CASE WHEN ae.StockFisico > 0 AND ae.PuntoPedido > 0 AND ae.StockFisico < ae.PuntoPedido THEN 1 ELSE 0 END) AS lowStock
      FROM tbMaestroArticuloAlmacen ae
    `),
    biQuery(`
      SELECT
        YEAR(FechaFactura) AS year,
        MONTH(FechaFactura) AS month,
        ISNULL(SUM(BaseImponible), 0) AS taxableRevenue,
        ISNULL(SUM(ImpIva), 0) AS vatRevenue,
        ISNULL(SUM(ImpTotal), 0) AS totalRevenue,
        COUNT(DISTINCT IDFactura) AS invoices,
        COUNT(DISTINCT IDClienteInicial) AS customers
      FROM tbFacturaVentaCabecera
      WHERE YEAR(FechaFactura) IN (@year, @previousYear) AND FechaFactura IS NOT NULL
      GROUP BY YEAR(FechaFactura), MONTH(FechaFactura)
      ORDER BY year, month
    `, params),
    biQuery(`
      SELECT
        MONTH(FechaCreacionAudi) AS month,
        YEAR(FechaCreacionAudi) AS year,
        ISNULL(SUM(ImpOfertaVentaA), 0) AS quotedAmount,
        COUNT(*) AS quotes
      FROM tbOfertaComercialCabecera
      WHERE YEAR(FechaCreacionAudi) = @year AND FechaCreacionAudi IS NOT NULL
      GROUP BY YEAR(FechaCreacionAudi), MONTH(FechaCreacionAudi)
      ORDER BY year, month
    `, params),
    biQuery(`
      SELECT TOP (@limit)
        c.IDCliente AS customerCode,
        c.RazonSocial AS businessName,
        ISNULL(c.DescCliente, c.RazonSocial) AS customerName,
        ISNULL(SUM(f.BaseImponible), 0) AS taxableRevenue,
        ISNULL(SUM(f.ImpIva), 0) AS vatAmount,
        ISNULL(SUM(f.ImpTotal), 0) AS totalRevenue,
        COUNT(DISTINCT f.IDFactura) AS invoices
      FROM tbFacturaVentaCabecera f
      INNER JOIN tbMaestroCliente c ON f.IDClienteInicial = c.IDCliente
      WHERE ${dateFilter}
      GROUP BY c.IDCliente, c.RazonSocial, c.DescCliente
      ORDER BY totalRevenue DESC
    `, params),
    biQuery(`
      SELECT TOP (@limit)
        co.IDFactura AS invoiceId,
        c.RazonSocial AS businessName,
        ISNULL(c.DescCliente, c.RazonSocial) AS customerName,
        co.FechaVencimiento AS dueDate,
        CASE
          WHEN ISNULL(f.ImpTotal, 0) = 0 THEN co.ImpVencimiento
          ELSE co.ImpVencimiento * (f.BaseImponible / f.ImpTotal)
        END AS pendingNet,
        CASE
          WHEN ISNULL(f.ImpTotal, 0) = 0 THEN 0
          ELSE co.ImpVencimiento - (co.ImpVencimiento * (f.BaseImponible / f.ImpTotal))
        END AS pendingVat,
        co.ImpVencimiento AS pendingTotal,
        DATEDIFF(DAY, co.FechaVencimiento, GETDATE()) AS overdueDays
      FROM tbCobro co
      INNER JOIN tbFacturaVentaCabecera f ON co.IDFactura = f.IDFactura
      INNER JOIN tbMaestroCliente c ON f.IDClienteInicial = c.IDCliente
      WHERE co.Liquidado = 0
        AND co.FechaVencimiento IS NOT NULL
        AND ${receivablesDateFilter}
      ORDER BY co.FechaVencimiento ASC
    `, params),
    biQuery(`
      SELECT TOP (@limit)
        t.IDOperario AS technicianCode,
        ISNULL(t.DescOperario, CAST(t.IDOperario AS VARCHAR)) AS technicianName,
        COUNT(pt.IDContador) AS workOrders,
        COUNT(DISTINCT pt.IDCliente) AS customers
      FROM tbMaestroOperario t
      INNER JOIN tbMntoOT pt ON pt.IDOperarioResponsable = t.IDOperario
      WHERE YEAR(pt.FechaSolicitud) = @year
      GROUP BY t.IDOperario, t.DescOperario
      ORDER BY workOrders DESC
    `, params),
    biQuery(`
      SELECT TOP (@limit)
        pt.IDContador AS workOrderId,
        pt.FechaSolicitud AS requestDate,
        c.RazonSocial AS businessName,
        ISNULL(t.DescOperario, CAST(pt.IDOperarioResponsable AS VARCHAR)) AS technicianName,
        ISNULL(CAST(pt.IDTipoOT AS VARCHAR), 'Sin tipo') AS type,
        DATEDIFF(DAY, pt.FechaSolicitud, GETDATE()) AS ageDays
      FROM tbMntoOT pt
      LEFT JOIN tbMaestroCliente c ON pt.IDCliente = c.IDCliente
      LEFT JOIN tbMaestroOperario t ON pt.IDOperarioResponsable = t.IDOperario
      WHERE pt.FechaSolicitud IS NOT NULL
      ORDER BY pt.FechaSolicitud DESC
    `, params),
    biQuery(`
      SELECT TOP (@limit)
        ae.IDArticulo AS itemCode,
        ISNULL(a.DescArticulo, ae.IDArticulo) AS description,
        ae.IDAlmacen AS warehouse,
        ISNULL(ae.StockFisico, 0) AS stock,
        ISNULL(ae.PuntoPedido, 0) AS reorderPoint,
        CASE
          WHEN ISNULL(ae.StockFisico, 0) <= 0 THEN 'Sin stock'
          ELSE 'Bajo mínimo'
        END AS alertType
      FROM tbMaestroArticuloAlmacen ae
      LEFT JOIN tbMaestroArticulo a ON ae.IDArticulo = a.IDArticulo
      WHERE ISNULL(ae.StockFisico, 0) <= 0
        OR (ae.PuntoPedido > 0 AND ae.StockFisico < ae.PuntoPedido)
      ORDER BY ae.StockFisico ASC
    `, params),
    biQuery(`
      SELECT TOP (@limit)
        av.IDArticulo AS itemCode,
        ISNULL(a.DescArticulo, av.IDArticulo) AS description,
        COUNT(*) AS uses,
        ISNULL(SUM(av.QServida), 0) AS quantity,
        ISNULL(SUM(av.Importe), 0) AS amount,
        ISNULL(SUM(av.Importe * ISNULL(ti.Factor, 0) / 100), 0) AS vatAmount,
        ISNULL(SUM(av.Importe + (av.Importe * ISNULL(ti.Factor, 0) / 100)), 0) AS totalAmount
      FROM tbAlbaranVentaLinea av
      INNER JOIN tbAlbaranVentaCabecera ac ON av.IDAlbaran = ac.IDAlbaran
      LEFT JOIN tbMaestroArticulo a ON av.IDArticulo = a.IDArticulo
      LEFT JOIN tbMaestroTipoIva ti ON av.IDTipoIva = ti.IDTipoIva
      WHERE YEAR(ac.FechaAlbaran) = @year
        AND av.IDArticulo IS NOT NULL AND av.IDArticulo != ''
      GROUP BY av.IDArticulo, a.DescArticulo
      ORDER BY amount DESC
    `, params),
  ]);

  const revenue = money(financial.revenueNet);
  const revenueVat = money(financial.revenueVat);
  const previousRevenue = money(financial.previousRevenueNet);
  const previousRevenueVat = money(financial.previousRevenueVat);
  const variation = previousRevenue ? pct(((revenue - previousRevenue) / previousRevenue) * 100) : 0;
  const outOfStock = asNumber(warehouse.outOfStock);
  const lowStock = asNumber(warehouse.lowStock);
  const references = asNumber(warehouse.stockReferences);

  return {
    generatedAt: new Date().toISOString(),
    source: 'expertis-sqlserver',
    year,
    month,
    connection: normalizeRows([connection])[0],
    cards: {
      revenue,
      revenueVat,
      revenueTotal: money(financial.revenueTotal),
      previousRevenue,
      previousRevenueVat,
      previousRevenueTotal: money(financial.previousRevenueTotal),
      variation,
      invoices: asNumber(financial.invoices),
      customers: asNumber(financial.customers),
      quotes: asNumber(commercial.quotes),
      pipeline: money(commercial.quotedAmount),
      pipelineVat: money(commercial.quotedVat),
      workOrders: asNumber(operations.workOrders),
      technicians: asNumber(operations.activeTechnicians),
      stockReferences: references,
      stockAlerts: outOfStock + lowStock,
    },
    modules: [
      {
        id: 'financiero',
        label: 'Financiero',
        status: 'SQL activo',
        detail: `${asNumber(financial.invoices)} facturas, IVA ${money(revenueVat)} EUR.`,
        metrics: [
          { label: 'Facturación s/IVA', value: revenue, format: 'currency' },
          { label: 'IVA', value: revenueVat, format: 'currency' },
          { label: 'Variación anual', value: variation, format: 'percent' },
        ],
      },
      {
        id: 'comercial',
        label: 'Comercial',
        status: 'SQL activo',
        detail: `${asNumber(commercial.quotes)} presupuestos, IVA ${money(commercial.quotedVat)} EUR.`,
        metrics: [
          { label: 'Presupuestos', value: asNumber(commercial.quotes), format: 'number' },
          { label: 'Pipeline s/IVA', value: money(commercial.quotedAmount), format: 'currency' },
          { label: 'IVA', value: money(commercial.quotedVat), format: 'currency' },
        ],
      },
      {
        id: 'operaciones',
        label: 'Operaciones',
        status: 'SQL activo',
        detail: `${asNumber(operations.workOrders)} órdenes y ${asNumber(operations.activeTechnicians)} técnicos activos.`,
        metrics: [
          { label: 'Órdenes', value: asNumber(operations.workOrders), format: 'number' },
          { label: 'Técnicos', value: asNumber(operations.activeTechnicians), format: 'number' },
          { label: 'Clientes', value: asNumber(operations.servedCustomers), format: 'number' },
        ],
      },
      {
        id: 'almacen',
        label: 'Almacén',
        status: 'SQL activo',
        detail: `${references} referencias y ${outOfStock + lowStock} alertas de stock.`,
        metrics: [
          { label: 'Referencias', value: references, format: 'number' },
          { label: 'Sin stock', value: outOfStock, format: 'number' },
          { label: 'Bajo mínimo', value: lowStock, format: 'number' },
        ],
      },
    ],
    charts: {
      monthlyRevenue: normalizeRows(monthlyRevenue),
      monthlyQuotes: normalizeRows(monthlyQuotes),
    },
    tables: {
      topCustomers: normalizeRows(topCustomers),
      pendingReceivables: normalizeRows(pendingReceivables),
      technicians: normalizeRows(technicians),
      recentWorkOrders: normalizeRows(recentWorkOrders),
      stockAlerts: normalizeRows(stockAlerts),
      topParts: normalizeRows(topParts),
    },
  };
}

biRouter.get('/overview', async (req, res) => {
  if (!isBiSqlConfigured()) {
    return res.status(503).json({
      error: 'Conector BI SQL no configurado.',
      detail: 'Faltan BI_SQL_SERVER, BI_SQL_DATABASE, BI_SQL_USER o BI_SQL_PASSWORD en el entorno del backend.',
    });
  }

  try {
    const overview = await loadOverview(monthParams(req));
    return res.json({ data: overview });
  } catch (error) {
    console.error('BI SQL overview error', {
      message: error.message,
      code: error.code,
      number: error.number,
      state: error.state,
    });

    return res.status(500).json({
      error: 'No se pudieron cargar las métricas BI desde SQL Server.',
      detail: error.message,
    });
  }
});

biRouter.get('/connection', async (_req, res) => {
  const config = getBiSqlConfig();
  if (!config) {
    return res.status(503).json({
      error: 'Conector BI SQL no configurado.',
      configured: false,
    });
  }

  try {
    const row = await biOne(`
      SELECT
        @@SERVERNAME AS serverName,
        DB_NAME() AS databaseName,
        GETDATE() AS serverDate
    `);

    return res.json({
      configured: true,
      connected: true,
      data: normalizeRows([row])[0],
    });
  } catch (error) {
    return res.status(500).json({
      configured: true,
      connected: false,
      error: error.message,
    });
  }
});
