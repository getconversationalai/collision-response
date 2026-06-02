export type Municipality = {
  id: string
  name: string
  display_name: string | null
  county: string
  state: string
  is_active: boolean
  parent_id: string | null
  admin_only: boolean
  created_at: string
}

// Stripe billing lifecycle (migration 004):
//   pending  — no card on file yet (is_active stays false)
//   active   — card on file, payments succeeding
//   past_due — last payment failed, SMS disabled (is_active false)
//   canceled — subscription ended
//   comped   — admin-comped, no Stripe charge, SMS still active
export type BillingStatus =
  | 'pending'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'comped'

export type CollisionCompany = {
  id: string
  auth_user_id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  phone_secondary: string | null
  email: string | null
  is_active: boolean
  is_admin: boolean
  // Stripe billing (migration 004)
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  monthly_price_cents: number | null      // NULL = use system default
  is_comped: boolean
  billing_status: BillingStatus
  current_period_end: string | null
  last_payment_failed_at: string | null
  created_at: string
  updated_at: string
}

export type SystemSettings = {
  id: number
  test_mode_until: string | null
  default_monthly_price_cents: number     // global default monthly price
  notification_emails: string[]           // admin addresses notified on new applications
  updated_at: string
}

export type PaymentStatus = 'succeeded' | 'failed' | 'refunded'

export type PaymentLog = {
  id: string
  company_id: string
  stripe_invoice_id: string | null
  stripe_event_id: string | null          // UNIQUE — webhook idempotency guard
  amount_cents: number | null
  status: PaymentStatus
  failure_reason: string | null
  created_at: string
}

export type MunicipalityAlias = {
  id: string
  municipality_id: string
  alias: string
  created_at: string
}

export type Subscription = {
  id: string
  company_id: string
  municipality_id: string
  is_subscribed: boolean
  created_at: string
  updated_at: string
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export type ClientApplication = {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  phone_secondary: string | null
  requested_municipality_ids: string[]
  status: ApplicationStatus
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_company_id: string | null
  created_at: string
  updated_at: string
}

export type DispatchLog = {
  id: string
  source_workflow: string | null
  municipality: string | null
  incident_type: string | null
  address: string | null
  gps_url: string | null
  raw_payload: Record<string, unknown> | null
  sanitized_message: string | null
  created_at: string
}

export type SmsLog = {
  id: string
  dispatch_id: string | null
  company_id: string
  phone: string
  status: string
  signalwire_sid: string | null
  error_message: string | null
  sent_at: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      municipalities: {
        Row: Municipality
        Insert: Omit<Municipality, 'id' | 'created_at' | 'display_name' | 'parent_id' | 'admin_only'> & {
          id?: string
          created_at?: string
          display_name?: string | null
          parent_id?: string | null
          admin_only?: boolean
        }
        Update: Partial<Omit<Municipality, 'id'>>
        Relationships: []
      }
      collision_companies: {
        Row: CollisionCompany
        Insert: Omit<
          CollisionCompany,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'is_admin'
          | 'stripe_customer_id'
          | 'stripe_subscription_id'
          | 'monthly_price_cents'
          | 'is_comped'
          | 'billing_status'
          | 'current_period_end'
          | 'last_payment_failed_at'
        > & {
          id?: string
          is_admin?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          monthly_price_cents?: number | null
          is_comped?: boolean
          billing_status?: BillingStatus
          current_period_end?: string | null
          last_payment_failed_at?: string | null
        }
        Update: Partial<Omit<CollisionCompany, 'id' | 'auth_user_id'>>
        Relationships: []
      }
      subscriptions: {
        Row: Subscription
        Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Pick<Subscription, 'is_subscribed'>>
        Relationships: [
          {
            foreignKeyName: 'subscriptions_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'collision_companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_municipality_id_fkey'
            columns: ['municipality_id']
            isOneToOne: false
            referencedRelation: 'municipalities'
            referencedColumns: ['id']
          }
        ]
      }
      dispatch_log: {
        Row: DispatchLog
        Insert: Omit<DispatchLog, 'id' | 'created_at'> & { id?: string }
        Update: Partial<Omit<DispatchLog, 'id'>>
        Relationships: []
      }
      sms_log: {
        Row: SmsLog
        Insert: Omit<SmsLog, 'id' | 'created_at'> & { id?: string }
        Update: Partial<Omit<SmsLog, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'sms_log_dispatch_id_fkey'
            columns: ['dispatch_id']
            isOneToOne: false
            referencedRelation: 'dispatch_log'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sms_log_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'collision_companies'
            referencedColumns: ['id']
          }
        ]
      }
      system_settings: {
        Row: SystemSettings
        Insert: Partial<SystemSettings>
        Update: Partial<SystemSettings>
        Relationships: []
      }
      municipality_aliases: {
        Row: MunicipalityAlias
        Insert: Omit<MunicipalityAlias, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<MunicipalityAlias, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'municipality_aliases_municipality_id_fkey'
            columns: ['municipality_id']
            isOneToOne: false
            referencedRelation: 'municipalities'
            referencedColumns: ['id']
          }
        ]
      }
      payment_log: {
        Row: PaymentLog
        Insert: Omit<PaymentLog, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<PaymentLog, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'payment_log_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'collision_companies'
            referencedColumns: ['id']
          }
        ]
      }
      client_applications: {
        Row: ClientApplication
        Insert: Omit<
          ClientApplication,
          'id' | 'created_at' | 'updated_at' | 'status' | 'rejection_reason'
          | 'reviewed_by' | 'reviewed_at' | 'created_company_id' | 'phone_secondary'
          | 'requested_municipality_ids'
        > & {
          id?: string
          status?: ApplicationStatus
          rejection_reason?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_company_id?: string | null
          phone_secondary?: string | null
          requested_municipality_ids: string[]   // required: validation always supplies ≥1
        }
        Update: Partial<Omit<ClientApplication, 'id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type MunicipalityWithSubscription = Municipality & {
  is_subscribed: boolean
  subscription_id: string | null
}
