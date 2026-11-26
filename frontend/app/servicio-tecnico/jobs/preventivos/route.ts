import { createHmac, timingSafeEqual } from 'node:crypto';
import { generateDailyPreventives } from '../../service-preventives';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.WORKFLOW_SESSION_SECRET;
  const time = request.headers.get('x-preventive-time') || '';
  const signature = request.headers.get('x-preventive-signature') || '';
  if (!secret || secret.length < 32 || !/^\d{13}$/.test(time)
    || Math.abs(Date.now() - Number(time)) > 60_000 || !/^[a-f0-9]{64}$/.test(signature)) {
    return Response.json({ error: 'Acceso denegado' }, { status: 401 });
  }
  const expected = createHmac('sha256', secret).update('davofrio:preventives:' + time).digest();
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), expected)) {
    return Response.json({ error: 'Acceso denegado' }, { status: 401 });
  }

  try {
    const totals = await generateDailyPreventives();
    return Response.json(totals, { status: totals.failed ? 503 : 200 });
  } catch (error) {
    console.error('No se pudo ejecutar la generación diaria de preventivos', error);
    return Response.json({ error: 'Generación no disponible' }, { status: 503 });
  }
}
