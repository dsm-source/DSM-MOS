import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { salesOrderFormSchema, type SalesOrderFormValues } from "../types";
import { useCustomers } from "@/features/customers/hooks/use-customers";

type Props = {
  defaultValues?: Partial<SalesOrderFormValues>;
  submitLabel: string;
  onSubmit: SubmitHandler<SalesOrderFormValues>;
  submitting?: boolean;
};

const EMPTY_ITEM = {
  item_name: "",
  drawing_number: "",
  quantity: 1,
  unit: "pcs",
  material_spec: "",
};

export function SalesOrderForm({
  defaultValues,
  onSubmit,
  submitLabel,
  submitting,
}: Props) {
  const { data: customers = [], isLoading: loadingCust } = useCustomers();

  const form = useForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues: {
      customer_id: defaultValues?.customer_id ?? "",
      order_date:
        defaultValues?.order_date ?? new Date().toISOString().slice(0, 10),
      due_date: defaultValues?.due_date ?? "",
      notes: defaultValues?.notes ?? "",
      items: defaultValues?.items?.length ? defaultValues.items : [EMPTY_ITEM],
    },
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const customerId = watch("customer_id");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5 md:col-span-3">
          <Label>Customer</Label>
          <Select
            value={customerId}
            onValueChange={(v) =>
              setValue("customer_id", v, { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={loadingCust ? "Memuat..." : "Pilih customer"}
              />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.customer_id && (
            <p className="text-xs text-destructive">
              {errors.customer_id.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Tanggal Order</Label>
          <Input type="date" {...register("order_date")} />
          {errors.order_date && (
            <p className="text-xs text-destructive">
              {errors.order_date.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Jatuh Tempo</Label>
          <Input type="date" {...register("due_date")} />
          {errors.due_date && (
            <p className="text-xs text-destructive">
              {errors.due_date.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <Label>Catatan</Label>
          <Input placeholder="Opsional" {...register("notes")} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Item</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append(EMPTY_ITEM)}
          >
            <Plus className="h-4 w-4 mr-1" /> Tambah item
          </Button>
        </div>

        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Nama Item</th>
                <th className="px-3 py-2 font-medium">No. Gambar</th>
                <th className="px-3 py-2 font-medium w-28">Qty</th>
                <th className="px-3 py-2 font-medium w-24">Satuan</th>
                <th className="px-3 py-2 font-medium">Spesifikasi Material</th>
                <th className="px-3 py-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={f.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <Input
                      {...register(`items.${i}.item_name`)}
                      placeholder="mis. Bracket AC-01"
                    />
                    {errors.items?.[i]?.item_name && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.items[i]?.item_name?.message}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      {...register(`items.${i}.drawing_number`)}
                      placeholder="DWG-..."
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      {...register(`items.${i}.quantity`, {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.items?.[i]?.quantity && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.items[i]?.quantity?.message}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input {...register(`items.${i}.unit`)} />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      {...register(`items.${i}.material_spec`)}
                      placeholder="mis. SPCC 1.2mm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(i)}
                      disabled={fields.length === 1}
                      aria-label="Hapus item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.items && typeof errors.items.message === "string" && (
          <p className="text-xs text-destructive">{errors.items.message}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
