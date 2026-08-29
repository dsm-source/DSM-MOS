import { useState } from "react";
import { notifyError } from "@/lib/error-message";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MATERIAL_STATUSES,
  useUpdateMaterialStatus,
  type MaterialStatus,
  type MaterialWithContext,
} from "../hooks/use-material-statuses";

const schema = z.object({
  status: z.enum(["waiting_material", "partial_material", "material_ready"]),
  notes: z.string().max(2000).optional().nullable(),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  row: MaterialWithContext;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

export function EditMaterialDialog({ row, open, onOpenChange }: Props) {
  const update = useUpdateMaterialStatus();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: row.status, notes: row.notes ?? "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Status Material</DialogTitle>
          <DialogDescription>
            Job {row.engineering_job?.job_number} —{" "}
            {row.engineering_job?.sales_order_item?.item_name ?? "-"}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await update.mutateAsync({
                id: row.id,
                values: {
                  status: values.status as MaterialStatus,
                  notes: values.notes || null,
                },
              });
              toast.success("Status material diperbarui");
              onOpenChange(false);
            } catch (e) {
              notifyError(e, { title: "Gagal memperbarui" });
            }
          })}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue("status", v as MaterialStatus)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Catatan (kedatangan / kekurangan bahan)</Label>
            <Textarea rows={4} {...form.register("notes")} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={update.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MaterialCard({
  row,
  canEdit,
}: {
  row: MaterialWithContext;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const item = row.engineering_job?.sales_order_item;
  const so = item?.sales_order;
  return (
    <>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => canEdit && setOpen(true)}
        className="w-full text-left rounded-xl border bg-card p-3 hover:bg-accent/40 transition disabled:cursor-default disabled:hover:bg-card"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold truncate">
            {item?.item_name ?? "-"}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {row.engineering_job?.job_number}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground truncate">
          {so ? `${so.so_number} • ${so.customer?.name ?? "-"}` : "-"}
        </div>
        {item?.material_spec && (
          <div className="mt-1 text-xs truncate">
            <span className="text-muted-foreground">Spek:</span>{" "}
            {item.material_spec}
          </div>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          Qty: {item?.quantity ?? 0} {item?.unit ?? ""}
        </div>
        {row.notes && (
          <div className="mt-2 text-xs bg-muted/50 rounded p-2 line-clamp-3 whitespace-pre-wrap">
            {row.notes}
          </div>
        )}
      </button>
      {canEdit && open && (
        <EditMaterialDialog row={row} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
