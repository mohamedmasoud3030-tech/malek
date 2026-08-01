import React from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/hooks/use-auth';
import { canShowNavigationItem } from '@/features/auth/permissions';
import { workspaceChildNavItems } from '@/app/navigation/app-nav-items';

export interface WorkspaceSubNavProps {
  rootPath: string;
  className?: string;
}

/**
 * Secondary workspace navigation bar displaying child destinations for a top-level hub.
 * Preserves all routes, deep links, and permissions without cluttering the main sidebar.
 */
export function WorkspaceSubNav({ rootPath, className = '' }: WorkspaceSubNavProps) {
  const { authorization } = useAuth();
  const location = useLocation();
  const items = workspaceChildNavItems[rootPath] ?? [];

  const visibleItems = items.filter((item) =>
    canShowNavigationItem(authorization, item[4]),
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <nav
      className={`flex items-center gap-2 border-b border-border pb-3 overflow-x-auto ${className}`}
      aria-label="التنقل الداخلي لمساحة العمل"
    >
      <Link
        to={rootPath}
        aria-current={location.pathname === rootPath ? 'page' : undefined}
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
          location.pathname === rootPath
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        الرئيسية للمساحة
      </Link>
      {visibleItems.map(([to, labelKey, description, Icon]) => {
        const active = location.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              active
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{description.split(' ')[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
