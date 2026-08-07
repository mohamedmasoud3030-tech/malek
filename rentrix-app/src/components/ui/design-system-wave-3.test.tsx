// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});
import { Alert } from './alert';
import { Badge, StatusBadgePill, statusPresets } from './badge';
import { Button } from './button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './card';
import { Input, inputVariants } from './input';
import { Spinner } from './spinner';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
} from './table';
import { TextField } from './text-field';
import { Typography } from './typography';

describe('Button (Wave 3)', () => {
  it('renders children and defaults to primary/md', () => {
    render(<Button>احفظ</Button>);
    const button = screen.getByRole('button', { name: 'احفظ' });
    expect(button).toBeTruthy();
    expect(button.className).toContain('bg-primary');
    expect(button).toHaveAttribute('data-ui-button');
    expect(button).toHaveAttribute('data-size', 'md');
  });

  it('supports every new variant without throwing', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'soft', 'success', 'warning', 'danger', 'link'] as const;
    for (const variant of variants) {
      expect(() => renderToStaticMarkup(<Button variant={variant}>{variant}</Button>)).not.toThrow();
    }
  });

  it('supports sizes xs and xl', () => {
    const { rerender } = render(<Button size="xs">x</Button>);
    expect(screen.getByRole('button').className).toContain('min-h-9');
    rerender(<Button size="xl">x</Button>);
    expect(screen.getByRole('button').className).toContain('min-h-12');
  });

  it('disables the button and marks it busy when loading', () => {
    render(<Button loading>حفظ</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg')).toBeTruthy();
    // screen-reader-only status text
    expect(button.textContent).toContain('جارٍ التنفيذ...');
  });

  it('honors the disabled prop', () => {
    render(<Button disabled>x</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies fullWidth', () => {
    render(<Button fullWidth>x</Button>);
    expect(screen.getByRole('button').className).toContain('w-full');
  });

  it('renders left and right icons as aria-hidden', () => {
    const { container } = render(
      <Button leftIcon={<span data-testid="l">L</span>} rightIcon={<span data-testid="r">R</span>}>
        حفظ
      </Button>,
    );
    const wrappers = container.querySelectorAll('button > span[aria-hidden="true"]');
    expect(wrappers.length).toBe(2);
  });

  it('receives keyboard focus with a visible focus ring class', () => {
    render(<Button>ركز علي</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/focus-visible:ring/);
  });

  it('merges custom classes via cn', () => {
    render(<Button className="custom-merge-class">x</Button>);
    expect(screen.getByRole('button').className).toContain('custom-merge-class');
    expect(screen.getByRole('button').className).toContain('bg-primary');
  });
});

describe('Input / TextField (Wave 3)', () => {
  it('renders the input with default state', () => {
    render(<Input aria-label="حقل" />);
    const input = screen.getByLabelText('حقل');
    expect(input).toBeTruthy();
    expect(input.className).toContain('border-input');
  });

  it('applies the error state and aria-invalid through TextField', () => {
    render(<TextField label="البريد" error="مطلوب" />);
    const input = screen.getByLabelText('البريد');
    expect(input.className).toContain('border-destructive');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert').textContent).toContain('مطلوب');
  });

  it('exposes a label, description, and accessible name', () => {
    render(<TextField label="الاسم" description="الاسم الكامل" />);
    const input = screen.getByLabelText('الاسم');
    expect(input).toBeTruthy();
    expect(screen.getByText('الاسم الكامل')).toBeTruthy();
  });

  it('disables and shows a loading spinner without losing label', () => {
    const { container } = render(<TextField label="محمل" loading />);
    const input = screen.getByLabelText('محمل');
    expect(input).toBeDisabled();
    // The spinner is present and its status wrapper is polite-live.
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
    expect(container.querySelector('svg.animate-spin')).toBeTruthy();
  });

  it('renders currency adornment', () => {
    render(<TextField label="المبلغ" currency="ر.ع" type="number" />);
    expect(screen.getByText('ر.ع')).toBeTruthy();
  });

  it('inputVariants resolves states', () => {
    expect(inputVariants({ state: 'error' })).toContain('border-destructive');
    expect(inputVariants({ state: 'success' })).toContain('border-success');
  });
});

