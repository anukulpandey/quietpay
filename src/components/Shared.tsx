import { ArrowUpRight, Check, LockKeyhole } from 'lucide-react';

export function Status({ value }: { value: string }) {
  const good = value === 'confirmed';
  const pending = value === 'submitting';
  return <span className={`status ${good ? 'good' : pending ? 'pending' : ''}`}>{good ? <Check size={12}/> : <span className="status-dot"/>}{value === 'confirmed' ? 'Paid' : value === 'ready' ? 'Ready' : value}</span>;
}
export function PrivacyNote() {
  return <div className="privacy-note"><LockKeyhole size={17}/><p>eERC hides balances and transfer amounts. Wallet addresses and timing remain public.</p></div>;
}
export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-link">{children}<ArrowUpRight size={15}/></a>;
}
