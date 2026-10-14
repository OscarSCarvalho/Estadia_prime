export default function Alerta({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-lg border border-erro/30 bg-erro-fundo px-4 py-3 text-sm text-erro">
      {children}
    </div>
  );
}
