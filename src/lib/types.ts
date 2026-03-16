export type Municipality = {
  id: string
  name: string
  county: string
  state: string
  is_active: boolean
  created_at: string
}

export type CollisionCompany = {
  id: string
  auth_user_id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Subscription = {
  id: string
  company_id: string
  municipality_id: string
  is_subscribed: boolean
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
        Insert: Omit<Municipality, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Municipality, 'id'>>
        Relationships: []
      }
      collision_companies: {
        Row: CollisionCompany
        Insert: Omit<CollisionCompany, 'id' | 'created_at' | 'updated_at'> & { id?: string }
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
