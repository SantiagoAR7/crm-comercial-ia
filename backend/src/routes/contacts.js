import { Router } from 'express';
import { supabase } from '../services/supabase.js';

export const contactsRouter = Router();

contactsRouter.get('/', async (req, res) => {
  const {
    search = '',
    province = '',
    equipmentType = '',
    page = '1',
    pageSize = '50',
  } = req.query;

  const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const parsedPageSize = Math.min(
    Math.max(Number.parseInt(pageSize, 10) || 50, 1),
    500,
  );

  const from = (parsedPage - 1) * parsedPageSize;
  const to = from + parsedPageSize - 1;

  let query = supabase
    .from('installations')
    .select(
      'id,id_activo,id_cliente,customer_name,contact_name,normalized_phone,normalized_email,population,province,brand,model,equipment_type,active,updated_at',
      { count: 'exact' },
    )
    .contains('source_snapshot', { warranty_status: 'EN_GARANTIA' })
    .eq('active', true)
    .order('customer_name', { ascending: true })
    .range(from, to);

  if (province) {
    query = query.eq('province', province);
  }

  if (equipmentType) {
    query = query.eq('equipment_type', equipmentType);
  }

  if (search) {
    const safe = search.replaceAll(',', ' ');
    query = query.or(
      [
        `customer_name.ilike.%${safe}%`,
        `contact_name.ilike.%${safe}%`,
        `id_activo.ilike.%${safe}%`,
        `normalized_phone.ilike.%${safe}%`,
        `normalized_email.ilike.%${safe}%`,
      ].join(','),
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({
      error: 'No se pudieron obtener los contactos.',
      detail: error.message,
    });
  }

  return res.json({
    data,
    pagination: {
      page: parsedPage,
      pageSize: parsedPageSize,
      total: count ?? 0,
    },
  });
});
