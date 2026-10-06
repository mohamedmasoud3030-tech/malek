import { describe, expect, it } from 'vitest';
import { resolveActionMenuPlacement } from './action-menu';

const VIEWPORT = { width: 375, height: 800 };
const MENU = { width: 176, height: 160 };

describe('ActionMenu placement', () => {
  it('keeps the menu below the trigger when the space exists', () => {
    const placement = resolveActionMenuPlacement({
      trigger: { top: 100, bottom: 144, left: 180, right: 355 },
      menu: MENU,
      viewport: VIEWPORT,
    });
    expect(placement.placeAbove).toBe(false);
    expect(placement.top).toBe(148);
    expect(placement.maxHeight).toBeGreaterThan(MENU.height);
  });

  it('flips above a trigger near the bottom so the last item stays reachable', () => {
    const placement = resolveActionMenuPlacement({
      trigger: { top: 700, bottom: 744, left: 180, right: 355 },
      menu: MENU,
      viewport: VIEWPORT,
    });
    expect(placement.placeAbove).toBe(true);
    // Bottom edge of the menu sits four pixels above the trigger.
    expect(placement.top + MENU.height).toBe(696);
    // Nothing is pushed past the top edge of the viewport.
    expect(placement.top).toBeGreaterThanOrEqual(8);
  });

  it('caps the height to the room that exists when neither side fits', () => {
    const placement = resolveActionMenuPlacement({
      trigger: { top: 380, bottom: 424, left: 180, right: 355 },
      menu: { width: MENU.width, height: 700 },
      viewport: VIEWPORT,
    });
    expect(placement.maxHeight).toBeLessThan(700);
    // The visible box stays fully inside the viewport, so its tail is scrollable
    // rather than stranded below the fold.
    expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(VIEWPORT.height - 8);
    expect(placement.top).toBeGreaterThanOrEqual(8);
  });

  it('clamps a start-aligned menu inside a narrow viewport', () => {
    const placement = resolveActionMenuPlacement({
      trigger: { top: 100, bottom: 144, left: 360, right: 375 },
      menu: MENU,
      viewport: VIEWPORT,
      align: 'start',
    });
    expect(placement.left).toBeDefined();
    expect(placement.left! + MENU.width).toBeLessThanOrEqual(VIEWPORT.width - 8);
  });

  it('keeps a centered anchor inside the viewport on both sides', () => {
    const placement = resolveActionMenuPlacement({
      trigger: { top: 100, bottom: 144, left: 0, right: 40 },
      menu: MENU,
      viewport: VIEWPORT,
      align: 'center',
    });
    // The component translates a centered menu by half its width.
    expect(placement.left! - MENU.width / 2).toBeGreaterThanOrEqual(8);
  });

  it('anchors an end-aligned menu to the trigger edge without negative insets', () => {
    const flush = resolveActionMenuPlacement({
      trigger: { top: 100, bottom: 144, left: 300, right: 375 },
      menu: MENU,
      viewport: VIEWPORT,
      align: 'end',
    });
    expect(flush.right).toBe(8);
    expect(flush.left).toBeUndefined();

    const inset = resolveActionMenuPlacement({
      trigger: { top: 100, bottom: 144, left: 260, right: 330 },
      menu: MENU,
      viewport: VIEWPORT,
      align: 'end',
    });
    expect(inset.right).toBe(VIEWPORT.width - 330);
  });
});
