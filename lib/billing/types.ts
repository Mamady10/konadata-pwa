export type PlatformBillingModel =
  | 'monthly_subscription'
  | 'annual_school_subscription'
  | 'per_enrolled_student';

export interface SchoolInvoiceLine {
  student_id: string;
  student_name: string;
  class_id: string | null;
  class_name: string;
  fee_gnf: number;
}

export interface SchoolBillingInvoice {
  id: string;
  period_year: number;
  period_month: number;
  amount_gnf: number;
  student_count: number;
  status: string;
  due_date: string;
  line_items: SchoolInvoiceLine[];
  paid_at: string | null;
}

export interface SubscriptionBillingInfo {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  grace_until: string | null;
  plan_name: string;
  monthly_price_gnf: number;
  sector: string;
}

export interface OrganizationBillingStatus {
  model: PlatformBillingModel;
  access_allowed: boolean;
  billing_status?: string;
  ceo_suspend_reason?: string | null;
  payment_timing?: 'upfront_before_access';
  upfront_annual_due_gnf?: number;
  subscription_valid_from?: string | null;
  default_tuition_fee_gnf?: number;
  billing_period?: 'monthly' | 'annual';
  platform_monthly_base_gnf?: number;
  platform_annual_base_gnf?: number;
  platform_per_student_gnf?: number;
  subscription_valid_until?: string | null;
  current_invoice?: SchoolBillingInvoice | null;
  subscription?: SubscriptionBillingInfo;
  offer?: {
    status?: string;
    activation_amount_gnf?: number;
    monthly_base_gnf?: number;
    annual_base_gnf?: number;
    per_enrolled_student_gnf?: number;
    payment_token?: string;
    ceo_notes?: string | null;
    access_mode?: 'annual' | 'trial_30d' | string;
  };
}
