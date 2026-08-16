import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgeCheck, BadgeHelp, CircleAlert, OctagonAlert } from "lucide-react";

export type ConfirmationTone = "question" | "warning" | "caution";

type OperationalConfirmDialogProps = {
  open: boolean;
  tone: ConfirmationTone;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const toneStyles = {
  question: { icon: BadgeHelp, iconClass: "bg-[#e6f4ea] text-[#176148]", button: "bg-[#177458] hover:bg-[#0f6248]" },
  warning: { icon: CircleAlert, iconClass: "bg-[#fff2d9] text-[#a35e00]", button: "bg-[#bb7515] hover:bg-[#965b09]" },
  caution: { icon: OctagonAlert, iconClass: "bg-[#fee6e6] text-[#b82727]", button: "bg-[#b82727] hover:bg-[#951a1a]" },
} as const;

export function OperationalMessageDialog({ open, title, description, onClose, tone = "success" }: { open: boolean; title: string; description: string; onClose: () => void; tone?: "success" | "caution" }) {
  const isCaution = tone === "caution";
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
    <DialogContent className="max-w-md border-2 border-[#cbd9cf] bg-white p-6 sm:p-7">
      <DialogHeader className="items-center text-center"><div className={`mb-3 rounded-2xl p-4 ${isCaution ? "bg-[#fee6e6] text-[#b82727]" : "bg-[#e6f4ea] text-[#176148]"}`}>{isCaution ? <OctagonAlert className="h-9 w-9" /> : <BadgeCheck className="h-9 w-9" />}</div><DialogTitle className="text-2xl font-black text-[#173b2e]">{title}</DialogTitle><DialogDescription className="pt-1 text-base font-bold leading-relaxed text-[#617167]">{description}</DialogDescription></DialogHeader>
      <div className="mt-5"><Button onClick={onClose} className={`h-14 w-full text-base font-black ${isCaution ? "bg-[#b82727] hover:bg-[#951a1a]" : "bg-[#177458] hover:bg-[#0f6248]"}`}>Continuar</Button></div>
    </DialogContent>
  </Dialog>;
}

export function OperationalConfirmDialog({ open, tone, title, description, confirmLabel, cancelLabel = "Voltar", pending = false, onCancel, onConfirm }: OperationalConfirmDialogProps) {
  const style = toneStyles[tone];
  const Icon = style.icon;
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !pending) onCancel(); }}>
    <DialogContent className="max-w-md border-2 border-[#cbd9cf] bg-white p-6 sm:p-7">
      <DialogHeader className="items-center text-center"><div className={`mb-3 rounded-2xl p-4 ${style.iconClass}`}><Icon className="h-9 w-9" /></div><DialogTitle className="text-2xl font-black text-[#173b2e]">{title}</DialogTitle><DialogDescription className="pt-1 text-base font-bold leading-relaxed text-[#617167]">{description}</DialogDescription></DialogHeader>
      <div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" disabled={pending} onClick={onCancel} className="h-14 border-2 border-[#aebdb3] text-base font-black">{cancelLabel}</Button><Button disabled={pending} onClick={onConfirm} className={`h-14 text-base font-black ${style.button}`}>{pending ? "Confirmando…" : confirmLabel}</Button></div>
    </DialogContent>
  </Dialog>;
}
