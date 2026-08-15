// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from './dropdown';

afterEach(() => cleanup());

const options = [
  { id: 'a', label: 'الخيار أ' },
  { id: 'b', label: 'الخيار ب' },
  { id: 'c', label: 'الخيار ج' },
];

describe('Dropdown focus contract (WCAG 2.4.3)', () => {
  it('returns focus to the trigger when an option is selected', async () => {
    const user = userEvent.setup();
    const onChange = () => undefined;
    render(<Dropdown options={options} onChange={onChange} placeholder="اختر..." />);

    const trigger = screen.getByRole('button', { name: 'اختر...' });
    await user.click(trigger);

    const option = screen.getByRole('option', { name: 'الخيار ب' });
    await user.click(option);

    expect(screen.queryByRole('option')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('returns focus to the trigger when Escape closes the menu from a focused option', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={options} onChange={() => undefined} placeholder="اختر..." />);

    const trigger = screen.getByRole('button', { name: 'اختر...' });
    await user.click(trigger);

    const option = screen.getByRole('option', { name: 'الخيار ج' });
    option.focus();
    expect(option).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('option')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('does not steal focus back on outside dismissal', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Dropdown options={options} onChange={() => undefined} placeholder="اختر..." />
        <button type="button">خارجي</button>
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'اختر...' });
    await user.click(trigger);
    expect(screen.getByRole('option', { name: 'الخيار أ' })).toBeInTheDocument();

    // Clicking elsewhere closes the menu and leaves focus on the clicked control.
    const outside = screen.getByRole('button', { name: 'خارجي' });
    await user.click(outside);

    expect(screen.queryByRole('option')).toBeNull();
    expect(outside).toHaveFocus();
  });
});
