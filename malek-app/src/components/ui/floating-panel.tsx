import { createPortal } from "react-dom";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * A small, modeless dialog surface for global tools such as the assistant.
 *
 * This is intentionally source-owned rather than a page-local overlay. It
 * borrows the useful shadcn/Radix boundary — labelled dialog semantics,
 * escape handling, outside-dismissal and focus restoration — while leaving
 * placement and visual treatment to the caller. It is not a second route or
 * a second data owner.
 */
export type FloatingPanelProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  id: string;
  labelledBy: string;
  triggerRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  "aria-describedby"?: string;
}>;

export function FloatingPanel({
  open,
  onOpenChange,
  children,
  id,
  labelledBy,
  triggerRef,
  initialFocusRef,
  className,
  "aria-describedby": ariaDescribedBy,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
      previouslyFocusedRef.current = null;
      return undefined;
    }

    const activeElement = document.activeElement;
    previouslyFocusedRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;

    const focusFrame = window.requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>(focusableSelector) ??
        panelRef.current;
      target?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [initialFocusRef, onOpenChange, open, triggerRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-labelledby={labelledBy}
      aria-describedby={ariaDescribedBy}
      data-floating-panel
      data-state="open"
      tabIndex={-1}
      className={cn("outline-none", className)}
    >
      {children}
    </div>,
    document.body,
  );
}