describe('Card (Wave 3)', () => {
  it('renders the new additive variants', () => {
    const variants = ['default', 'muted', 'outlined', 'elevated', 'interactive', 'compact', 'statistic', 'financial'] as const;
    for (const variant of variants) {
      const html = renderToStaticMarkup(
        <Card variant={variant}>
          <CardHeader>
            <CardTitle>t</CardTitle>
            <CardDescription>d</CardDescription>
          </CardHeader>
          <CardContent>c</CardContent>
        </Card>,
      );
      expect(html).toContain('data-component-card');
    }
  });

  it('interactive variant has hover affordance', () => {
    render(<Card variant="interactive">c</Card>);
    expect(document.querySelector('[data-component-card]')?.className).toContain('hover:border-primary/40');
  });
});

describe('Badge (Wave 3)', () => {
  it('renders neutral variant and business status presets', () => {
    render(<Badge variant="neutral">محايد</Badge>);
    expect(screen.getByText('محايد').className).toContain('bg-neutral-bg');
    for (const status of Object.keys(statusPresets)) {
      expect(() => renderToStaticMarkup(<StatusBadgePill status={status as never} />)).not.toThrow();
    }
  });

  it('paid preset uses an icon + label and never color alone', () => {
    render(<StatusBadgePill status="paid" />);
    const badge = screen.getByText('مدفوع').closest('span');
    expect(badge?.querySelector('svg')).toBeTruthy();
  });
});

describe('Table (Wave 3)', () => {
  it('renders caption and selected row', () => {
    const { container } = render(
      <Table>
        <TableCaption>جدول</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>أ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow selected>
            <TableCell>1</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('caption')?.textContent).toContain('جدول');
    expect(container.querySelector('[data-selected="true"]')).toBeTruthy();
  });

  it('TableLoading is screen-reader safe', () => {
    render(
      <table>
        <TableLoading columns={2} rows={2} />
      </table>,
    );
    const live = screen.getByRole('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
  });

  it('TableEmpty spans columns and shows an action', () => {
    render(
      <table>
        <TableEmpty colSpan={3} title="فارغ" action={<button>أضف</button>} />
      </table>,
    );
    expect(screen.getByText('فارغ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'أضف' })).toBeTruthy();
  });
});

describe('Alert + Spinner (Wave 3)', () => {
  it('danger alert uses role=alert and renders title', () => {
    render(<Alert variant="danger" title="خطأ" description="فشل" />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('خطأ');
    expect(alert.querySelector('svg')).toBeTruthy();
  });

  it('spinner has an accessible sr-only label', () => {
    render(<Spinner label="تحميل" />);
    expect(screen.getByRole('status').textContent).toContain('تحميل');
  });
});

describe('Typography (Wave 3)', () => {
  it('renders every variant with the data attribute', () => {
    const variants = ['display', 'h1', 'h2', 'h3', 'body', 'caption', 'mono'] as const;
    for (const variant of variants) {
      const { container } = render(<Typography variant={variant}>{variant}</Typography>);
      expect(container.querySelector(`[data-typography="${variant}"]`)).toBeTruthy();
    }
  });
});

describe('RTL-safe rendering', () => {
  it('logical-property classes are used (no hard left/right margins)', () => {
    const html = renderToStaticMarkup(
      <Button leftIcon={<span />} rightIcon={<span />}>حفظ</Button>,
    );
    // Buttons/icons must not rely on physical pl-/pr-; gap handles spacing.
    expect(html).not.toMatch(/\bpl-|\bpr-/);
  });
});

describe('keyboard focus behavior', () => {
  it('button is focusable and shows focus ring', async () => {
    render(<Button>ركز</Button>);
    const button = screen.getByRole('button');
    await userEvent.tab();
    expect(button).toHaveFocus();
    expect(button.className).toMatch(/focus-visible/);
  });
});
