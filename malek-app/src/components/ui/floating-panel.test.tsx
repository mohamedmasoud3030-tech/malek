// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { useRef, useState } from "react";
import { FloatingPanel } from "./floating-panel";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        data-floating-trigger
      >
        فتح
      </button>
      <FloatingPanel
        open={open}
        onOpenChange={setOpen}
        id="test-floating-panel"
        labelledBy="test-floating-title"
        triggerRef={triggerRef}
      >
        <h2 id="test-floating-title">أداة عائمة</h2>
        <button type="button" data-floating-first>
          إجراء
        </button>
      </FloatingPanel>
    </>
  );
}

describe("FloatingPanel — modeless global tool primitive", () => {
  it("labels the dialog, focuses its first control, and restores the trigger on outside close", async () => {
    const { container } = render(<Harness />);
    const trigger = container.querySelector<HTMLButtonElement>(
      "[data-floating-trigger]",
    );
    trigger?.focus();
    fireEvent.click(trigger as HTMLButtonElement);

    const panel = await waitFor(() =>
      document.querySelector<HTMLElement>("[data-floating-panel]"),
    );
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.getAttribute("aria-labelledby")).toBe("test-floating-title");
    await waitFor(() =>
      expect(
        document.activeElement?.getAttribute("data-floating-first"),
      ).toBeDefined(),
    );

    fireEvent.pointerDown(document.body);
    await waitFor(() =>
      expect(document.querySelector("[data-floating-panel]")).toBeNull(),
    );
    expect(document.activeElement).toBe(trigger);
  });

  it("closes with Escape without requiring a dedicated backdrop", async () => {
    render(<Harness />);
    const trigger = document.querySelector<HTMLButtonElement>(
      "[data-floating-trigger]",
    )!;
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(document.querySelector("[data-floating-panel]")).not.toBeNull(),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(document.querySelector("[data-floating-panel]")).toBeNull(),
    );
  });
});
