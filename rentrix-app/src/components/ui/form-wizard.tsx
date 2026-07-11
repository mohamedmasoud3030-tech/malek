import { useState, useCallback, type ReactNode } from 'react';
import { ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: ReactNode;
  isCompleted?: boolean;
  hasError?: boolean;
}

export interface FormWizardProps {
  steps: WizardStep[];
  currentStepId: string;
  onStepChange: (stepId: string) => void;
  onComplete?: () => void;
  onCancel?: () => void;
  className?: string;
  showStepNumbers?: boolean;
  showNavigation?: boolean;
  allowSkip?: boolean;
}

export function FormWizard({
  steps,
  currentStepId,
  onStepChange,
  onComplete,
  onCancel,
  className,
  showStepNumbers = true,
  showNavigation = true,
  allowSkip = false,
}: FormWizardProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const currentStep = steps[currentIndex];
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < steps.length - 1;
  const isLastStep = currentIndex === steps.length - 1;
  const isFirstStep = currentIndex === 0;

  const goToNext = useCallback(() => {
    if (canGoForward) {
      onStepChange(steps[currentIndex + 1].id);
    } else if (isLastStep && onComplete) {
      onComplete();
    }
  }, [canGoForward, currentIndex, steps, onStepChange, isLastStep, onComplete]);

  const goToPrevious = useCallback(() => {
    if (canGoBack) {
      onStepChange(steps[currentIndex - 1].id);
    }
  }, [canGoBack, currentIndex, steps, onStepChange]);

  if (!currentStep) {
    return null;
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Step Indicators */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = step.id === currentStepId;
            const isCompleted = step.isCompleted || index < currentIndex;
            const hasError = step.hasError;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => (allowSkip || index <= currentIndex) && onStepChange(step.id)}
                  disabled={!allowSkip && index > currentIndex}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3 py-2 transition-all',
                    isActive && 'bg-primary text-primary-foreground',
                    isCompleted && !isActive && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground hover:bg-muted/80',
                    hasError && !isActive && 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
                    (!allowSkip && index > currentIndex) && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span className={cn(
                    'flex size-6 items-center justify-center rounded-full text-xs font-bold',
                    isActive && 'bg-primary-foreground text-primary',
                    isCompleted && !isActive && 'bg-emerald-600 text-white',
                    !isActive && !isCompleted && 'bg-current/20',
                  )}>
                    {isCompleted ? <Check className="size-3.5" /> : showStepNumbers ? index + 1 : (Icon && <Icon className="size-3.5" />)}
                  </span>
                  <span className="hidden text-sm font-bold lg:block">{step.title}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={cn(
                    'mx-2 h-0.5 w-8 lg:w-16',
                    index < currentIndex ? 'bg-emerald-500' : 'bg-muted',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Step Progress */}
      <div className="md:hidden">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-muted-foreground">
            الخطوة {currentIndex + 1} من {steps.length}
          </span>
          <span className="font-black">{currentStep.title}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {currentStep.icon && (
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <currentStep.icon className="size-5" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">{currentStep.title}</CardTitle>
                {currentStep.description && (
                  <CardDescription className="mt-1">{currentStep.description}</CardDescription>
                )}
              </div>
            </div>
            {currentStep.hasError && (
              <div className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-900/50 dark:text-red-400">
                <AlertCircle className="size-3" />
                هناك أخطاء
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep.content}
        </CardContent>
      </Card>

      {/* Navigation */}
      {showNavigation && (
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={goToPrevious}
            disabled={!canGoBack && !onCancel}
            className="min-h-12"
          >
            {onCancel && isFirstStep ? (
              'إلغاء'
            ) : (
              <>
                <ChevronRight className="me-2 size-4" />
                السابق
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {/* Step dots for mobile */}
            <div className="flex gap-1 md:hidden">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'size-2 rounded-full transition-all',
                    index === currentIndex ? 'bg-primary w-4' : index < currentIndex ? 'bg-emerald-500' : 'bg-muted',
                  )}
                />
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={goToNext}
            className="min-h-12"
            disabled={isLastStep && !onComplete}
          >
            {isLastStep ? (
              'حفظ وإغلاق'
            ) : (
              <>
                التالي
                <ChevronLeft className="ms-2 size-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Form Step Wrapper
// ============================================================

export interface FormStepProps {
  children: ReactNode;
  className?: string;
}

export function FormStep({ children, className }: FormStepProps) {
  return <div className={cn('space-y-4', className)}>{children}</div>;
}

// ============================================================
// Field Group Component
// ============================================================

export interface FieldGroupProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FieldGroup({ title, description, children, className }: FieldGroupProps) {
  return (
    <div className={cn('space-y-3 rounded-2xl border p-4', className)}>
      <div>
        <p className="text-sm font-bold">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

// ============================================================
// Form Validation Summary
// ============================================================

export interface ValidationSummaryProps {
  errors: Record<string, string | undefined>;
  className?: string;
}

export function ValidationSummary({ errors, className }: ValidationSummaryProps) {
  const errorList = Object.entries(errors)
    .filter(([, value]) => value)
    .map(([key, value]) => ({ field: key, message: value }));

  if (errorList.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30', className)}>
      <div className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400">
        <AlertCircle className="size-4" />
        يرجى تصحيح الأخطاء التالية:
      </div>
      <ul className="mt-2 space-y-1 text-sm text-red-600 dark:text-red-400">
        {errorList.map(({ field, message }) => (
          <li key={field}>• {message}</li>
        ))}
      </ul>
    </div>
  );
}
