'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceAccess } from './service-access';
import { readEquipmentWarranty } from './service-warranty';
import { getEquipmentDetails, saveEquipmentProfile, type Equipment } from './service-store';

const base = '/servicio-tecnico?vista=equipos';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function read(form: FormData, key: string, max = 120) {
  const value = form.get(key);
  return typeof value === 'string' && value.length <= max ? value.trim() : '';
}

export async function saveServiceEquipment(form: FormData) {
  if ((await getServiceAccess())?.role !== 'admin') redirect('/servicio-tecnico/login');

  const id = read(form, 'id', 36);
  const revision = read(form, 'revision', 36);
  const existing = form.get('existing') === 'yes';
  const detail = base + '&equipo=' + encodeURIComponent(id);
  const failure = existing ? detail : base + '&nuevoEquipo=1';
  if (!uuid.test(id) || (revision && !uuid.test(revision))) redirect(failure + '&errorEquipo=datos');
  const current = await getEquipmentDetails(id);
  if (Boolean(current.equipment) !== existing || current.revision !== revision) redirect(failure + '&errorEquipo=estado');

  const source = current.equipment;
  const customer_name = source?.customer_name || read(form, 'customer');
  const brand = read(form, 'brand');
  const model = read(form, 'model');
  const serial_number = read(form, 'serial');
  const location = read(form, 'location', 250);
  const refrigerant = read(form, 'refrigerant', 40);
  const rawCharge = form.get('charge');
  const charge = read(form, 'charge', 9).replace(',', '.');
  if (!customer_name || !brand || !model || !serial_number
    || (rawCharge && (!refrigerant || !/^\d{1,5}(?:\.\d{1,3})?$/.test(charge)))) redirect(failure + '&errorEquipo=datos');

  const warranty = form.get('warrantyForm') === '1' ? readEquipmentWarranty(form) : source?.warranty ?? null;
  if (warranty === undefined) redirect(failure + '&errorEquipo=garantia');

  const record: Equipment = {
    id, customer_name, id_cliente: source?.id_cliente ?? null, brand, model, serial_number, location, refrigerant,
    chargeGrams: charge ? Math.round(Number(charge) * 1000) : null,
    equipment_type: source?.equipment_type || null,
    normalized_phone: read(form, 'phone', 40) || null,
    warranty_until: source?.warranty_until || null, warranty: warranty ?? undefined,
  };
  if (!await saveEquipmentProfile(record, revision, randomUUID())) redirect(failure + '&errorEquipo=estado');
  revalidatePath('/servicio-tecnico');
  redirect(detail + '&guardadoEquipo=1');
}
