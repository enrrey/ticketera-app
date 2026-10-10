import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MyTicketsPage } from './MyTicketsPage';
import type { OwnTicket } from '@/modules/tickets';
const list=vi.hoisted(()=>vi.fn());
vi.mock('@/modules/tickets/server',()=>({listOwnTickets:list}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock('next/image',()=>({default:({alt}:{alt:string})=><span role="img" aria-label={alt}/> }));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const ticket:OwnTicket={id:'ticket-1',orderId:'order-1',unitNumber:1,status:'valid',eventName:'Concierto real',ticketTypeName:'General',zone:'General',venue:'Teatro',date:'2026-11-01T20:00:00Z',sessions:[{id:'session-1',startsAt:'2026-11-01T20:00:00Z'}],seat:null,qrImage:'data:image/png;base64,valid'};
it('renders each real ticket with session, QR download, state and purchase link',async()=>{
  list.mockResolvedValue({tickets:[ticket,{...ticket,id:'ticket-2',status:'refund_pending',qrImage:null}],total:25,page:1,pageSize:24});
  render(await MyTicketsPage({userId:'owner'}));
  expect(list).toHaveBeenCalledWith('owner',1);
  expect(screen.getAllByText('Concierto real')).toHaveLength(2);
  expect(screen.getByText('Reembolso pendiente')).toBeInTheDocument();
  expect(screen.getAllByLabelText('Sesiones incluidas')).toHaveLength(2);
  expect(screen.getByRole('img')).toHaveAccessibleName('Código QR de la entrada 1 para Concierto real');
  expect(screen.getByText('Descargar QR')).toHaveAttribute('download','entrada-ticket-1.png');
  expect(screen.getAllByText('Ver compra')[0]).toHaveAttribute('href','/pedidos/order-1');
  expect(screen.getByText('Siguiente')).toHaveAttribute('href','/mis-entradas?page=2');
  expect(screen.queryByText('Datos personales')).not.toBeInTheDocument();
});
it('shows the empty state explaining verified guest ownership',async()=>{
  list.mockResolvedValue({tickets:[],total:0,page:1,pageSize:24});
  render(await MyTicketsPage({userId:'owner'}));
  expect(screen.getByText('Todavía no tienes entradas')).toBeInTheDocument();
  expect(screen.getByText(/mismo correo verificado/)).toBeInTheDocument();
});
it('shows a recoverable error without private credentials',async()=>{
  list.mockRejectedValue(new Error('private secret'));
  render(await MyTicketsPage({userId:'owner',page:2}));
  expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tus entradas');
  expect(screen.getByText('Reintentar')).toHaveAttribute('href','/mis-entradas?page=2');
  expect(screen.queryByText('private secret')).not.toBeInTheDocument();
});
