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
