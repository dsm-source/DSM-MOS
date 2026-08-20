import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOperators } from "@/features/operators/hooks/use-operators";

export function StepOperatorDialog({
  open,
  onOpenChange,
  title,
  confirmLabel = "Mulai",
  defaultOperatorId,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel?: string;
  defaultOperatorId?: string | null;
  isPending: boolean;
  onConfirm: (operatorId: string) => void;
}) {
  const { data: operators = [] } = useOperators();
  const activeOperators = operators.filter((o) => o.is_active);
  const [operatorId, setOperatorId] = useState<string>(defaultOperatorId ?? "");

  useEffect(() => {
    if (open) setOperatorId(defaultOperatorId ?? "");
  }, [open, defaultOperatorId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pilih operator yang mengerjakan tahapan ini.
          </DialogDescription>
        </DialogHeader>

        <Select value={operatorId} onValueChange={setOperatorId}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih operator..." />
          </SelectTrigger>
          <SelectContent>
            {activeOperators.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            disabled={!operatorId || isPending}
            onClick={() => onConfirm(operatorId)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
