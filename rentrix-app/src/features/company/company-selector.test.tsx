// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CompanySelectorPage, CompanySwitcher } from './company-selector';

const mockSwitchCompany = vi.fn();
let mockUseCompany: () => {
  companies: { id: string; name: string; currency: string; locale: string }[];
  activeCompany: { id: string; name: string; currency: string; locale: string } | null;
  switchCompany: typeof mockSwitchCompany;
  hasMultipleCompanies: boolean;
};

vi.mock('@/hooks/use-company', () => ({
  useCompany: () => mockUseCompany(),
}));

const companies = [
  { id: 'c1', name: 'مكتب القاهرة', currency: 'EGP', locale: 'ar' },
  { id: 'c2', name: 'مكتب الإسكندرية', currency: 'EGP', locale: 'ar' },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CompanySelectorPage', () => {
  beforeEach(() => {
    mockUseCompany = () => ({
      companies,
      activeCompany: companies[0],
      switchCompany: mockSwitchCompany,
      hasMultipleCompanies: true,
    });
  });

  it('renders every company the user belongs to', () => {
    render(<CompanySelectorPage />);
    expect(screen.getByText('مكتب القاهرة')).toBeInTheDocument();
    expect(screen.getByText('مكتب الإسكندرية')).toBeInTheDocument();
  });

  it('marks the active company as selected', () => {
    render(<CompanySelectorPage />);
    const activeButton = screen.getByText('مكتب القاهرة').closest('button');
    expect(activeButton).toHaveClass('border-primary');
  });

  it('calls switchCompany with the chosen company id on click', () => {
    render(<CompanySelectorPage />);
    fireEvent.click(screen.getByText('مكتب الإسكندرية'));
    expect(mockSwitchCompany).toHaveBeenCalledWith('c2');
  });
});

describe('CompanySwitcher', () => {
  it('renders nothing for a single-company user', () => {
    mockUseCompany = () => ({
      companies: [companies[0]],
      activeCompany: companies[0],
      switchCompany: mockSwitchCompany,
      hasMultipleCompanies: false,
    });
    const { container } = render(<CompanySwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the active company and toggles the list on click', () => {
    mockUseCompany = () => ({
      companies,
      activeCompany: companies[0],
      switchCompany: mockSwitchCompany,
      hasMultipleCompanies: true,
    });
    render(<CompanySwitcher />);
    expect(screen.getByText('مكتب القاهرة')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('switches company and closes the list when another option is picked', () => {
    mockUseCompany = () => ({
      companies,
      activeCompany: companies[0],
      switchCompany: mockSwitchCompany,
      hasMultipleCompanies: true,
    });
    render(<CompanySwitcher />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('مكتب الإسكندرية'));
    expect(mockSwitchCompany).toHaveBeenCalledWith('c2');
  });
});
