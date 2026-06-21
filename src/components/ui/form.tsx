import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-[var(--radius)] border border-line bg-white px-4 py-3 text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent";

export function Field({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  /** Mark a field as optional with a visible "(optional)" label (a11y: not asterisk-only). */
  optional?: boolean;
  hint?: string;
  /** Inline error text. Rendered with id `${htmlFor}-error` so the input can
   *  reference it via aria-describedby; also announced via role="alert". */
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-1 text-xs font-normal text-muted">
            (required)<span className="text-accent-strong" aria-hidden> *</span>
          </span>
        )}
        {optional && <span className="ml-1 text-xs font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldBase, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldBase, "min-h-32 resize-y", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  // Keep the native dropdown chevron (no `appearance-none`) so the control reads
  // as a select across Chrome/Safari/Firefox/Edge; a reset with no replacement
  // caret made it look like a plain text box.
  return <select {...props} className={cn(fieldBase, "pr-9", props.className)} />;
}
