import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, children, onClose, wide = false, busy = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (event.target === ref.current && !busy) onClose(); }}>
    <div className="modal-header"><div><span className="eyebrow">QUIETPAY WORKSPACE</span><h2>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={20}/></button></div>
    {children}
  </dialog>;
}
