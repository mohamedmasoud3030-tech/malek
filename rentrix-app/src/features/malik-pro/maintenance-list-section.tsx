/*
 * ============================================
 * MALIK PRO - Maintenance Requests List
 * إدارة طلبات الصيانة والتشغيل
 * ============================================
 */

import { useState } from 'react';
import {
  Wrench, 
  Building2, 
  User, 
  AlertTriangle,
  Clock,
  CheckCircle2,
  Eye,
  Edit,
  Plus,
  Flame,
} from 'lucide-react';
import {
  MalikCard,
  MalikCardHeader,
  MalikCardContent,
  MalikButton,
  MalikTabs,
  MalikFilterTabs,
  MalikStatusBadge,
  MalikBadge,
  MalikInfoCard,
  MalikEmptyState,
  MalikLoadingState,
} from '@/components/malik-pro';
import type { Property, Unit } from '@/types/domain';

// ── Types ──
export interface MaintenanceRequest {
  id: string;
  request_number: string;
  title: string;
  description?: string;
  property_id: string;
  unit_id?: string;
  complainant_name: string;
  maintenance_type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  estimated_cost?: number;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceListSectionProps {
  requests: MaintenanceRequest[];
  properties: Property[];
  units: Unit[];
  loading?: boolean;
  onViewDetails: (request: MaintenanceRequest) => void;
  onEdit: (request: MaintenanceRequest) => void;
  onStatusAction: (request: MaintenanceRequest, status: string) => void;
  onCreateNew: () => void;
}

// ── Maintenance Type Labels ──
const maintenanceTypeLabels: Record<string, string> = {
  ac: 'تكييف وتبريد',
  plumbing: 'سباكة',
  electrical: 'كهرباء',
  structural: 'إنشائي',
  pest_control: 'مكافحة حشرات',
  cleaning: 'تنظيف',
  other: 'أخرى',
};

const statusConfig = {
  open: { label: 'مفتوح', variant: 'info' as const, icon: AlertTriangle },
  in_progress: { label: 'قيد التنفيذ', variant: 'warning' as const, icon: Clock },
  resolved: { label: 'تم الحل', variant: 'success' as const, icon: CheckCircle2 },
  closed: { label: 'مغلق', variant: 'neutral' as const, icon: CheckCircle2 },
};

const priorityConfig = {
  low: { label: 'منخفضة', variant: 'neutral' as const },
  medium: { label: 'متوسطة', variant: 'info' as const },
  high: { label: 'عالية', variant: 'warning' as const },
  urgent: { label: 'عاجلة', variant: 'danger' as const },
};

// ── Maintenance Request Card ──
function MaintenanceRequestCard({
  request,
  properties,
  units,
  onViewDetails,
  onEdit,
  onStatusAction,
}: {
  request: MaintenanceRequest;
  properties: Property[];
  units: Unit[];
  onViewDetails: (r: MaintenanceRequest) => void;
  onEdit: (r: MaintenanceRequest) => void;
  onStatusAction: (r: MaintenanceRequest, status: string) => void;
}) {
  const property = properties.find((p) => p.id === request.property_id);
  const unit = units.find((u) => u.id === request.unit_id);
  const status = statusConfig[request.status];
  const priority = priorityConfig[request.priority];

  const isUrgent = request.priority === 'urgent';
  const isOpen = request.status === 'open';
  const isInProgress = request.status === 'in_progress';
  const isCompleted = request.status === 'resolved' || request.status === 'closed';

  return (
    <div
      data-malik-maintenance-card
      className="relative overflow-hidden rounded-xl border border-[hsl(var(--malik-border))] bg-[hsl(var(--malik-card))] shadow-[var(--malik-shadow-card)] transition-all duration-200 hover:shadow-[var(--malik-shadow-card-hover)]"
    >
      {/* Accent Bar */}
      <div
        data-malik-maintenance-card-accent
        className={
          isUrgent
            ? 'bg-gradient-to-b from-[hsl(var(--malik-danger))] to-[hsl(var(--malik-warning))]'
            : 'bg-gradient-to-b from-[hsl(var(--malik-primary))] to-[hsl(var(--malik-secondary))]'
        }
      />

      <div className="p-4 pr-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[hsl(var(--malik-foreground-muted))]">
                {request.request_number}
              </span>
              {isUrgent && (
                <MalikBadge variant="danger" size="sm">
                  <Flame className="size-3" />
                  عاجل جداً
                </MalikBadge>
              )}
            </div>
            <h3 className="text-sm font-bold text-[hsl(var(--malik-foreground))] truncate">
              {request.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <MalikStatusBadge status={request.status} />
            <MalikStatusBadge status={request.priority} />
          </div>
        </div>

        {/* Type Badge */}
        <div className="mb-3">
          <MalikBadge variant="secondary" size="sm">
            {maintenanceTypeLabels[request.maintenance_type] || request.maintenance_type}
          </MalikBadge>
        </div>

        {/* Description */}
        {request.description && (
          <p className="text-xs text-[hsl(var(--malik-foreground-muted))] line-clamp-2 mb-3">
            {request.description}
          </p>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-2 p-2 bg-[hsl(var(--malik-muted))] rounded-lg">
            <Building2 className="size-4 text-[hsl(var(--malik-primary))]" />
            <div className="min-w-0">
              <p className="text-[10px] text-[hsl(var(--malik-foreground-muted))]">العقار</p>
              <p className="text-xs font-bold truncate">
                {property?.title || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-[hsl(var(--malik-muted))] rounded-lg">
            <User className="size-4 text-[hsl(var(--malik-primary))]" />
            <div className="min-w-0">
              <p className="text-[10px] text-[hsl(var(--malik-foreground-muted))]">المستأجر</p>
              <p className="text-xs font-bold truncate">
                {request.complainant_name}
              </p>
            </div>
          </div>
        </div>

        {/* Cost */}
        {request.estimated_cost && (
          <div className="mb-4 p-2 bg-[hsl(var(--malik-muted))] rounded-lg">
            <span className="text-xs text-[hsl(var(--malik-foreground-muted))]">
              التكلفة التقديرية:
            </span>
            <span className="text-sm font-bold text-[hsl(var(--malik-foreground))] mr-2">
              ر.ع {request.estimated_cost.toLocaleString('ar-OM', { minimumFractionDigits: 3 })}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-[hsl(var(--malik-border-light))]">
          <MalikButton
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(request)}
            leftIcon={<Eye className="size-4" />}
            className="flex-1"
          >
            التفاصيل
          </MalikButton>
          
          {!isCompleted && (
            <>
              <MalikButton
                size="sm"
                variant="ghost"
                onClick={() => onEdit(request)}
                className="size-9 p-0"
                aria-label="تعديل"
              >
                <Edit className="size-4" />
              </MalikButton>
              
              {isOpen && (
                <MalikButton
                  size="sm"
                  variant="soft"
                  onClick={() => onStatusAction(request, 'in_progress')}
                  className="flex-1"
                >
                  بدء التنفيذ
                </MalikButton>
              )}
              
              {isInProgress && (
                <MalikButton
                  size="sm"
                  variant="success"
                  onClick={() => onStatusAction(request, 'resolved')}
                  className="flex-1"
                >
                  <CheckCircle2 className="size-4" />
                  تم الحل
                </MalikButton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──
export function MaintenanceListSection({
  requests,
  properties,
  units,
  loading = false,
  onViewDetails,
  onEdit,
  onStatusAction,
  onCreateNew,
}: MaintenanceListSectionProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const statusCounts = {
    all: requests.length,
    open: requests.filter((r) => r.status === 'open').length,
    in_progress: requests.filter((r) => r.status === 'in_progress').length,
    resolved: requests.filter((r) => r.status === 'resolved' || r.status === 'closed').length,
  };

  const urgentCount = requests.filter((r) => r.priority === 'urgent' && r.status !== 'resolved' && r.status !== 'closed').length;

  const statusTabs = [
    { id: 'all', label: 'كافة الطلبات', count: statusCounts.all },
    { id: 'open', label: 'جديدة', count: statusCounts.open },
    { id: 'in_progress', label: 'قيد التنفيذ', count: statusCounts.in_progress },
    { id: 'resolved', label: 'المكتملة', count: statusCounts.resolved },
  ];

  return (
    <div className="space-y-4" data-malik-pro>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[hsl(var(--malik-primary-soft))]">
            <Wrench className="size-6 text-[hsl(var(--malik-primary))]" />
          </div>
          <div>
            <h2 className="text-lg font-bold">طلبات الصيانة والتشغيل</h2>
            <p className="text-sm text-[hsl(var(--malik-foreground-muted))]">
              {requests.length} طلب - {urgentCount} عاجل
            </p>
          </div>
        </div>

        <MalikButton
          variant="secondary"
          onClick={onCreateNew}
          leftIcon={<Plus className="size-4" />}
        >
          طلب صيانة جديد
        </MalikButton>
      </div>

      {/* Urgent Alert */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-[hsl(var(--malik-danger-bg))] rounded-xl border border-[hsl(var(--malik-danger)/0.2)]">
          <Flame className="size-6 text-[hsl(var(--malik-danger))]" />
          <div className="flex-1">
            <p className="text-sm font-bold text-[hsl(var(--malik-danger))]">
              {urgentCount} طلب عاجل يحتاج انتباهاً فورياً
            </p>
            <p className="text-xs text-[hsl(var(--malik-foreground-muted))]">
              راجع الطلبات العاجلة وحدد المسؤول أو ابدأ التنفيذ
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <MalikFilterTabs
        tabs={statusTabs}
        activeTab={statusFilter}
        onTabChange={(id) => setStatusFilter(id as typeof statusFilter)}
      />

      {/* Request Cards Grid */}
      {loading ? (
        <MalikLoadingState />
      ) : filteredRequests.length === 0 ? (
        <MalikEmptyState
          icon={<Wrench className="size-8" />}
          title="لا توجد طلبات صيانة"
          description={
            statusFilter !== 'all'
              ? 'لا توجد طلبات بهذه الحالة'
              : 'أضف طلب صيانة جديد للبدء'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRequests.map((request) => (
            <MaintenanceRequestCard
              key={request.id}
              request={request}
              properties={properties}
              units={units}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onStatusAction={onStatusAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
