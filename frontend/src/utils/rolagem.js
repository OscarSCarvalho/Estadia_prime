// Rolagem suave só para quem não pediu menos movimento no sistema (o CSS não alcança o scrollTo do JS)
export function comportamentoRolagem() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export function rolarParaOTopo() {
  window.scrollTo({ top: 0, behavior: comportamentoRolagem() });
}
