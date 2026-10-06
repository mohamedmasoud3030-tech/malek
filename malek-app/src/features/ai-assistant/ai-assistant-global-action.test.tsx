// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children?: ReactNode; to?: string }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./ai-assistant-page", () => ({
  AiAssistantPage: ({ embedded }: { embedded?: boolean }) => (
    <div data-ai-test-experience>{embedded ? "مدمج" : "كامل"}</div>
  ),
}));

import {
  AiAssistantGlobalAction,
  OPEN_AI_ASSISTANT_EVENT,
} from "./ai-assistant-global-action";

afterEach(cleanup);

describe("AiAssistantGlobalAction — shared global entry", () => {
  it("provides a labelled desktop trigger and restores focus after closing the panel", async () => {
    const { container } = render(
      <>
        <div data-header-ai-assistant-slot className="hidden md:inline-flex" />
        <AiAssistantGlobalAction showTrigger={false} showHeaderTrigger />
      </>,
    );

    const trigger = await waitFor(() => {
      const node = container.querySelector<HTMLButtonElement>(
        "[data-ai-assistant-trigger]",
      );
      expect(node).not.toBeNull();
      return node;
    });
    expect(trigger?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger?.getAttribute("aria-controls")).toBe(
      "malek-ai-assistant-panel",
    );

    trigger?.focus();
    fireEvent.click(trigger as HTMLButtonElement);
    const panel = await waitFor(() => {
      const node = document.querySelector<HTMLElement>("[data-floating-panel]");
      expect(node).not.toBeNull();
      return node;
    });
    expect(panel?.getAttribute("aria-labelledby")).toBe(
      "malek-ai-assistant-title",
    );
    await waitFor(() =>
      expect(
        document.querySelector("[data-ai-test-experience]"),
      ).not.toBeNull(),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(document.querySelector("[data-floating-panel]")).toBeNull(),
    );
    expect(document.activeElement).toBe(trigger);
  });

  it("restores whichever trigger opened the shared panel when inline and header triggers coexist", async () => {
    const { container } = render(
      <>
        <div data-header-ai-assistant-slot />
        <AiAssistantGlobalAction showTrigger showHeaderTrigger />
      </>,
    );

    const triggers = await waitFor(() => {
      const nodes = container.querySelectorAll<HTMLButtonElement>(
        "[data-ai-assistant-trigger]",
      );
      expect(nodes).toHaveLength(2);
      return nodes;
    });
    const inlineTrigger = triggers[1];
    inlineTrigger.focus();
    fireEvent.click(inlineTrigger);
    await waitFor(() =>
      expect(document.querySelector("[data-floating-panel]")).not.toBeNull(),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(document.querySelector("[data-floating-panel]")).toBeNull(),
    );
    expect(document.activeElement).toBe(inlineTrigger);
  });

  it("opens from the phone dock event without introducing a second assistant panel", async () => {
    render(<AiAssistantGlobalAction showTrigger={false} />);

    window.dispatchEvent(new Event(OPEN_AI_ASSISTANT_EVENT));
    const panel = await waitFor(() => {
      const node = document.querySelectorAll("[data-floating-panel]");
      expect(node).toHaveLength(1);
      return node[0];
    });
    expect(panel).not.toBeNull();
  });
});
