import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {RefundButton} from './RefundButton';
const refresh=vi.hoisted(()=>vi.fn());
vi.mock('next/navigation',()=>({useRouter:()=>({refresh})}));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it('requires confirmation before requesting a refund and refreshes the private tickets',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'pending'})});vi.stubGlobal('fetch',fetch);
  render(<RefundButton ticketId="ticket-one"/>);
  fireEvent.click(screen.getByRole('button',{name:'Solicitar reembolso'}));expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Confirmar devolución'}));
  await waitFor(()=>expect(refresh).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledWith('/api/tickets/ticket-one/refund',{method:'POST'});
});
it('shows the server eligibility failure without claiming a refund succeeded',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'Fuera del plazo de devolución'})}));
  render(<RefundButton ticketId="ticket-two"/>);fireEvent.click(screen.getByRole('button',{name:'Solicitar reembolso'}));fireEvent.click(screen.getByRole('button',{name:'Confirmar devolución'}));
  expect(await screen.findByRole('status')).toHaveTextContent('Fuera del plazo');expect(refresh).not.toHaveBeenCalled();
});
