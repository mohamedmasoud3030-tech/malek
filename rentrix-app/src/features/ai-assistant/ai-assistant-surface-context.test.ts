import { describe, expect, it } from 'vitest';
import { deriveAiAssistantSurfaceContext, EMPTY_AI_SURFACE_CONTEXT } from './ai-assistant-surface-context';

const uuid = '018f4f36-7c7a-7c2a-8b1d-2c3d4e5f6071';
const otherUuid = '028f4f36-7c7a-7c2a-8b1d-2c3d4e5f6072';

describe('deriveAiAssistantSurfaceContext', () => {
  it('detects the property detail surface', () => {
    expect(deriveAiAssistantSurfaceContext(`/properties/${uuid}`)).toEqual({
      route: `/properties/${uuid}`,
      entityType: 'property',
      entityId: uuid,
      entityLabel: null,
      section: 'properties',
    });
  });

  it('keeps the property as the entity on its units list', () => {
    const context = deriveAiAssistantSurfaceContext(`/properties/${uuid}/units`);
    expect(context.entityType).toBe('property');
    expect(context.entityId).toBe(uuid);
  });

  it('detects the canonical unit detail surface (/properties/:pid/units/:unitId)', () => {
    const context = deriveAiAssistantSurfaceContext(`/properties/${uuid}/units/${otherUuid}`);
    expect(context.entityType).toBe('unit');
    expect(context.entityId).toBe(otherUuid);
    expect(context.section).toBe('properties');
  });

  it('detects contract, tenant, owner, and person detail surfaces with their owning sections', () => {
    expect(deriveAiAssistantSurfaceContext(`/contracts/${uuid}`)).toMatchObject({ entityType: 'contract', entityId: uuid, section: 'contracts' });
    expect(deriveAiAssistantSurfaceContext(`/tenants/${uuid}`)).toMatchObject({ entityType: 'tenant', entityId: uuid, section: 'tenants' });
    expect(deriveAiAssistantSurfaceContext(`/owners/${uuid}`)).toMatchObject({ entityType: 'owner', entityId: uuid, section: 'owners' });
    expect(deriveAiAssistantSurfaceContext(`/people/${uuid}`)).toMatchObject({ entityType: 'person', entityId: uuid, section: 'people' });
  });

  it('drops unsafe or non-entity ids and degrades to section-only context', () => {
    for (const route of [
      '/properties/new',
      '/contracts/new',
      `/properties/${'x'.repeat(200)}`,
      '/properties/%3Cscript%3E',
      '/properties/id with spaces',
      "/properties/1;drop table users",
    ]) {
      const context = deriveAiAssistantSurfaceContext(route);
      expect(context.entityType).toBeNull();
      expect(context.entityId).toBeNull();
    }
  });

  it('does not treat edit segments as unit entities', () => {
    // /properties/:pid/edit keeps the property focus.
    const context = deriveAiAssistantSurfaceContext(`/properties/${uuid}/edit`);
    expect(context.entityType).toBe('property');
    expect(context.entityId).toBe(uuid);
  });

  it('maps operational registers back to their canonical owning sections', () => {
    expect(deriveAiAssistantSurfaceContext('/dashboard')).toMatchObject({ entityType: null, entityId: null, section: 'dashboard' });
    for (const route of ['/financials', '/finance/collections', '/invoices', '/receipts', '/arrears', '/expenses', '/deposits', '/owner-settlements']) {
      expect(deriveAiAssistantSurfaceContext(route)).toMatchObject({ entityType: null, entityId: null, section: 'financials' });
    }
    expect(deriveAiAssistantSurfaceContext('/maintenance')).toMatchObject({ section: 'maintenance' });
    expect(deriveAiAssistantSurfaceContext('/utilities')).toMatchObject({ section: 'maintenance' });
    expect(deriveAiAssistantSurfaceContext('/communication')).toMatchObject({ section: 'communication' });
    expect(deriveAiAssistantSurfaceContext('/reports')).toMatchObject({ section: 'reports' });
  });

  it('degrades safely on unknown routes and the general assistant route', () => {
    expect(deriveAiAssistantSurfaceContext('/ai-assistant')).toEqual({
      route: '/ai-assistant',
      entityType: null,
      entityId: null,
      entityLabel: null,
      section: null,
    });
    expect(deriveAiAssistantSurfaceContext('/definitely/not/a/route')).toMatchObject({ entityType: null, entityId: null, section: null });
    expect(deriveAiAssistantSurfaceContext('')).toEqual({ ...EMPTY_AI_SURFACE_CONTEXT });
    expect(deriveAiAssistantSurfaceContext('/')).toMatchObject({ route: '/', entityType: null });
  });
});
