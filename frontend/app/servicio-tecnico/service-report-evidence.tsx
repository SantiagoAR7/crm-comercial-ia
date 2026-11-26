'use client';

import { useRef, useState, type ChangeEvent, type PointerEvent } from 'react';

const maxPhotos = 2;
const maxPhotoLength = 175000;

async function compressPhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error();
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.72, 0.55, 0.4, 0.25]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= maxPhotoLength) return data;
    }
    throw new Error();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ReportEvidence() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pointer = useRef<number | null>(null);
  const moved = useRef(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [signed, setSigned] = useState<{ name: string; signature: string }>();
  const [draftName, setDraftName] = useState('');
  const [draftSignature, setDraftSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function addPhotos(files: File[]) {
    if (!files.length) return;
    setMessage('');
    if (photos.length + files.length > maxPhotos || files.some(file => file.size > 15_000_000)) {
      setMessage('Puedes adjuntar hasta dos fotos de 15 MB cada una.');
      return;
    }
    setBusy(true);
    try {
      setPhotos([...photos, ...await Promise.all(files.map(compressPhoto))]);
    } catch {
      setMessage('No se pudo preparar una foto. Prueba con una imagen JPEG o PNG.');
    } finally {
      setBusy(false);
    }
  }

  function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    void addPhotos(files);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>, start: boolean) {
    const target = event.currentTarget;
    const context = target.getContext('2d');
    if (!context) return;
    const bounds = target.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * target.width / bounds.width;
    const y = (event.clientY - bounds.top) * target.height / bounds.height;
    if (start) {
      if (pointer.current !== null) return;
      target.setPointerCapture(event.pointerId);
      pointer.current = event.pointerId;
      moved.current = false;
      context.lineWidth = 3;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#172554';
      context.beginPath();
      context.moveTo(x, y);
    } else if (pointer.current === event.pointerId) {
      moved.current = true;
      context.lineTo(x, y);
      context.stroke();
    }
  }

  function finish(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (moved.current) setDraftSignature(event.currentTarget.toDataURL('image/png'));
  }

  function clear() {
    const target = canvas.current;
    target?.getContext('2d')?.clearRect(0, 0, target.width, target.height);
    setDraftSignature('');
  }

  function requestSignature() {
    clear();
    setDraftName('');
    dialog.current?.showModal();
  }

  function confirmSignature() {
    const name = draftName.trim();
    if (!name || !draftSignature) return;
    setSigned({ name, signature: draftSignature });
    dialog.current?.close();
  }

  return <div className="space-y-3">
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-semibold">Fotos del trabajo</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="relative block cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-blue-800">
          Tomar foto
          <input type="file" accept="image/*" capture="environment" disabled={busy || photos.length >= maxPhotos}
            className="sr-only" onChange={selectPhotos} />
        </label>
        <label className="relative block cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-blue-800">
          Elegir fotos
          <input type="file" accept="image/*" multiple disabled={busy || photos.length >= maxPhotos}
            className="sr-only" onChange={selectPhotos} />
        </label>
      </div>
      {busy && <p role="status" className="text-sm">Preparando fotos…</p>}
      {message && <p role="alert" className="text-sm text-amber-900">{message}</p>}
      <ul className="flex flex-wrap gap-3">
        {photos.map((photo, index) => <li key={index} className="space-y-1">
          <input type="hidden" name="reportPhoto" value={photo} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={`Foto ${index + 1} del trabajo`} className="h-20 w-24 rounded object-cover" />
          <button type="button" className="text-sm font-semibold text-blue-900 underline"
            onClick={() => setPhotos(photos.filter((_, position) => position !== index))}>Quitar foto {index + 1}</button>
        </li>)}
      </ul>
    </fieldset>
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-semibold">Firma del cliente</legend>
      {!signed ? <p className="text-sm text-slate-600">Si el cliente está presente, pídele que firme en tu teléfono antes de cerrar el parte.</p>
        : <p role="status" className="text-sm font-semibold text-green-800">Firma registrada de {signed.name}. Se incluirá al guardar el parte.</p>}
      <button type="button" className="rounded-lg border border-blue-950 px-3 py-2 text-sm font-semibold text-blue-950"
        onClick={requestSignature}>{signed ? 'Volver a pedir firma' : 'Pedir firma al cliente'}</button>
      {signed && <button type="button" className="ml-3 text-sm font-semibold text-blue-900 underline"
        onClick={() => setSigned(undefined)}>Quitar firma del parte</button>}
      <input type="hidden" name="reportSigner" value={signed?.name || ''} />
      <input type="hidden" name="reportSignature" value={signed?.signature || ''} />

      <dialog ref={dialog} aria-labelledby="signature-title"
        className="m-auto max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-xl backdrop:bg-slate-950/60">
        <div className="space-y-4">
          <h3 id="signature-title" className="text-lg font-bold">Firma del parte de trabajo</h3>
          <p id="signature-note" className="text-sm text-slate-700">Por favor, escribe tu nombre y firma con el dedo en el recuadro.</p>
          <label className="block text-sm font-semibold">Nombre de quien firma
            <input value={draftName} onChange={event => setDraftName(event.target.value)} maxLength={120}
              onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <canvas ref={canvas} width={480} height={200} aria-label="Firma manuscrita" aria-describedby="signature-note"
            className="block w-full touch-none rounded-lg border border-slate-400 bg-white"
            onPointerDown={event => draw(event, true)} onPointerMove={event => draw(event, false)}
            onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />
          <button type="button" className="text-sm font-semibold text-blue-900 underline" onClick={clear}>Borrar trazo</button>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              onClick={() => dialog.current?.close()}>Volver al parte</button>
            <button type="button" className="rounded-lg bg-blue-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={confirmSignature} disabled={!draftName.trim() || !draftSignature}>Confirmar firma</button>
          </div>
        </div>
      </dialog>
    </fieldset>
    <input type="hidden" name="reportEvidenceBusy" value={busy ? '1' : ''} />
  </div>;
}
