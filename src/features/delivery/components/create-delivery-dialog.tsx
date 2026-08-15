import { useState } from "react";
import { notifyError } from "@/lib/error-message";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateDelivery, useSalesOrdersForDelivery } from "../hooks/use-deliveries";

export function CreateDeliveryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const create = useCreateDelivery();
  const { data: sos = [], isLoading } = useSalesOrdersForDelivery();

  const [soId, setSoId] = useState<string>("");
  const [shipDate, setShipDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setSoId("");
    setShipDate("");
    setDeliveryDate("");
    setDriver("");
    setVehicle("");
    setNotes("");
  }

  async function submit() {
    if (!soId) {
      toast.error("Data belum valid", { description: "Pilih Sales Order" });
      return;
    }
    if (shipDate && deliveryDate && deliveryDate < shipDate) {
      toast.error("Data belum valid", {
        description: "Jadwal sampai tidak boleh sebelum jadwal kirim.",
      });
      return;
    }
    try {
      const id = await create.mutateAsync({
        sales_order_id: soId,
        planned_ship_date: shipDate || null,
        planned_delivery_date: deliveryDate || null,
        driver_name: driver.trim() || null,
        vehicle_number: vehicle.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Rencana pengiriman dibuat");
      reset();
      onOpenChange(false);
      navigate({ to: "/delivery/$id", params: { id } });
    } catch (e) {
      notifyError(e);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rencana Pengiriman Baru</DialogTitle>
          <DialogDescription>
            Catat rencana pengiriman internal — bukan dokumen surat jalan resmi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Sales Order</Label>
            <Select value={soId} onValueChange={setSoId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Memuat…" : "Pilih SO"} />
              </SelectTrigger>
              <SelectContent>
                {sos.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.so_number} · {s.customer?.name ?? "-"}
                  </SelectItem>
                ))}
                {sos.length === 0 && !isLoading && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Belum ada SO pada tahap QC/Delivery/Production.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ship">Jadwal kirim</Label>
              <Input
                id="ship"
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deliv">Jadwal sampai</Label>
              <Input
                id="deliv"
                type="date"
                value={deliveryDate}
                min={shipDate || undefined}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="driver">Nama driver</Label>
              <Input id="driver" value={driver} onChange={(e) => setDriver(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh">Nomor kendaraan</Label>
              <Input id="veh" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Buat Rencana
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
