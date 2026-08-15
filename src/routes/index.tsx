import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DSM MOS — Manufacturing Operating System" },
      {
        name: "description",
        content:
          "DSM MOS mengoordinasikan Sales Order, Engineering, Material, Production, QC, dan Delivery untuk pabrik sheet metal — satu sumber kebenaran, real-time.",
      },
      {
        property: "og:title",
        content: "DSM MOS — Manufacturing Operating System",
      },
      {
        property: "og:description",
        content:
          "Digitalisasi operasi manufaktur sheet metal dari pesanan masuk sampai barang terkirim.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setChecked(true);
      }
    });
  }, [navigate]);

  if (!checked) {
    return <div className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Manufacturing Operating System
        </p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight text-foreground">
          DSM MOS
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-lg mx-auto">
          Koordinasi Sales Order, Engineering, Material, Production, QC, dan
          Delivery untuk pabrik sheet metal — satu sistem, real-time, aturan
          bisnis ditegakkan di database.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Masuk</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
