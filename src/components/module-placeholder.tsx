// NOTE (audit UI/UX Fase 1, Task 4): komponen ini tidak lagi di-import di mana pun
// — semua route modul sudah punya konten sendiri. Disimpan sementara, jangan hapus
// tanpa konfirmasi pemilik. Kandidat cleanup di iterasi berikutnya.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Modul ini belum dibangun. Fondasi sistem sudah siap — konten modul
            akan menyusul di iterasi berikutnya.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
