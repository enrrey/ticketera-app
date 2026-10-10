import Link from 'next/link';
export function PurchasePolicies({privacy=false}:{privacy?:boolean}) {
  return <main className="page-shell mx-auto grid max-w-3xl gap-5 py-10"><Link href="/" className="underline">Volver a Ticketera</Link><h1 className="text-3xl font-semibold">{privacy?'Política de privacidad':'Términos de compra'}</h1><p className="text-sm text-muted-foreground">Versión 2026-10-09 · Entorno de desarrollo</p>{privacy?<>
    <p>Solicitamos nombre, correo, documento y celular para identificar la compra, comunicar sus resultados y atender solicitudes relacionadas con las entradas. El número de documento se almacena cifrado y no se incluye en el QR.</p>
    <p>Clerk gestiona el inicio de sesión. Stripe procesa los datos de tarjeta directamente; Ticketera no recibe ni guarda su número ni código de seguridad. Resend se utiliza para confirmaciones cuando el correo está configurado.</p>
    <p>El personal autorizado accede a los datos necesarios para gestionar eventos y entradas. No compartas el QR ni los enlaces privados de tus pedidos, porque permiten acceder a tus entradas.</p>
    <p>Antes de habilitar compras comerciales se completarán los datos del responsable, contacto para ejercer derechos y plazos de conservación de la versión publicada.</p>
  </>:<>
    <p>Comprueba el evento, sus fechas, sede, zona y asientos antes de reservar. Los importes se muestran en soles y el servidor valida precio y disponibilidad.</p>
    <p>La selección inicial bloquea un asiento durante 60 segundos. Una reserva de compra nueva dura 10 minutos. La entrada se emite únicamente después de confirmar el pago en el servidor; mostrar una pantalla de éxito no acredita por sí solo el cobro.</p>
    <p>Cada entrada tiene un QR de un solo uso para el evento. Las solicitudes de reembolso por entrada se admiten hasta 48 horas antes del inicio, sujetas a la validación de su estado. Si se cancela un evento, la devolución se procesa y concilia con Stripe.</p>
    <p>Las operaciones realizadas con credenciales de prueba no constituyen entradas con validez comercial. Esta versión de desarrollo debe completarse con los datos del proveedor y condiciones comerciales antes del lanzamiento.</p>
  </>}</main>;
}
