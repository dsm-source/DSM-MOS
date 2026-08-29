import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Rendered to the right of the title/description block (e.g. primary buttons). */
  actions?: ReactNode;
  /** Shows a back-arrow link before the title when provided. */
  backTo?: string;
  /** Alternative to backTo when the target isn't a plain route path. */
  onBack?: () => void;
  backLabel?: string;
  /** Extra class on the <h1> — e.g. "font-mono" for document numbers. */
  titleClassName?: string;
  /** Rendered inline after the title, on the same row (e.g. a status badge). */
  titleSuffix?: ReactNode;
};

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  onBack,
  backLabel = "Kembali",
  titleClassName,
  titleSuffix,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        {backTo ? (
          <Button variant="ghost" size="icon" asChild aria-label={backLabel}>
            <Link to={backTo}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        ) : onBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label={backLabel}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <div>
          <div className="flex items-center gap-2">
            <h1
              className={cn(
                "text-2xl font-semibold tracking-tight",
                titleClassName,
              )}
            >
              {title}
            </h1>
            {titleSuffix}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
