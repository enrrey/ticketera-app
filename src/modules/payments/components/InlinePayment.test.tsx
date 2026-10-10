import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
import {InlinePayment} from './InlinePayment';
const mocked=vi.hoisted(()=>({confirm:vi.fn(async()=>({type:'error',error:{message:'Revisa tu tarjeta'}}))}));
vi.mock('@stripe/stripe-js',()=>({loadStripe:vi.fn(async()=>({}))}));
vi.mock('@stripe/react-stripe-js/checkout',()=>({CheckoutElementsProvider:({children}:{children:React.ReactNode})=>children,PaymentElement:()=> <div>Formulario seguro</div>,useCheckoutElements:()=>({type:'success',checkout:{confirm:mocked.confirm}})}));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
it('loads only an authorized secret and confirms through Stripe without handling card data',async()=>{
  vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','pk_test_placeholder');
  const fetch=vi.fn(async()=>new Response(JSON.stringify({clientSecret:'cs_test_secret_private'})));vi.stubGlobal('fetch',fetch);
  const user=userEvent.setup();render(<InlinePayment orderId="order" token="private"/>);
  await user.click(screen.getByRole('button',{name:'Pagar con Stripe'}));
  expect(await screen.findByText('Formulario seguro')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith('/api/checkout/order/payment/form',expect.objectContaining({headers:{'x-order-token':'private'},cache:'no-store'}));
  await user.click(screen.getByRole('button',{name:'Pagar entradas'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tu tarjeta');expect(mocked.confirm).toHaveBeenCalledTimes(1);
});
it('never opens payment once the reservation is disabled',()=>{
  render(<InlinePayment orderId="order" disabled/>);expect(screen.getByRole('button',{name:'Pagar con Stripe'})).toBeDisabled();
});
it('keeps invalid payment responses out of the SDK and displays a recoverable error',async()=>{
  vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','pk_test_placeholder');vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({url:'https://other.example/pay'}))));
  render(<InlinePayment orderId="order"/>);await userEvent.setup().click(screen.getByRole('button',{name:'Pagar con Stripe'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Respuesta de pago inválida');expect(screen.queryByText('Formulario seguro')).not.toBeInTheDocument();
});
