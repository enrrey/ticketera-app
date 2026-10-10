export function CheckoutProgress({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return <nav aria-label="Pasos de compra"><ol className="flex flex-wrap gap-3 text-sm">{["Entradas", "Datos y pago", "Confirmación"].map((label, index) => <li key={label} aria-current={currentStep === index + 1 ? "step" : undefined} className={currentStep === index + 1 ? "font-semibold text-primary" : "text-muted-foreground"}><span aria-hidden="true">{index + 1}. </span>{label}</li>)}</ol></nav>;
}
