"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./forms";
import { ReceiptPicker } from "./ReceiptPicker";
import { attachReceipt } from "@/lib/actions/money";

export function AttachReceipt({ eventId, replace }: { eventId: string; replace?: boolean }) {
  const [open, setOpen] = useState(!replace);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full py-3 text-[15px] font-600 text-ink-2">
        Cambiar comprobante
      </button>
    );
  }
  return (
    <ActionForm action={attachReceipt} className="space-y-3 p-4">
      <input type="hidden" name="eventId" value={eventId} />
      <ReceiptPicker />
      <SubmitButton className="w-full" variant="secondary">
        Guardar comprobante
      </SubmitButton>
    </ActionForm>
  );
}
