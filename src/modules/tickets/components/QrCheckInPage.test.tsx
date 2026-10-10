import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QrCheckInPage } from './QrCheckInPage';

const decoder = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn() }));
vi.mock('@zxing/browser', () => ({ BrowserQRCodeReader: class { decodeFromConstraints = decoder.decode; } }));
const events = [{ slug: 'festival/2026', name: 'Festival', status: 'published' }, { slug: 'otro', name: 'Otro evento', status: 'published' }];
const response = (code: string, message: string) => ({ status: code === 'accepted' ? 200 : 409, json: async () => ({ code, message }) });

beforeEach(() => { decoder.decode.mockReset(); decoder.stop.mockReset(); decoder.decode.mockResolvedValue({ stop: decoder.stop }); });
afterEach(() => vi.unstubAllGlobals());

describe('Check-in con QR', () => {
  it('solo envía el código al confirmar, al endpoint del evento y sin exponerlo en la URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(response('accepted', 'Entrada validada.'));
    vi.stubGlobal('fetch', fetcher);
    render(<QrCheckInPage events={events} />);
    fireEvent.change(screen.getByLabelText('Código de la entrada'), { target: { value: 'opaque-private-code' } });
    expect(fetcher).not.toHaveBeenCalled();
    expect(decoder.decode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Validar entrada' }));
    expect(await screen.findByText('Ingreso registrado')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/events/festival%2F2026/check-in', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: JSON.stringify({ credential: 'opaque-private-code' }) }));
  });

  it('no confirma el ingreso antes del servidor y bloquea un envío repetido', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    const fetcher = vi.fn().mockReturnValue(new Promise(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetcher);
    render(<QrCheckInPage events={events} />);
    fireEvent.change(screen.getByLabelText('Código de la entrada'), { target: { value: 'code' } });
    const button = screen.getByRole('button', { name: 'Validar entrada' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ingreso registrado')).not.toBeInTheDocument();
    await act(async () => resolve(response('already_used', 'Esta entrada ya ingresó.')));
    expect(screen.getByText('Entrada ya utilizada')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('border-amber-600');
  });

  it('una falla de red queda sin confirmar y permite reintentar el mismo código', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(response('already_used', 'Ya registrada.'));
    vi.stubGlobal('fetch', fetcher);
    render(<QrCheckInPage events={events} />);
    fireEvent.change(screen.getByLabelText('Código de la entrada'), { target: { value: 'retry-code' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar entrada' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('la entrada podría haberse registrado');
    expect(screen.queryByText('Ingreso rechazado')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar confirmación' }));
    expect(await screen.findByText('Entrada ya utilizada')).toBeInTheDocument();
    expect(fetcher.mock.calls[1][1].body).toBe(JSON.stringify({ credential: 'retry-code' }));
  });

  it('muestra el rechazo del servidor y permite cambiar de evento sin retener el código', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('invalid', 'La entrada pertenece a otro evento.')));
    render(<QrCheckInPage events={events} />);
    fireEvent.change(screen.getByLabelText('Código de la entrada'), { target: { value: 'wrong-event' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar entrada' }));
    expect(await screen.findByText('Ingreso rechazado')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('border-red-600');
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'otro' } });
    expect(screen.getByLabelText('Código de la entrada')).toHaveValue('');
    expect(screen.queryByText('Ingreso rechazado')).not.toBeInTheDocument();
  });

  it.each([401, 403, 503])('un error HTTP %s muestra el error sin inventar un resultado de entrada', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, json: async () => ({ error: 'Acceso o servicio no disponible.' }) }));
    render(<QrCheckInPage events={events} />);
    fireEvent.change(screen.getByLabelText('Código de la entrada'), { target: { value: 'private-code' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar entrada' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso o servicio no disponible.');
    expect(screen.queryByText('Ingreso registrado')).not.toBeInTheDocument();
    expect(screen.queryByText('Ingreso rechazado')).not.toBeInTheDocument();
  });

  it('escanea una sola vez, detiene la cámara y valida el QR leído', async () => {
    const fetcher = vi.fn().mockResolvedValue(response('accepted', 'Validada.'));
    vi.stubGlobal('fetch', fetcher);
    render(<QrCheckInPage events={events} />);
    fireEvent.click(screen.getByRole('button', { name: 'Activar cámara' }));
    await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1));
    expect(decoder.decode.mock.calls[0][0]).toEqual({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const callback = decoder.decode.mock.calls[0][2];
    await act(async () => {
      callback({ getText: () => 'camera-code' }, undefined, { stop: decoder.stop });
      callback({ getText: () => 'camera-code' }, undefined, { stop: decoder.stop });
    });
    expect(decoder.stop).toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify({ credential: 'camera-code' }));
    expect(screen.getByLabelText('Vista de la cámara')).not.toBeVisible();
  });

  it('detiene también una cámara que termina de abrir después de cancelar', async () => {
    let resolve!: (controls: { stop: typeof decoder.stop }) => void;
    decoder.decode.mockImplementation(() => new Promise(done => { resolve = done; }));
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<QrCheckInPage events={events} />);
    fireEvent.click(screen.getByRole('button', { name: 'Activar cámara' }));
    await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Detener cámara' }));
    const stopTrack = vi.fn();
    const video = screen.getByLabelText('Vista de la cámara') as HTMLVideoElement;
    video.srcObject = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    await act(async () => resolve({ stop: decoder.stop }));
    expect(decoder.stop).toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    await act(async () => decoder.decode.mock.calls[0][2]({ getText: () => 'late-code' }, undefined, { stop: decoder.stop }));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('detiene la cámara al cambiar de evento y al desmontar', async () => {
    const { unmount } = render(<QrCheckInPage events={events} />);
    fireEvent.click(screen.getByRole('button', { name: 'Activar cámara' }));
    await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'otro' } });
    expect(decoder.stop).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Activar cámara' }));
    await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(2));
    unmount();
    expect(decoder.stop).toHaveBeenCalledTimes(2);
  });

  it('con cámara denegada mantiene disponible la validación manual', async () => {
    decoder.decode.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    render(<QrCheckInPage events={events} />);
    fireEvent.click(screen.getByRole('button', { name: 'Activar cámara' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Permiso de cámara denegado');
    expect(screen.getByLabelText('Código de la entrada')).toBeEnabled();
  });

  it('sin eventos no ofrece cámara ni envíos', () => {
    render(<QrCheckInPage events={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('No tienes eventos');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(decoder.decode).not.toHaveBeenCalled();
  });
});
