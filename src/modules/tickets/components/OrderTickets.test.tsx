import { render,screen,waitFor } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { OrderTickets } from './OrderTickets';
afterEach(()=>vi.unstubAllGlobals());
describe('Entradas del pedido',()=>{
  it('muestra tres QR descargables y envía el token exclusivamente en el header',async()=>{
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({total:3,page:1,pageSize:24,tickets:[1,2,3].map(unitNumber=>({id:`t${unitNumber}`,unitNumber,status:'valid',eventName:'Concierto',ticketTypeName:'Platea',zone:'Norte',venue:'Recinto',date:null,seat:{row:'A',number:unitNumber},qrImage:`data:image/png;base64,a${unitNumber}`}))})});
    vi.stubGlobal('fetch',fetcher);
    render(<OrderTickets orderId="order-id" token="private-token"/>);
    await waitFor(()=>expect(screen.getAllByRole('img',{name:/Código QR/})).toHaveLength(3));
    expect(screen.getAllByRole('link',{name:'Descargar QR'})).toHaveLength(3);
    expect(screen.getByText('Fila A · Asiento 3')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('/api/checkout/order-id/tickets?page=1',expect.objectContaining({headers:{'x-order-token':'private-token'},cache:'no-store'}));
  });
  it('muestra un error sin inventar entradas cuando el pedido no es accesible',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:404}));
    render(<OrderTickets orderId="foreign-order"/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
