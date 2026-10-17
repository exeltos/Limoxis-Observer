// Generated from the Limoxis-Observer Supabase project schema (public tables, views, functions).
// Do not edit by hand: regenerate with `supabase gen types typescript` after schema migrations.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      account_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          delivery_email: string
          expires_at: string
          id: string
          organization_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
          user_id: string
          username: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_email: string
          expires_at: string
          id?: string
          organization_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
          user_id: string
          username: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_email?: string
          expires_at?: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      amr_classifications: {
        Row: {
          calculation_snapshot: Json
          classification: string | null
          classified_at: string | null
          classified_by: string | null
          created_at: string
          definition_source: string
          definition_version: string
          id: string
          microbiology_result_id: string
          organism: string | null
          organization_id: string
          rationale: string | null
          status: string
        }
        Insert: {
          calculation_snapshot?: Json
          classification?: string | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string
          definition_source: string
          definition_version: string
          id?: string
          microbiology_result_id: string
          organism?: string | null
          organization_id: string
          rationale?: string | null
          status?: string
        }
        Update: {
          calculation_snapshot?: Json
          classification?: string | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string
          definition_source?: string
          definition_version?: string
          id?: string
          microbiology_result_id?: string
          organism?: string | null
          organization_id?: string
          rationale?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "amr_classifications_microbiology_result_id_fkey"
            columns: ["microbiology_result_id"]
            isOneToOne: false
            referencedRelation: "microbiology_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amr_classifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      antibiotic_dispensing_periods: {
        Row: {
          antibiotic_item_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          quantity_grams: number
          responsible_name: string | null
          source: string | null
          source_reference: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          antibiotic_item_id: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          quantity_grams: number
          responsible_name?: string | null
          source?: string | null
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          antibiotic_item_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          quantity_grams?: number
          responsible_name?: string | null
          source?: string | null
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "antibiotic_dispensing_periods_antibiotic_item_id_fkey"
            columns: ["antibiotic_item_id"]
            isOneToOne: false
            referencedRelation: "master_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antibiotic_dispensing_periods_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antibiotic_dispensing_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      antimicrobial_susceptibility_results: {
        Row: {
          antimicrobial_code: string | null
          antimicrobial_name: string
          breakpoint_standard: string
          breakpoint_version: string
          created_at: string
          created_by: string
          id: string
          method: string
          mic_operator: string | null
          mic_value: number | null
          microbiology_result_id: string
          notes: string | null
          organism: string | null
          organism_name: string | null
          organization_id: string
          sir_category: string
          technical_uncertainty: boolean
          updated_at: string
          updated_by: string | null
          zone_diameter_mm: number | null
        }
        Insert: {
          antimicrobial_code?: string | null
          antimicrobial_name: string
          breakpoint_standard?: string
          breakpoint_version: string
          created_at?: string
          created_by: string
          id?: string
          method: string
          mic_operator?: string | null
          mic_value?: number | null
          microbiology_result_id: string
          notes?: string | null
          organism?: string | null
          organism_name?: string | null
          organization_id: string
          sir_category: string
          technical_uncertainty?: boolean
          updated_at?: string
          updated_by?: string | null
          zone_diameter_mm?: number | null
        }
        Update: {
          antimicrobial_code?: string | null
          antimicrobial_name?: string
          breakpoint_standard?: string
          breakpoint_version?: string
          created_at?: string
          created_by?: string
          id?: string
          method?: string
          mic_operator?: string | null
          mic_value?: number | null
          microbiology_result_id?: string
          notes?: string | null
          organism?: string | null
          organism_name?: string | null
          organization_id?: string
          sir_category?: string
          technical_uncertainty?: boolean
          updated_at?: string
          updated_by?: string | null
          zone_diameter_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "antimicrobial_susceptibility_result_microbiology_result_id_fkey"
            columns: ["microbiology_result_id"]
            isOneToOne: false
            referencedRelation: "microbiology_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antimicrobial_susceptibility_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      antimicrobial_therapies: {
        Row: {
          antimicrobial: string
          approval_status: string
          created_at: string
          created_by: string
          dose: string | null
          ended_at: string | null
          id: string
          indication: string | null
          laboratory_result_id: string | null
          laboratory_sample_id: string | null
          organization_id: string
          patient_id: string
          planned_end_at: string | null
          route: string | null
          source: string
          started_at: string
          status: string
          surveillance_case_id: string | null
          therapy_plan_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          antimicrobial: string
          approval_status?: string
          created_at?: string
          created_by: string
          dose?: string | null
          ended_at?: string | null
          id?: string
          indication?: string | null
          laboratory_result_id?: string | null
          laboratory_sample_id?: string | null
          organization_id: string
          patient_id: string
          planned_end_at?: string | null
          route?: string | null
          source?: string
          started_at: string
          status?: string
          surveillance_case_id?: string | null
          therapy_plan_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          antimicrobial?: string
          approval_status?: string
          created_at?: string
          created_by?: string
          dose?: string | null
          ended_at?: string | null
          id?: string
          indication?: string | null
          laboratory_result_id?: string | null
          laboratory_sample_id?: string | null
          organization_id?: string
          patient_id?: string
          planned_end_at?: string | null
          route?: string | null
          source?: string
          started_at?: string
          status?: string
          surveillance_case_id?: string | null
          therapy_plan_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "antimicrobial_therapies_laboratory_result_id_fkey"
            columns: ["laboratory_result_id"]
            isOneToOne: false
            referencedRelation: "microbiology_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antimicrobial_therapies_laboratory_sample_id_fkey"
            columns: ["laboratory_sample_id"]
            isOneToOne: false
            referencedRelation: "laboratory_samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antimicrobial_therapies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antimicrobial_therapies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antimicrobial_therapies_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      antimicrobial_therapy_administrations: {
        Row: {
          administered_at: string
          administered_by: string | null
          created_at: string
          created_by: string
          dose: string | null
          id: string
          notes: string | null
          organization_id: string
          route: string | null
          status: string
          therapy_id: string
          withheld_reason: string | null
        }
        Insert: {
          administered_at: string
          administered_by?: string | null
          created_at?: string
          created_by: string
          dose?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          route?: string | null
          status?: string
          therapy_id: string
          withheld_reason?: string | null
        }
        Update: {
          administered_at?: string
          administered_by?: string | null
          created_at?: string
          created_by?: string
          dose?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          route?: string | null
          status?: string
          therapy_id?: string
          withheld_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "antimicrobial_therapy_administrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antimicrobial_therapy_administrations_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "antimicrobial_therapies"
            referencedColumns: ["id"]
          },
        ]
      }
      antiseptic_consumption_periods: {
        Row: {
          antiseptic_item_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          litres: number
          notes: string | null
          organization_id: string
          patient_days: number | null
          patient_days_source: string | null
          period_end: string
          period_start: string
          responsible_name: string | null
          source: string
          source_reference: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          antiseptic_item_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          litres: number
          notes?: string | null
          organization_id: string
          patient_days?: number | null
          patient_days_source?: string | null
          period_end: string
          period_start: string
          responsible_name?: string | null
          source?: string
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          antiseptic_item_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          litres?: number
          notes?: string | null
          organization_id?: string
          patient_days?: number | null
          patient_days_source?: string | null
          period_end?: string
          period_start?: string
          responsible_name?: string | null
          source?: string
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "antiseptic_consumption_periods_antiseptic_item_id_fkey"
            columns: ["antiseptic_item_id"]
            isOneToOne: false
            referencedRelation: "master_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antiseptic_consumption_periods_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antiseptic_consumption_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          metadata: Json
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capabilities: {
        Row: {
          action_key: string
          created_at: string
          is_active: boolean
          key: string
          label_el: string
          label_en: string
          module_key: string
        }
        Insert: {
          action_key: string
          created_at?: string
          is_active?: boolean
          key: string
          label_el: string
          label_en: string
          module_key: string
        }
        Update: {
          action_key?: string
          created_at?: string
          is_active?: boolean
          key?: string
          label_el?: string
          label_en?: string
          module_key?: string
        }
        Relationships: []
      }
      clinical_assessments: {
        Row: {
          assessed_at: string
          assessment_type: string
          classification: string | null
          created_at: string
          created_by: string
          department_id: string | null
          id: string
          organization_id: string
          patient_id: string
          risk_factors: Json
          signs_symptoms: Json
          summary: string | null
          surveillance_case_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assessed_at?: string
          assessment_type: string
          classification?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          id?: string
          organization_id: string
          patient_id: string
          risk_factors?: Json
          signs_symptoms?: Json
          summary?: string | null
          surveillance_case_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assessed_at?: string
          assessment_type?: string
          classification?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          risk_factors?: Json
          signs_symptoms?: Json
          summary?: string | null
          surveillance_case_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_assessments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_assessments_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          id: number
          occurred_at: string
          organization_id: string
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          id?: never
          occurred_at?: string
          organization_id: string
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          id?: never
          occurred_at?: string
          organization_id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_content_source_history: {
        Row: {
          change_detected: boolean
          checked_at: string
          checked_by: string | null
          content_hash: string | null
          http_status: number | null
          id: string
          note: string | null
          previous_hash: string | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string
        }
        Insert: {
          change_detected?: boolean
          checked_at?: string
          checked_by?: string | null
          content_hash?: string | null
          http_status?: number | null
          id?: string
          note?: string | null
          previous_hash?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id: string
        }
        Update: {
          change_detected?: boolean
          checked_at?: string
          checked_by?: string | null
          content_hash?: string | null
          http_status?: number | null
          id?: string
          note?: string | null
          previous_hash?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_content_source_history_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "clinical_content_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_content_sources: {
        Row: {
          authority: string
          content_area: string
          current_version: string | null
          id: string
          last_changed_at: string | null
          last_checked_at: string | null
          last_content_hash: string | null
          last_http_status: number | null
          name: string
          source_key: string
          source_url: string
          status: string
          updated_at: string
        }
        Insert: {
          authority: string
          content_area?: string
          current_version?: string | null
          id?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_content_hash?: string | null
          last_http_status?: number | null
          name: string
          source_key: string
          source_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          authority?: string
          content_area?: string
          current_version?: string | null
          id?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_content_hash?: string | null
          last_http_status?: number | null
          name?: string
          source_key?: string
          source_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinical_scale_definitions: {
        Row: {
          category: string
          created_at: string
          definition: Json
          id: string
          max_age_years: number | null
          min_age_years: number | null
          name_el: string
          name_en: string
          population: string[]
          scale_key: string
          settings: string[]
          source_authority: string | null
          source_reference: string | null
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          category: string
          created_at?: string
          definition?: Json
          id?: string
          max_age_years?: number | null
          min_age_years?: number | null
          name_el: string
          name_en: string
          population?: string[]
          scale_key: string
          settings?: string[]
          source_authority?: string | null
          source_reference?: string | null
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          category?: string
          created_at?: string
          definition?: Json
          id?: string
          max_age_years?: number | null
          min_age_years?: number | null
          name_el?: string
          name_en?: string
          population?: string[]
          scale_key?: string
          settings?: string[]
          source_authority?: string | null
          source_reference?: string | null
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      clinical_scale_org_settings: {
        Row: {
          availability: string
          enabled: boolean
          organization_id: string
          reassessment_hours: number | null
          scale_definition_id: string
          updated_at: string
        }
        Insert: {
          availability?: string
          enabled?: boolean
          organization_id: string
          reassessment_hours?: number | null
          scale_definition_id: string
          updated_at?: string
        }
        Update: {
          availability?: string
          enabled?: boolean
          organization_id?: string
          reassessment_hours?: number | null
          scale_definition_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_scale_org_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_scale_org_settings_scale_definition_id_fkey"
            columns: ["scale_definition_id"]
            isOneToOne: false
            referencedRelation: "clinical_scale_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_decisions: {
        Row: {
          action: string | null
          client_key: string | null
          committee_id: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          meeting_id: string | null
          organization_id: string
          owner_id: string | null
          owner_label: string | null
          priority: string
          status: string
          title: string
          topic_key: string | null
          updated_at: string
        }
        Insert: {
          action?: string | null
          client_key?: string | null
          committee_id: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          organization_id: string
          owner_id?: string | null
          owner_label?: string | null
          priority?: string
          status?: string
          title: string
          topic_key?: string | null
          updated_at?: string
        }
        Update: {
          action?: string | null
          client_key?: string | null
          committee_id?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          organization_id?: string
          owner_id?: string | null
          owner_label?: string | null
          priority?: string
          status?: string
          title?: string
          topic_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_decisions_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_decisions_meeting_tenant_fk"
            columns: ["meeting_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "committee_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_decisions_tenant_fk"
            columns: ["committee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      committee_documents: {
        Row: {
          attachment: Json | null
          committee_id: string
          created_at: string
          created_by: string
          document_id: string | null
          document_kind: string
          id: string
          organization_id: string
        }
        Insert: {
          attachment?: Json | null
          committee_id: string
          created_at?: string
          created_by?: string
          document_id?: string | null
          document_kind?: string
          id?: string
          organization_id: string
        }
        Update: {
          attachment?: Json | null
          committee_id?: string
          created_at?: string
          created_by?: string
          document_id?: string | null
          document_kind?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_documents_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_documents_document_tenant_fk"
            columns: ["document_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "committee_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_documents_tenant_fk"
            columns: ["committee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      committee_history: {
        Row: {
          action: string
          actor_id: string
          committee_id: string
          created_at: string
          event_data: Json
          id: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string
          committee_id: string
          created_at?: string
          event_data?: Json
          id?: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          committee_id?: string
          created_at?: string
          event_data?: Json
          id?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_history_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_history_tenant_fk"
            columns: ["committee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      committee_meeting_attendance: {
        Row: {
          attendance_status: string
          attendee_name: string
          client_key: string | null
          committee_id: string
          created_at: string
          employee_id: string | null
          has_vote: boolean
          id: string
          meeting_id: string
          member_id: string | null
          organization_id: string
          recorded_by: string
          updated_at: string
        }
        Insert: {
          attendance_status?: string
          attendee_name: string
          client_key?: string | null
          committee_id: string
          created_at?: string
          employee_id?: string | null
          has_vote?: boolean
          id?: string
          meeting_id: string
          member_id?: string | null
          organization_id: string
          recorded_by?: string
          updated_at?: string
        }
        Update: {
          attendance_status?: string
          attendee_name?: string
          client_key?: string | null
          committee_id?: string
          created_at?: string
          employee_id?: string | null
          has_vote?: boolean
          id?: string
          meeting_id?: string
          member_id?: string | null
          organization_id?: string
          recorded_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_attendance_meeting_tenant_fk"
            columns: ["meeting_id", "organization_id", "committee_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id", "organization_id", "committee_id"]
          },
          {
            foreignKeyName: "committee_attendance_member_tenant_fk"
            columns: ["member_id", "organization_id", "committee_id"]
            isOneToOne: false
            referencedRelation: "committee_members"
            referencedColumns: ["id", "organization_id", "committee_id"]
          },
          {
            foreignKeyName: "committee_meeting_attendance_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meeting_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meeting_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "committee_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meeting_attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_meetings: {
        Row: {
          agenda: Json
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_key: string | null
          committee_id: string
          created_at: string
          created_by: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          location: string | null
          meeting_type: string
          minutes: string | null
          minutes_number: string | null
          organization_id: string
          quorum_met: boolean | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: Json
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_key?: string | null
          committee_id: string
          created_at?: string
          created_by?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          location?: string | null
          meeting_type?: string
          minutes?: string | null
          minutes_number?: string | null
          organization_id: string
          quorum_met?: boolean | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: Json
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_key?: string | null
          committee_id?: string
          created_at?: string
          created_by?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          location?: string | null
          meeting_type?: string
          minutes?: string | null
          minutes_number?: string | null
          organization_id?: string
          quorum_met?: boolean | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_meetings_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_meetings_tenant_fk"
            columns: ["committee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      committee_members: {
        Row: {
          approval_status: string
          client_key: string | null
          committee_id: string
          created_at: string
          employee_id: string | null
          ended_at: string | null
          has_vote: boolean
          id: string
          member_name: string
          member_type: string
          organization_id: string
          responsibilities: string | null
          started_at: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approval_status?: string
          client_key?: string | null
          committee_id: string
          created_at?: string
          employee_id?: string | null
          ended_at?: string | null
          has_vote?: boolean
          id?: string
          member_name: string
          member_type?: string
          organization_id: string
          responsibilities?: string | null
          started_at?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approval_status?: string
          client_key?: string | null
          committee_id?: string
          created_at?: string
          employee_id?: string | null
          ended_at?: string | null
          has_vote?: boolean
          id?: string
          member_name?: string
          member_type?: string
          organization_id?: string
          responsibilities?: string | null
          started_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_members_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_tenant_fk"
            columns: ["committee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      committee_minutes_approval_history: {
        Row: {
          approval_id: string
          approver_id: string
          archived_at: string
          comment: string | null
          committee_id: string
          decided_at: string | null
          id: string
          meeting_id: string
          member_id: string | null
          organization_id: string
          requested_at: string | null
          status: string
        }
        Insert: {
          approval_id: string
          approver_id: string
          archived_at?: string
          comment?: string | null
          committee_id: string
          decided_at?: string | null
          id?: string
          meeting_id: string
          member_id?: string | null
          organization_id: string
          requested_at?: string | null
          status: string
        }
        Update: {
          approval_id?: string
          approver_id?: string
          archived_at?: string
          comment?: string | null
          committee_id?: string
          decided_at?: string | null
          id?: string
          meeting_id?: string
          member_id?: string | null
          organization_id?: string
          requested_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_minutes_approval_history_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_approval_history_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_approval_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "committee_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_approval_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_minutes_approvals: {
        Row: {
          approver_id: string
          comment: string | null
          committee_id: string
          created_at: string
          decided_at: string | null
          id: string
          meeting_id: string
          member_id: string | null
          organization_id: string
          requested_at: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          approver_id: string
          comment?: string | null
          committee_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          meeting_id: string
          member_id?: string | null
          organization_id: string
          requested_at?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approver_id?: string
          comment?: string | null
          committee_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          meeting_id?: string
          member_id?: string | null
          organization_id?: string
          requested_at?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_minutes_approvals_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_approvals_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_approvals_meeting_tenant_fk"
            columns: ["meeting_id", "organization_id", "committee_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id", "organization_id", "committee_id"]
          },
          {
            foreignKeyName: "committee_minutes_approvals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "committee_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_approvals_member_tenant_fk"
            columns: ["member_id", "organization_id", "committee_id"]
            isOneToOne: false
            referencedRelation: "committee_members"
            referencedColumns: ["id", "organization_id", "committee_id"]
          },
          {
            foreignKeyName: "committee_minutes_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_minutes_external_approvals: {
        Row: {
          comment: string | null
          committee_id: string
          created_at: string
          decided_at: string | null
          email: string | null
          id: string
          meeting_id: string
          member_id: string | null
          member_name: string
          method: string
          organization_id: string
          recorded_by: string | null
          requested_at: string
          requested_by: string
          send_count: number
          sent_at: string | null
          status: string
          token_expires_at: string | null
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          committee_id: string
          created_at?: string
          decided_at?: string | null
          email?: string | null
          id?: string
          meeting_id: string
          member_id?: string | null
          member_name: string
          method: string
          organization_id: string
          recorded_by?: string | null
          requested_at?: string
          requested_by: string
          send_count?: number
          sent_at?: string | null
          status?: string
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          committee_id?: string
          created_at?: string
          decided_at?: string | null
          email?: string | null
          id?: string
          meeting_id?: string
          member_id?: string | null
          member_name?: string
          method?: string
          organization_id?: string
          recorded_by?: string | null
          requested_at?: string
          requested_by?: string
          send_count?: number
          sent_at?: string | null
          status?: string
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_minutes_external_approvals_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_external_approvals_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_external_approvals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "committee_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_external_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_minutes_external_meeting_tenant_fk"
            columns: ["meeting_id", "organization_id", "committee_id"]
            isOneToOne: false
            referencedRelation: "committee_meetings"
            referencedColumns: ["id", "organization_id", "committee_id"]
          },
        ]
      }
      committee_plan_items: {
        Row: {
          baseline: string | null
          client_key: string | null
          committee_id: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          indicator: string | null
          indicator_definition_id: string | null
          indicator_key: string | null
          organization_id: string
          owner_id: string | null
          owner_label: string | null
          status: string
          target: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          baseline?: string | null
          client_key?: string | null
          committee_id: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          indicator?: string | null
          indicator_definition_id?: string | null
          indicator_key?: string | null
          organization_id: string
          owner_id?: string | null
          owner_label?: string | null
          status?: string
          target?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          baseline?: string | null
          client_key?: string | null
          committee_id?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          indicator?: string | null
          indicator_definition_id?: string | null
          indicator_key?: string | null
          organization_id?: string
          owner_id?: string | null
          owner_label?: string | null
          status?: string
          target?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_plan_items_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_plan_items_indicator_definition_fk"
            columns: ["indicator_definition_id"]
            isOneToOne: false
            referencedRelation: "indicator_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_plan_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_plan_items_tenant_fk"
            columns: ["committee_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      committees: {
        Row: {
          code: string
          committee_role: string | null
          committee_type: string
          created_at: string
          created_by: string
          decision_number: string | null
          id: string
          legal_basis: string | null
          mandate: string | null
          meeting_frequency: string | null
          name: string
          notes: string | null
          organization_id: string
          quorum_rule: string | null
          short_name: string | null
          status: string
          term_end: string | null
          term_start: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          committee_role?: string | null
          committee_type?: string
          created_at?: string
          created_by?: string
          decision_number?: string | null
          id?: string
          legal_basis?: string | null
          mandate?: string | null
          meeting_frequency?: string | null
          name: string
          notes?: string | null
          organization_id: string
          quorum_rule?: string | null
          short_name?: string | null
          status?: string
          term_end?: string | null
          term_start?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          committee_role?: string | null
          committee_type?: string
          created_at?: string
          created_by?: string
          decision_number?: string | null
          id?: string
          legal_basis?: string | null
          mandate?: string | null
          meeting_frequency?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          quorum_rule?: string | null
          short_name?: string | null
          status?: string
          term_end?: string | null
          term_start?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      control_assignments: {
        Row: {
          assignee_id: string | null
          control_id: string
          department_id: string
          id: string
          last_completed_at: string | null
          next_due_at: string | null
          organization_id: string
          status: string
        }
        Insert: {
          assignee_id?: string | null
          control_id: string
          department_id: string
          id?: string
          last_completed_at?: string | null
          next_due_at?: string | null
          organization_id: string
          status?: string
        }
        Update: {
          assignee_id?: string | null
          control_id?: string
          department_id?: string
          id?: string
          last_completed_at?: string | null
          next_due_at?: string | null
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_assignments_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "control_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_assignments_tenant_fk"
            columns: ["control_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "control_definitions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      control_definitions: {
        Row: {
          category: string
          code: string
          created_at: string
          created_by: string
          description: string | null
          frequency_config: Json
          id: string
          organization_id: string
          owner_id: string | null
          response_config: Json
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          created_by?: string
          description?: string | null
          frequency_config?: Json
          id?: string
          organization_id: string
          owner_id?: string | null
          response_config?: Json
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          frequency_config?: Json
          id?: string
          organization_id?: string
          owner_id?: string | null
          response_config?: Json
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      control_drafts: {
        Row: {
          control_id: string | null
          created_by: string
          department_id: string | null
          id: string
          organization_id: string
          payload: Json
          record_key: string
          saved_at: string
          updated_at: string
        }
        Insert: {
          control_id?: string | null
          created_by?: string
          department_id?: string | null
          id?: string
          organization_id: string
          payload?: Json
          record_key: string
          saved_at?: string
          updated_at?: string
        }
        Update: {
          control_id?: string | null
          created_by?: string
          department_id?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          record_key?: string
          saved_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_drafts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      control_execution_revisions: {
        Row: {
          after_data: Json
          before_data: Json
          changed_at: string
          changed_by: string
          execution_id: string
          id: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          after_data: Json
          before_data: Json
          changed_at?: string
          changed_by?: string
          execution_id: string
          id?: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          after_data?: Json
          before_data?: Json
          changed_at?: string
          changed_by?: string
          execution_id?: string
          id?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_execution_revisions_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "control_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_execution_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_revisions_tenant_fk"
            columns: ["execution_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "control_executions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      control_executions: {
        Row: {
          assignment_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          control_id: string
          created_at: string
          department_id: string
          edited_at: string | null
          edited_by: string | null
          has_finding: boolean
          id: string
          notes: string | null
          organization_id: string
          performed_at: string
          performed_by: string
          response_data: Json
          status: string
          value_text: string | null
        }
        Insert: {
          assignment_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          control_id: string
          created_at?: string
          department_id: string
          edited_at?: string | null
          edited_by?: string | null
          has_finding?: boolean
          id?: string
          notes?: string | null
          organization_id: string
          performed_at?: string
          performed_by?: string
          response_data?: Json
          status?: string
          value_text?: string | null
        }
        Update: {
          assignment_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          control_id?: string
          created_at?: string
          department_id?: string
          edited_at?: string | null
          edited_by?: string | null
          has_finding?: boolean
          id?: string
          notes?: string | null
          organization_id?: string
          performed_at?: string
          performed_by?: string
          response_data?: Json
          status?: string
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_executions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "control_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_executions_assignment_tenant_fk"
            columns: [
              "assignment_id",
              "organization_id",
              "control_id",
              "department_id",
            ]
            isOneToOne: false
            referencedRelation: "control_assignments"
            referencedColumns: [
              "id",
              "organization_id",
              "control_id",
              "department_id",
            ]
          },
          {
            foreignKeyName: "control_executions_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "control_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_executions_definition_tenant_fk"
            columns: ["control_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "control_definitions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "control_executions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      controlled_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audience: string
          code: string
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          document_type: string
          effective_date: string | null
          id: string
          organization_id: string
          owner_id: string | null
          published_at: string | null
          published_by: string | null
          review_date: string | null
          revision_of_id: string | null
          revision_reason: string | null
          status: string
          supersedes_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string
          code: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          document_type: string
          effective_date?: string | null
          id?: string
          organization_id: string
          owner_id?: string | null
          published_at?: string | null
          published_by?: string | null
          review_date?: string | null
          revision_of_id?: string | null
          revision_reason?: string | null
          status?: string
          supersedes_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string
          code?: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          document_type?: string
          effective_date?: string | null
          id?: string
          organization_id?: string
          owner_id?: string | null
          published_at?: string | null
          published_by?: string | null
          review_date?: string | null
          revision_of_id?: string | null
          revision_reason?: string | null
          status?: string
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "controlled_documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_revision_of_id_fkey"
            columns: ["revision_of_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      critical_result_communications: {
        Row: {
          communicated_at: string
          communicated_by: string
          communication_method: string
          created_at: string
          id: string
          microbiology_result_id: string
          notes: string | null
          organization_id: string
          read_back_confirmed: boolean | null
          recipient_name: string
          recipient_role: string | null
        }
        Insert: {
          communicated_at: string
          communicated_by: string
          communication_method: string
          created_at?: string
          id?: string
          microbiology_result_id: string
          notes?: string | null
          organization_id: string
          read_back_confirmed?: boolean | null
          recipient_name: string
          recipient_role?: string | null
        }
        Update: {
          communicated_at?: string
          communicated_by?: string
          communication_method?: string
          created_at?: string
          id?: string
          microbiology_result_id?: string
          notes?: string | null
          organization_id?: string
          read_back_confirmed?: boolean | null
          recipient_name?: string
          recipient_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "critical_result_communications_microbiology_result_id_fkey"
            columns: ["microbiology_result_id"]
            isOneToOne: false
            referencedRelation: "microbiology_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critical_result_communications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_role_capabilities: {
        Row: {
          capability: string
          created_at: string
          custom_role_id: string
          id: string
        }
        Insert: {
          capability: string
          created_at?: string
          custom_role_id: string
          id?: string
        }
        Update: {
          capability?: string
          created_at?: string
          custom_role_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_capabilities_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_application_requests: {
        Row: {
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          demo_organization_id: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          demo_organization_id: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          demo_organization_id?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_application_requests_demo_organization_id_fkey"
            columns: ["demo_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_evaluation_progress: {
        Row: {
          clarity: number | null
          completed_at: string | null
          demo_organization_id: string
          duration_seconds: number | null
          ease: number | null
          rated_at: string | null
          rating: number | null
          rating_comment: string | null
          step_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clarity?: number | null
          completed_at?: string | null
          demo_organization_id: string
          duration_seconds?: number | null
          ease?: number | null
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          step_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clarity?: number | null
          completed_at?: string | null
          demo_organization_id?: string
          duration_seconds?: number | null
          ease?: number | null
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          step_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_evaluation_progress_demo_organization_id_fkey"
            columns: ["demo_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          created_at: string
          department_type: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          department_type?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          department_type?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_certificates: {
        Row: {
          certificate_number: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          issue_date: string | null
          issuer: string | null
          organization_id: string
          title: string
          title_en: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          issue_date?: string | null
          issuer?: string | null
          organization_id: string
          title: string
          title_en?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          certificate_number?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          issue_date?: string | null
          issuer?: string | null
          organization_id?: string
          title?: string
          title_en?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_certificates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_certificates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_evaluations: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          created_at: string
          created_by: string | null
          criteria: Json
          employee_acknowledged_at: string | null
          employee_acknowledged_by: string | null
          employee_agreement: string | null
          employee_comment: string | null
          employee_id: string
          evaluation_date: string
          evaluation_period: string | null
          evaluator_user_id: string | null
          finalized_at: string | null
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          notes: string | null
          organization_id: string
          overall_score: number | null
          result: string | null
          result_en: string | null
          status: string
          title: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          employee_acknowledged_at?: string | null
          employee_acknowledged_by?: string | null
          employee_agreement?: string | null
          employee_comment?: string | null
          employee_id: string
          evaluation_date: string
          evaluation_period?: string | null
          evaluator_user_id?: string | null
          finalized_at?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          overall_score?: number | null
          result?: string | null
          result_en?: string | null
          status?: string
          title: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          created_at?: string
          created_by?: string | null
          criteria?: Json
          employee_acknowledged_at?: string | null
          employee_acknowledged_by?: string | null
          employee_agreement?: string | null
          employee_comment?: string | null
          employee_id?: string
          evaluation_date?: string
          evaluation_period?: string | null
          evaluator_user_id?: string | null
          finalized_at?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          overall_score?: number | null
          result?: string | null
          result_en?: string | null
          status?: string
          title?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_position_acknowledgements: {
        Row: {
          acknowledged_at: string
          acknowledged_by: string
          acknowledged_by_name: string | null
          description_version: number
          employee_id: string
          id: string
          organization_id: string
          position_name: string
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_by?: string
          acknowledged_by_name?: string | null
          description_version: number
          employee_id: string
          id?: string
          organization_id: string
          position_name: string
        }
        Update: {
          acknowledged_at?: string
          acknowledged_by?: string
          acknowledged_by_name?: string | null
          description_version?: number
          employee_id?: string
          id?: string
          organization_id?: string
          position_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_position_acknowledgements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_position_acknowledgements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_surveillance_batches: {
        Row: {
          batch_code: string
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          notes: string | null
          organization_id: string
          screening_types: string[]
          started_at: string
          updated_at: string
        }
        Insert: {
          batch_code: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          screening_types?: string[]
          started_at: string
          updated_at?: string
        }
        Update: {
          batch_code?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          screening_types?: string[]
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_surveillance_batches_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_surveillance_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_surveillance_records: {
        Row: {
          batch_id: string | null
          correction_reason: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          intervention: string | null
          intervention_end: string | null
          intervention_start: string | null
          intervention_status: string
          intervention_type: string | null
          no_intervention: boolean
          no_recheck: boolean
          notes: string | null
          organization_id: string
          recheck_due: string | null
          result_status: string
          screening_types: string[]
          started_at: string
          status: string
          surveillance_code: string
          timeline: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          batch_id?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          intervention?: string | null
          intervention_end?: string | null
          intervention_start?: string | null
          intervention_status?: string
          intervention_type?: string | null
          no_intervention?: boolean
          no_recheck?: boolean
          notes?: string | null
          organization_id: string
          recheck_due?: string | null
          result_status?: string
          screening_types?: string[]
          started_at: string
          status?: string
          surveillance_code: string
          timeline?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          batch_id?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          intervention?: string | null
          intervention_end?: string | null
          intervention_start?: string | null
          intervention_status?: string
          intervention_type?: string | null
          no_intervention?: boolean
          no_recheck?: boolean
          notes?: string | null
          organization_id?: string
          recheck_due?: string | null
          result_status?: string
          screening_types?: string[]
          started_at?: string
          status?: string
          surveillance_code?: string
          timeline?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_surveillance_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "employee_surveillance_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_surveillance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_surveillance_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_training_summary: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          organization_id: string
          status: string
          title: string
          title_en: string | null
          training_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          organization_id: string
          status?: string
          title: string
          title_en?: string | null
          training_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          organization_id?: string
          status?: string
          title?: string
          title_en?: string | null
          training_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_training_summary_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_training_summary_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vaccinations: {
        Row: {
          clinical_notes: string | null
          created_at: string
          created_by: string | null
          dose: string | null
          employee_id: string
          id: string
          lot_number: string | null
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
          vaccination_date: string
          vaccine_item_id: string | null
          vaccine_label_snapshot: string
          valid_until: string | null
        }
        Insert: {
          clinical_notes?: string | null
          created_at?: string
          created_by?: string | null
          dose?: string | null
          employee_id: string
          id?: string
          lot_number?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vaccination_date: string
          vaccine_item_id?: string | null
          vaccine_label_snapshot: string
          valid_until?: string | null
        }
        Update: {
          clinical_notes?: string | null
          created_at?: string
          created_by?: string | null
          dose?: string | null
          employee_id?: string
          id?: string
          lot_number?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vaccination_date?: string
          vaccine_item_id?: string | null
          vaccine_label_snapshot?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_vaccinations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_vaccinations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_vaccinations_vaccine_item_id_fkey"
            columns: ["vaccine_item_id"]
            isOneToOne: false
            referencedRelation: "master_library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          birth_date: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          department_name: string | null
          department_name_en: string | null
          email: string | null
          employee_code: string
          employment_status: string
          father_name: string | null
          first_name: string
          first_name_en: string | null
          hire_date: string | null
          id: string
          last_name: string
          last_name_en: string | null
          organization_id: string
          phone: string | null
          position_name: string | null
          position_name_en: string | null
          profession_name: string | null
          profession_name_en: string | null
          professional_category_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          department_name?: string | null
          department_name_en?: string | null
          email?: string | null
          employee_code: string
          employment_status?: string
          father_name?: string | null
          first_name: string
          first_name_en?: string | null
          hire_date?: string | null
          id?: string
          last_name: string
          last_name_en?: string | null
          organization_id: string
          phone?: string | null
          position_name?: string | null
          position_name_en?: string | null
          profession_name?: string | null
          profession_name_en?: string | null
          professional_category_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          department_name?: string | null
          department_name_en?: string | null
          email?: string | null
          employee_code?: string
          employment_status?: string
          father_name?: string | null
          first_name?: string
          first_name_en?: string | null
          hire_date?: string | null
          id?: string
          last_name?: string
          last_name_en?: string | null
          organization_id?: string
          phone?: string | null
          position_name?: string | null
          position_name_en?: string | null
          profession_name?: string | null
          profession_name_en?: string | null
          professional_category_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_professional_category_id_fkey"
            columns: ["professional_category_id"]
            isOneToOne: false
            referencedRelation: "master_library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      environmental_standards: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          payload: Json
          record_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          payload?: Json
          record_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          record_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "environmental_standards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_reference_versions: {
        Row: {
          authority: string
          checked_at: string | null
          created_at: string
          id: string
          metadata: Json
          organization_id: string | null
          published_at: string | null
          reviewed_by: string | null
          source_key: string
          source_url: string | null
          status: string
          title: string
          version_label: string | null
        }
        Insert: {
          authority: string
          checked_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          published_at?: string | null
          reviewed_by?: string | null
          source_key: string
          source_url?: string | null
          status?: string
          title: string
          version_label?: string | null
        }
        Update: {
          authority?: string
          checked_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          published_at?: string | null
          reviewed_by?: string | null
          source_key?: string
          source_url?: string | null
          status?: string
          title?: string
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_reference_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hai_classifications: {
        Row: {
          case_status: string
          classified_at: string
          classified_by: string
          created_at: string
          criteria_evidence: Json
          criteria_met: boolean | null
          definition_set: string
          definition_version: string | null
          hai_type: string
          id: string
          organization_id: string
          patient_id: string
          rationale: string | null
          surveillance_case_id: string
          updated_at: string
        }
        Insert: {
          case_status: string
          classified_at?: string
          classified_by: string
          created_at?: string
          criteria_evidence?: Json
          criteria_met?: boolean | null
          definition_set: string
          definition_version?: string | null
          hai_type: string
          id?: string
          organization_id: string
          patient_id: string
          rationale?: string | null
          surveillance_case_id: string
          updated_at?: string
        }
        Update: {
          case_status?: string
          classified_at?: string
          classified_by?: string
          created_at?: string
          criteria_evidence?: Json
          criteria_met?: boolean | null
          definition_set?: string
          definition_version?: string | null
          hai_type?: string
          id?: string
          organization_id?: string
          patient_id?: string
          rationale?: string | null
          surveillance_case_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hai_classifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_classifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hai_classifications_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      hand_hygiene_observations: {
        Row: {
          action: string
          created_at: string
          gloves: boolean
          id: string
          notes: string | null
          organization_id: string
          professional_category: string
          professionals_count: number
          session_id: string
          sort_order: number
          updated_at: string
          who_moment: string
          who_moments: string[] | null
        }
        Insert: {
          action: string
          created_at?: string
          gloves?: boolean
          id?: string
          notes?: string | null
          organization_id: string
          professional_category: string
          professionals_count?: number
          session_id: string
          sort_order?: number
          updated_at?: string
          who_moment: string
          who_moments?: string[] | null
        }
        Update: {
          action?: string
          created_at?: string
          gloves?: boolean
          id?: string
          notes?: string | null
          organization_id?: string
          professional_category?: string
          professionals_count?: number
          session_id?: string
          sort_order?: number
          updated_at?: string
          who_moment?: string
          who_moments?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "hand_hygiene_observations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hand_hygiene_observations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "hand_hygiene_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hand_hygiene_sessions: {
        Row: {
          compliant_observations: number
          created_at: string
          created_by: string | null
          department_id: string | null
          end_time: string | null
          id: string
          notes: string | null
          observation_date: string
          observations: number
          observer_id: string | null
          observer_name: string | null
          organization_id: string
          professional_category: string | null
          source_standard: string
          source_version: string | null
          start_time: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          compliant_observations?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          observation_date: string
          observations?: number
          observer_id?: string | null
          observer_name?: string | null
          organization_id: string
          professional_category?: string | null
          source_standard?: string
          source_version?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          compliant_observations?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          observation_date?: string
          observations?: number
          observer_id?: string | null
          observer_name?: string | null
          organization_id?: string
          professional_category?: string | null
          source_standard?: string
          source_version?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hand_hygiene_sessions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hand_hygiene_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_structure_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          icu_beds: number | null
          id: string
          infection_control_nurses: number | null
          infectious_disease_physicians: number | null
          microbiologists: number | null
          notes: string | null
          organization_id: string
          single_rooms: number | null
          total_beds: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date: string
          icu_beds?: number | null
          id?: string
          infection_control_nurses?: number | null
          infectious_disease_physicians?: number | null
          microbiologists?: number | null
          notes?: string | null
          organization_id: string
          single_rooms?: number | null
          total_beds?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          icu_beds?: number | null
          id?: string
          infection_control_nurses?: number | null
          infectious_disease_physicians?: number | null
          microbiologists?: number | null
          notes?: string | null
          organization_id?: string
          single_rooms?: number | null
          total_beds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_structure_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_definitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calculation_type: string
          category: string
          created_at: string
          created_by: string | null
          denominator_definition: Json
          denominator_metric: string | null
          direction: string
          effective_from: string | null
          effective_to: string | null
          id: string
          indicator_key: string
          multiplier: number
          numerator_definition: Json
          numerator_metric: string | null
          organization_id: string | null
          source_authority: string | null
          status: string
          target_value: number | null
          title_el: string
          title_en: string
          unit: string | null
          unit_en: string | null
          version: string
          visible_department_ids: Json
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calculation_type?: string
          category: string
          created_at?: string
          created_by?: string | null
          denominator_definition?: Json
          denominator_metric?: string | null
          direction?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          indicator_key: string
          multiplier?: number
          numerator_definition?: Json
          numerator_metric?: string | null
          organization_id?: string | null
          source_authority?: string | null
          status?: string
          target_value?: number | null
          title_el: string
          title_en: string
          unit?: string | null
          unit_en?: string | null
          version: string
          visible_department_ids?: Json
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calculation_type?: string
          category?: string
          created_at?: string
          created_by?: string | null
          denominator_definition?: Json
          denominator_metric?: string | null
          direction?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          indicator_key?: string
          multiplier?: number
          numerator_definition?: Json
          numerator_metric?: string | null
          organization_id?: string | null
          source_authority?: string | null
          status?: string
          target_value?: number | null
          title_el?: string
          title_en?: string
          unit?: string | null
          unit_en?: string | null
          version?: string
          visible_department_ids?: Json
        }
        Relationships: [
          {
            foreignKeyName: "indicator_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_snapshots: {
        Row: {
          calculated_at: string
          calculated_by: string | null
          calculation_type: string
          created_at: string
          definition_id: string | null
          denominator: number | null
          department_id: string | null
          direction: string
          id: string
          indicator_key: string
          notes: string | null
          numerator: number | null
          organization_id: string
          period_end: string
          period_start: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_snapshot: Json
          status: string
          target_value: number | null
          unit: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          calculated_at?: string
          calculated_by?: string | null
          calculation_type?: string
          created_at?: string
          definition_id?: string | null
          denominator?: number | null
          department_id?: string | null
          direction?: string
          id?: string
          indicator_key: string
          notes?: string | null
          numerator?: number | null
          organization_id: string
          period_end: string
          period_start: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_snapshot?: Json
          status?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          calculated_at?: string
          calculated_by?: string | null
          calculation_type?: string
          created_at?: string
          definition_id?: string | null
          denominator?: number | null
          department_id?: string | null
          direction?: string
          id?: string
          indicator_key?: string
          notes?: string | null
          numerator?: number | null
          organization_id?: string
          period_end?: string
          period_start?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_snapshot?: Json
          status?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_snapshots_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "indicator_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_snapshots_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      isolation_episodes: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          id: string
          organization_id: string
          patient_id: string
          precautions: Json
          reason: string
          review_due_at: string | null
          room: string | null
          started_at: string
          status: string
          surveillance_case_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          organization_id: string
          patient_id: string
          precautions?: Json
          reason: string
          review_due_at?: string | null
          room?: string | null
          started_at: string
          status?: string
          surveillance_case_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          precautions?: Json
          reason?: string
          review_due_at?: string | null
          room?: string | null
          started_at?: string
          status?: string
          surveillance_case_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "isolation_episodes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isolation_episodes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isolation_episodes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "isolation_episodes_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratory_samples: {
        Row: {
          collected_at: string | null
          correction_reason: string | null
          created_at: string
          created_by: string
          department_id: string | null
          documents_reviewed_at: string | null
          documents_reviewed_by: string | null
          employee_surveillance_batch_id: string | null
          employee_surveillance_id: string | null
          environmental_batch_id: string | null
          environmental_method: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          location: string | null
          organization_id: string
          parent_sample_id: string | null
          patient_id: string | null
          point: string | null
          priority: string
          received_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          requested_at: string | null
          requested_by: string | null
          sample_code: string
          sample_type: string
          source_site: string | null
          specimen_condition: string | null
          status: string
          subject_code: string | null
          subject_name: string | null
          subject_type: string | null
          surveillance_case_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          collected_at?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          documents_reviewed_at?: string | null
          documents_reviewed_by?: string | null
          employee_surveillance_batch_id?: string | null
          employee_surveillance_id?: string | null
          environmental_batch_id?: string | null
          environmental_method?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          location?: string | null
          organization_id: string
          parent_sample_id?: string | null
          patient_id?: string | null
          point?: string | null
          priority?: string
          received_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by?: string | null
          sample_code: string
          sample_type: string
          source_site?: string | null
          specimen_condition?: string | null
          status?: string
          subject_code?: string | null
          subject_name?: string | null
          subject_type?: string | null
          surveillance_case_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          collected_at?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          documents_reviewed_at?: string | null
          documents_reviewed_by?: string | null
          employee_surveillance_batch_id?: string | null
          employee_surveillance_id?: string | null
          environmental_batch_id?: string | null
          environmental_method?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          location?: string | null
          organization_id?: string
          parent_sample_id?: string | null
          patient_id?: string | null
          point?: string | null
          priority?: string
          received_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by?: string | null
          sample_code?: string
          sample_type?: string
          source_site?: string | null
          specimen_condition?: string | null
          status?: string
          subject_code?: string | null
          subject_name?: string | null
          subject_type?: string | null
          surveillance_case_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laboratory_samples_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratory_samples_employee_surveillance_batch_id_fkey"
            columns: ["employee_surveillance_batch_id"]
            isOneToOne: false
            referencedRelation: "employee_surveillance_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratory_samples_employee_surveillance_id_fkey"
            columns: ["employee_surveillance_id"]
            isOneToOne: false
            referencedRelation: "employee_surveillance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratory_samples_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratory_samples_parent_sample_id_fkey"
            columns: ["parent_sample_id"]
            isOneToOne: false
            referencedRelation: "laboratory_samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratory_samples_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laboratory_samples_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      lira_ai_provider_settings: {
        Row: {
          allow_aggregate_data: boolean
          allow_patient_level_data: boolean
          configured_at: string | null
          configured_by: string | null
          enabled: boolean
          key_hint: string | null
          model: string | null
          organization_id: string
          provider: string
          secret_id: string | null
          updated_at: string
        }
        Insert: {
          allow_aggregate_data?: boolean
          allow_patient_level_data?: boolean
          configured_at?: string | null
          configured_by?: string | null
          enabled?: boolean
          key_hint?: string | null
          model?: string | null
          organization_id: string
          provider?: string
          secret_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_aggregate_data?: boolean
          allow_patient_level_data?: boolean
          configured_at?: string | null
          configured_by?: string | null
          enabled?: boolean
          key_hint?: string | null
          model?: string | null
          organization_id?: string
          provider?: string
          secret_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lira_ai_provider_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lira_knowledge_chunks: {
        Row: {
          chunk_index: number
          citation_label: string | null
          content: string
          content_hash: string | null
          created_at: string
          embedded_at: string | null
          embedding: string | null
          embedding_model: string | null
          embedding_status: string
          heading: string | null
          id: string
          metadata: Json
          page_end: number | null
          page_start: number | null
          search_tsv: unknown
          source_id: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          citation_label?: string | null
          content: string
          content_hash?: string | null
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string
          heading?: string | null
          id?: string
          metadata?: Json
          page_end?: number | null
          page_start?: number | null
          search_tsv?: unknown
          source_id: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          citation_label?: string | null
          content?: string
          content_hash?: string | null
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string
          heading?: string | null
          id?: string
          metadata?: Json
          page_end?: number | null
          page_start?: number | null
          search_tsv?: unknown
          source_id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lira_knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lira_knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lira_knowledge_source_revisions: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          revision_no: number
          snapshot: Json
          source_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          revision_no: number
          snapshot: Json
          source_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          revision_no?: number
          snapshot?: Json
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lira_knowledge_source_revisions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lira_knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lira_knowledge_sources: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          authority: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          ingestion_status: string
          language: string
          metadata: Json
          organization_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: string
          source_url: string | null
          source_version: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          authority: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          ingestion_status?: string
          language?: string
          metadata?: Json
          organization_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: string
          source_url?: string | null
          source_version?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          authority?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          ingestion_status?: string
          language?: string
          metadata?: Json
          organization_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: string
          source_url?: string | null
          source_version?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lira_knowledge_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lira_outbreak_case_reviews: {
        Row: {
          classification: string
          created_at: string
          id: string
          investigation_id: string
          organization_id: string
          patient_id: string | null
          rationale: string
          record_key: string
          reviewed_at: string
          reviewer_id: string
          supersedes_review_id: string | null
        }
        Insert: {
          classification: string
          created_at?: string
          id?: string
          investigation_id: string
          organization_id: string
          patient_id?: string | null
          rationale: string
          record_key: string
          reviewed_at?: string
          reviewer_id?: string
          supersedes_review_id?: string | null
        }
        Update: {
          classification?: string
          created_at?: string
          id?: string
          investigation_id?: string
          organization_id?: string
          patient_id?: string | null
          rationale?: string
          record_key?: string
          reviewed_at?: string
          reviewer_id?: string
          supersedes_review_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lira_outbreak_case_reviews_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "lira_outbreak_investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lira_outbreak_case_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lira_outbreak_case_reviews_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lira_outbreak_case_reviews_supersedes_review_id_fkey"
            columns: ["supersedes_review_id"]
            isOneToOne: false
            referencedRelation: "lira_outbreak_case_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      lira_outbreak_investigation_events: {
        Row: {
          created_at: string
          created_by: string
          event_type: string
          id: string
          investigation_id: string
          organization_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          created_by?: string
          event_type: string
          id?: string
          investigation_id: string
          organization_id: string
          payload?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          event_type?: string
          id?: string
          investigation_id?: string
          organization_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lira_outbreak_investigation_events_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "lira_outbreak_investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lira_outbreak_investigation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lira_outbreak_investigations: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          decisions: Json
          definition_id: string | null
          definition_json: Json
          definition_version: string | null
          department_id: string | null
          hypotheses: Json
          id: string
          organism: string | null
          organization_id: string
          scope_from: string | null
          scope_to: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          decisions?: Json
          definition_id?: string | null
          definition_json?: Json
          definition_version?: string | null
          department_id?: string | null
          hypotheses?: Json
          id?: string
          organism?: string | null
          organization_id: string
          scope_from?: string | null
          scope_to?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          decisions?: Json
          definition_id?: string | null
          definition_json?: Json
          definition_version?: string | null
          department_id?: string | null
          hypotheses?: Json
          id?: string
          organism?: string | null
          organization_id?: string
          scope_from?: string | null
          scope_to?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lira_outbreak_investigations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lira_outbreak_investigations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      management_announcement_acknowledgements: {
        Row: {
          acknowledged_at: string
          announcement_id: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          announcement_id: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          announcement_id?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_announcement_acknowledgements_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "management_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_announcement_acknowledgements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      management_announcements: {
        Row: {
          audience_type: string
          audience_values: Json
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          link_path: string | null
          message: string
          organization_id: string
          priority: string
          requires_ack: boolean
          starts_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience_type?: string
          audience_values?: Json
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          link_path?: string | null
          message: string
          organization_id: string
          priority?: string
          requires_ack?: boolean
          starts_at?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience_type?: string
          audience_values?: Json
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          link_path?: string | null
          message?: string
          organization_id?: string
          priority?: string
          requires_ack?: boolean
          starts_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "management_announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      master_library_items: {
        Row: {
          category: string | null
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          library_key: string
          metadata: Json
          name_el: string
          name_en: string | null
          organization_id: string | null
          origin_item_id: string | null
          source_authority: string | null
          source_version: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          library_key: string
          metadata?: Json
          name_el: string
          name_en?: string | null
          organization_id?: string | null
          origin_item_id?: string | null
          source_authority?: string | null
          source_version?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          library_key?: string
          metadata?: Json
          name_el?: string
          name_en?: string | null
          organization_id?: string | null
          origin_item_id?: string | null
          source_authority?: string | null
          source_version?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_library_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_library_items_origin_item_id_fkey"
            columns: ["origin_item_id"]
            isOneToOne: false
            referencedRelation: "master_library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      microbiology_results: {
        Row: {
          amended_from: string | null
          cfu_count: number | null
          cfu_limit: number | null
          created_at: string
          created_by: string
          critical_communicated_at: string | null
          critical_communicated_to: string | null
          id: string
          interpretation_standard: string | null
          interpretation_version: string | null
          is_critical: boolean
          method: string | null
          organism: string | null
          organisms: Json
          organization_id: string
          preliminary: boolean
          resistance_class: string | null
          result_status: string
          resulted_at: string
          sample_id: string
          susceptibility_summary: string | null
          updated_at: string
          updated_by: string | null
          validated_at: string | null
          validated_by: string | null
          validation_status: string
          within_limit: boolean | null
        }
        Insert: {
          amended_from?: string | null
          cfu_count?: number | null
          cfu_limit?: number | null
          created_at?: string
          created_by: string
          critical_communicated_at?: string | null
          critical_communicated_to?: string | null
          id?: string
          interpretation_standard?: string | null
          interpretation_version?: string | null
          is_critical?: boolean
          method?: string | null
          organism?: string | null
          organisms?: Json
          organization_id: string
          preliminary?: boolean
          resistance_class?: string | null
          result_status: string
          resulted_at?: string
          sample_id: string
          susceptibility_summary?: string | null
          updated_at?: string
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
          within_limit?: boolean | null
        }
        Update: {
          amended_from?: string | null
          cfu_count?: number | null
          cfu_limit?: number | null
          created_at?: string
          created_by?: string
          critical_communicated_at?: string | null
          critical_communicated_to?: string | null
          id?: string
          interpretation_standard?: string | null
          interpretation_version?: string | null
          is_critical?: boolean
          method?: string | null
          organism?: string | null
          organisms?: Json
          organization_id?: string
          preliminary?: boolean
          resistance_class?: string | null
          result_status?: string
          resulted_at?: string
          sample_id?: string
          susceptibility_summary?: string | null
          updated_at?: string
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
          within_limit?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "microbiology_results_amended_from_fkey"
            columns: ["amended_from"]
            isOneToOne: false
            referencedRelation: "microbiology_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microbiology_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microbiology_results_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "laboratory_samples"
            referencedColumns: ["id"]
          },
        ]
      }
      notifiable_disease_reports: {
        Row: {
          created_at: string
          disease_code: string
          finding_key: string
          id: string
          notes: string | null
          notified_at: string | null
          organization_id: string
          reference: string | null
          sample_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          disease_code: string
          finding_key: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          organization_id: string
          reference?: string | null
          sample_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          disease_code?: string
          finding_key?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          organization_id?: string
          reference?: string | null
          sample_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifiable_disease_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiable_disease_reports_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "laboratory_samples"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_error: string | null
          notification_type: string
          organization_id: string
          payload: Json
          recipient_email: string
          recipient_user_id: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          last_error?: string | null
          notification_type: string
          organization_id: string
          payload?: Json
          recipient_email: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          last_error?: string | null
          notification_type?: string
          organization_id?: string
          payload?: Json
          recipient_email?: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      occupational_exposure_incidents: {
        Row: {
          body_site: string | null
          created_at: string
          created_by: string | null
          device_or_source: string | null
          employee_id: string
          exposure_type: string
          follow_up_due_at: string | null
          follow_up_status: string
          id: string
          incident_date: string
          notes: string | null
          organization_id: string
          pep_administered: boolean | null
          pep_details: string | null
          reported_at: string
          source_patient_status: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_site?: string | null
          created_at?: string
          created_by?: string | null
          device_or_source?: string | null
          employee_id: string
          exposure_type: string
          follow_up_due_at?: string | null
          follow_up_status?: string
          id?: string
          incident_date: string
          notes?: string | null
          organization_id: string
          pep_administered?: boolean | null
          pep_details?: string | null
          reported_at?: string
          source_patient_status?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_site?: string | null
          created_at?: string
          created_by?: string | null
          device_or_source?: string | null
          employee_id?: string
          exposure_type?: string
          follow_up_due_at?: string | null
          follow_up_status?: string
          id?: string
          incident_date?: string
          notes?: string | null
          organization_id?: string
          pep_administered?: boolean | null
          pep_details?: string | null
          reported_at?: string
          source_patient_status?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occupational_exposure_incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupational_exposure_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      occupational_health_visits: {
        Row: {
          clinical_notes: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          fitness_status: string | null
          follow_up_date: string | null
          id: string
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
          visit_date: string
          visit_type: string
        }
        Insert: {
          clinical_notes?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          fitness_status?: string | null
          follow_up_date?: string | null
          id?: string
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          visit_date: string
          visit_type: string
        }
        Update: {
          clinical_notes?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          fitness_status?: string | null
          follow_up_date?: string | null
          id?: string
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          visit_date?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "occupational_health_visits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupational_health_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_capabilities: {
        Row: {
          capability: string
          created_at: string
          effect: string
          granted_by: string | null
          id: string
          membership_id: string
        }
        Insert: {
          capability: string
          created_at?: string
          effect?: string
          granted_by?: string | null
          id?: string
          membership_id: string
        }
        Update: {
          capability?: string
          created_at?: string
          effect?: string
          granted_by?: string | null
          id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_capabilities_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_scopes: {
        Row: {
          created_at: string
          department_id: string
          id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          membership_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_scopes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_scopes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          access_hold: string | null
          created_at: string
          custom_role_id: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          screen_guides: boolean | null
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_hold?: string | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          screen_guides?: boolean | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_hold?: string | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          screen_guides?: boolean | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          bed_capacity: number | null
          branding: Json
          city: string | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string
          deletion_export_waived_reason: string | null
          deletion_reason: string | null
          deletion_requested_at: string | null
          deletion_requested_by: string | null
          deletion_scheduled_at: string | null
          enabled_addons: string[]
          enabled_modules: string[] | null
          health_region: string | null
          id: string
          idle_lock_minutes: number
          is_demo: boolean
          name: string
          operating_profile: string
          parent_id: string | null
          paused_at: string | null
          region: string | null
          screen_guides_enabled: boolean | null
          status: Database["public"]["Enums"]["organization_status"]
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        Insert: {
          bed_capacity?: number | null
          branding?: Json
          city?: string | null
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          deletion_export_waived_reason?: string | null
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          deletion_scheduled_at?: string | null
          enabled_addons?: string[]
          enabled_modules?: string[] | null
          health_region?: string | null
          id?: string
          idle_lock_minutes?: number
          is_demo?: boolean
          name: string
          operating_profile?: string
          parent_id?: string | null
          paused_at?: string | null
          region?: string | null
          screen_guides_enabled?: boolean | null
          status?: Database["public"]["Enums"]["organization_status"]
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Update: {
          bed_capacity?: number | null
          branding?: Json
          city?: string | null
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          deletion_export_waived_reason?: string | null
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          deletion_scheduled_at?: string | null
          enabled_addons?: string[]
          enabled_modules?: string[] | null
          health_region?: string | null
          id?: string
          idle_lock_minutes?: number
          is_demo?: boolean
          name?: string
          operating_profile?: string
          parent_id?: string | null
          paused_at?: string | null
          region?: string | null
          screen_guides_enabled?: boolean | null
          status?: Database["public"]["Enums"]["organization_status"]
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_admissions: {
        Row: {
          admission_date: string
          created_at: string
          created_by: string | null
          department_id: string | null
          discharge_date: string | null
          id: string
          notes: string | null
          organization_id: string
          patient_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admission_date: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          discharge_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          patient_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admission_date?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          discharge_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          patient_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_admissions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_admissions_department_organization_fk"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "patient_admissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_admissions_patient_organization_fk"
            columns: ["organization_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      patient_clinical_scale_assessments: {
        Row: {
          admission_id: string | null
          amended_at: string | null
          answers: Json
          assessed_at: string
          assessor_email: string | null
          assessor_job_title: string | null
          assessor_name: string | null
          created_at: string
          created_by: string
          id: string
          interpretation: string | null
          organization_id: string
          patient_id: string
          report_snapshot: Json
          scale_definition_id: string
          scale_key: string
          scale_version: string
          score: number
          score_parts: Json
          status: string
        }
        Insert: {
          admission_id?: string | null
          amended_at?: string | null
          answers: Json
          assessed_at?: string
          assessor_email?: string | null
          assessor_job_title?: string | null
          assessor_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          interpretation?: string | null
          organization_id: string
          patient_id: string
          report_snapshot?: Json
          scale_definition_id: string
          scale_key: string
          scale_version: string
          score: number
          score_parts?: Json
          status?: string
        }
        Update: {
          admission_id?: string | null
          amended_at?: string | null
          answers?: Json
          assessed_at?: string
          assessor_email?: string | null
          assessor_job_title?: string | null
          assessor_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          interpretation?: string | null
          organization_id?: string
          patient_id?: string
          report_snapshot?: Json
          scale_definition_id?: string
          scale_key?: string
          scale_version?: string
          score?: number
          score_parts?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_clinical_scale_assessments_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "patient_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_clinical_scale_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_clinical_scale_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_clinical_scale_assessments_scale_definition_id_fkey"
            columns: ["scale_definition_id"]
            isOneToOne: false
            referencedRelation: "clinical_scale_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_day_periods: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          notes: string | null
          organization_id: string
          patient_days: number
          period_end: string
          period_start: string
          review_status: string
          source: string
          source_reference: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          patient_days: number
          period_end: string
          period_start: string
          review_status?: string
          source?: string
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          patient_days?: number
          period_end?: string
          period_start?: string
          review_status?: string
          source?: string
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_day_periods_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_day_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_days: {
        Row: {
          calculated_at: string | null
          census_date: string
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          organization_id: string
          patient_days: number
          review_status: string
          source: string
          source_reference: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          calculated_at?: string | null
          census_date: string
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          organization_id: string
          patient_days: number
          review_status?: string
          source: string
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          calculated_at?: string | null
          census_date?: string
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          organization_id?: string
          patient_days?: number
          review_status?: string
          source?: string
          source_reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_days_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_days_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          admission_date: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          birth_weight_grams: number | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          department_id: string | null
          discharge_date: string | null
          father_name: string | null
          first_name: string | null
          gestational_age_weeks: number | null
          hospital_record_number: string | null
          id: string
          last_name: string | null
          notes: string | null
          organization_id: string
          patient_code: string
          sex: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admission_date?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          birth_weight_grams?: number | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          discharge_date?: string | null
          father_name?: string | null
          first_name?: string | null
          gestational_age_weeks?: number | null
          hospital_record_number?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          organization_id: string
          patient_code: string
          sex?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admission_date?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          birth_weight_grams?: number | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          discharge_date?: string | null
          father_name?: string | null
          first_name?: string | null
          gestational_age_weeks?: number | null
          hospital_record_number?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          organization_id?: string
          patient_code?: string
          sex?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_demo_entitlements: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          demo_user_id: string | null
          id: string
          label: string
          organization_id: string | null
          status: string
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          demo_user_id?: string | null
          id?: string
          label: string
          organization_id?: string | null
          status?: string
          updated_at?: string
          valid_from: string
          valid_until: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          demo_user_id?: string | null
          id?: string
          label?: string
          organization_id?: string | null
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_demo_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_organization_exports: {
        Row: {
          created_at: string
          created_by: string | null
          file_size: number | null
          files_count: number | null
          id: string
          organization_code: string | null
          organization_name: string
          rows_count: number | null
          source_organization_id: string | null
          storage_path: string
          tables_count: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          files_count?: number | null
          id?: string
          organization_code?: string | null
          organization_name: string
          rows_count?: number | null
          source_organization_id?: string | null
          storage_path: string
          tables_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          files_count?: number | null
          id?: string
          organization_code?: string | null
          organization_name?: string
          rows_count?: number | null
          source_organization_id?: string | null
          storage_path?: string
          tables_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_organization_exports_source_organization_id_fkey"
            columns: ["source_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_purge_tickets: {
        Row: {
          actor_user_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          organization_id: string
        }
        Insert: {
          actor_user_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          actor_user_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: []
      }
      platform_reauth_failures: {
        Row: {
          actor_user_id: string
          created_at: string
          id: number
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          id?: never
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: never
        }
        Relationships: []
      }
      platform_runtime_events: {
        Row: {
          actor_id: string | null
          app_version: string | null
          created_at: string
          diagnostic_code: string | null
          event_type: string
          id: string
          module: string | null
          occurred_at: string
          operation: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"] | null
          route: string | null
          severity: string
          user_message: string
        }
        Insert: {
          actor_id?: string | null
          app_version?: string | null
          created_at?: string
          diagnostic_code?: string | null
          event_type?: string
          id?: string
          module?: string | null
          occurred_at?: string
          operation?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"] | null
          route?: string | null
          severity: string
          user_message: string
        }
        Update: {
          actor_id?: string | null
          app_version?: string | null
          created_at?: string
          diagnostic_code?: string | null
          event_type?: string
          id?: string
          module?: string | null
          occurred_at?: string
          operation?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          route?: string | null
          severity?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_runtime_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          default_demo_duration_days: number
          demo_auto_purge_after_days: number
          id: string
          maintenance_notice_el: string
          maintenance_notice_en: string
          maintenance_notice_enabled: boolean
          max_demo_users: number
          organization_deletion_grace_days: number
          support_email: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          default_demo_duration_days?: number
          demo_auto_purge_after_days?: number
          id?: string
          maintenance_notice_el?: string
          maintenance_notice_en?: string
          maintenance_notice_enabled?: boolean
          max_demo_users?: number
          organization_deletion_grace_days?: number
          support_email?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          default_demo_duration_days?: number
          demo_auto_purge_after_days?: number
          id?: string
          maintenance_notice_el?: string
          maintenance_notice_en?: string
          maintenance_notice_enabled?: boolean
          max_demo_users?: number
          organization_deletion_grace_days?: number
          support_email?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_update_runs: {
        Row: {
          changed_count: number
          checked_count: number
          completed_at: string | null
          error_count: number
          id: string
          started_at: string
          started_by: string | null
          status: string
          summary: Json
          trigger: string
        }
        Insert: {
          changed_count?: number
          checked_count?: number
          completed_at?: string | null
          error_count?: number
          id?: string
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: Json
          trigger?: string
        }
        Update: {
          changed_count?: number
          checked_count?: number
          completed_at?: string | null
          error_count?: number
          id?: string
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: Json
          trigger?: string
        }
        Relationships: []
      }
      point_prevalence_surveys: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          notes: string | null
          organization_id: string
          patients_on_antibiotics: number
          patients_total: number
          patients_with_hai: number
          responsible_name: string | null
          survey_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          patients_on_antibiotics: number
          patients_total: number
          patients_with_hai: number
          responsible_name?: string | null
          survey_date: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          patients_on_antibiotics?: number
          patients_total?: number
          patients_with_hai?: number
          responsible_name?: string | null
          survey_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_prevalence_surveys_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_prevalence_surveys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prevention_bundle_assessments: {
        Row: {
          assessment_date: string
          bundle_key: string
          created_at: string
          created_by: string | null
          criteria: Json
          department_id: string | null
          evidence: Json
          id: string
          organization_id: string
          period_label: string | null
          score: number | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assessment_date: string
          bundle_key: string
          created_at?: string
          created_by?: string | null
          criteria?: Json
          department_id?: string | null
          evidence?: Json
          id?: string
          organization_id: string
          period_label?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assessment_date?: string
          bundle_key?: string
          created_at?: string
          created_by?: string | null
          criteria?: Json
          department_id?: string | null
          evidence?: Json
          id?: string
          organization_id?: string
          period_label?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prevention_bundle_assessments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prevention_bundle_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prevention_bundle_templates: {
        Row: {
          based_on: string | null
          bundle_key: string
          created_at: string
          created_by: string | null
          departments: Json
          elements: Json
          hidden: boolean
          id: string
          is_system: boolean
          name: string
          organization_id: string | null
          published_at: string | null
          published_by: string | null
          retired_at: string | null
          retired_by: string | null
          scope: string
          source: string
          source_version: string
          status: string
          title_el: string
          title_en: string
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          based_on?: string | null
          bundle_key: string
          created_at?: string
          created_by?: string | null
          departments?: Json
          elements?: Json
          hidden?: boolean
          id?: string
          is_system?: boolean
          name: string
          organization_id?: string | null
          published_at?: string | null
          published_by?: string | null
          retired_at?: string | null
          retired_by?: string | null
          scope?: string
          source?: string
          source_version?: string
          status?: string
          title_el?: string
          title_en?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Update: {
          based_on?: string | null
          bundle_key?: string
          created_at?: string
          created_by?: string | null
          departments?: Json
          elements?: Json
          hidden?: boolean
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string | null
          published_at?: string | null
          published_by?: string | null
          retired_at?: string | null
          retired_by?: string | null
          scope?: string
          source?: string
          source_version?: string
          status?: string
          title_el?: string
          title_en?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "prevention_bundle_templates_based_on_fkey"
            columns: ["based_on"]
            isOneToOne: false
            referencedRelation: "prevention_bundle_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prevention_bundle_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          contact_email: string | null
          created_at: string
          demo_entitlement_id: string | null
          full_name: string | null
          id: string
          is_demo: boolean
          is_platform_owner: boolean
          job_title: string | null
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          demo_entitlement_id?: string | null
          full_name?: string | null
          id: string
          is_demo?: boolean
          is_platform_owner?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          demo_entitlement_id?: string | null
          full_name?: string | null
          id?: string
          is_demo?: boolean
          is_platform_owner?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_demo_entitlement_fk"
            columns: ["demo_entitlement_id"]
            isOneToOne: false
            referencedRelation: "platform_demo_entitlements"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audits: {
        Row: {
          audit_type: string
          code: string
          completed_date: string | null
          correction_opened_at: string | null
          correction_opened_by: string | null
          correction_reason: string | null
          created_at: string
          department_id: string | null
          history: Json
          id: string
          lead_auditor_id: string | null
          lead_auditor_label: string | null
          lifecycle_status: string
          organization_id: string
          owner_label: string | null
          owner_labels: string[]
          planned_date: string | null
          scope: string | null
          status: string
          title: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          audit_type: string
          code: string
          completed_date?: string | null
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          history?: Json
          id?: string
          lead_auditor_id?: string | null
          lead_auditor_label?: string | null
          lifecycle_status?: string
          organization_id: string
          owner_label?: string | null
          owner_labels?: string[]
          planned_date?: string | null
          scope?: string | null
          status?: string
          title: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          audit_type?: string
          code?: string
          completed_date?: string | null
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          history?: Json
          id?: string
          lead_auditor_id?: string | null
          lead_auditor_label?: string | null
          lifecycle_status?: string
          organization_id?: string
          owner_label?: string | null
          owner_labels?: string[]
          planned_date?: string | null
          scope?: string | null
          status?: string
          title?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_audits_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_capa_actions: {
        Row: {
          action_type: string
          code: string
          correction_opened_at: string | null
          correction_opened_by: string | null
          correction_reason: string | null
          created_at: string
          department_id: string | null
          description: string | null
          due_date: string | null
          effectiveness_due: string | null
          effectiveness_status: string | null
          history: Json
          id: string
          lifecycle_status: string
          organization_id: string
          owner_id: string | null
          owner_label: string | null
          owner_labels: string[]
          priority: string
          root_cause_analysis: Json | null
          source_id: string | null
          source_type: string
          status: string
          sub_actions: Json
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          action_type: string
          code: string
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          effectiveness_due?: string | null
          effectiveness_status?: string | null
          history?: Json
          id?: string
          lifecycle_status?: string
          organization_id: string
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          priority?: string
          root_cause_analysis?: Json | null
          source_id?: string | null
          source_type: string
          status?: string
          sub_actions?: Json
          title: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          action_type?: string
          code?: string
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          effectiveness_due?: string | null
          effectiveness_status?: string | null
          history?: Json
          id?: string
          lifecycle_status?: string
          organization_id?: string
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          priority?: string
          root_cause_analysis?: Json | null
          source_id?: string | null
          source_type?: string
          status?: string
          sub_actions?: Json
          title?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_capa_actions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_capa_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_findings: {
        Row: {
          code: string
          correction_opened_at: string | null
          correction_opened_by: string | null
          correction_reason: string | null
          created_at: string
          department_id: string | null
          description: string | null
          history: Json
          id: string
          identified_at: string
          lifecycle_status: string
          organization_id: string
          owner_id: string | null
          owner_label: string | null
          owner_labels: string[]
          severity: string
          source_id: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          code: string
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          history?: Json
          id?: string
          identified_at?: string
          lifecycle_status?: string
          organization_id: string
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          severity: string
          source_id?: string | null
          source_type: string
          status?: string
          title: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          code?: string
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          history?: Json
          id?: string
          identified_at?: string
          lifecycle_status?: string
          organization_id?: string
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          severity?: string
          source_id?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_findings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_findings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_incidents: {
        Row: {
          category: string
          code: string
          contributing_factors: string | null
          correction_opened_at: string | null
          correction_opened_by: string | null
          correction_reason: string | null
          created_at: string
          department_id: string | null
          description: string | null
          event_time: string | null
          harm_occurred: boolean
          history: Json
          id: string
          immediate_actions: string | null
          impact: string
          incident_class: string
          lifecycle_status: string
          linked_patient_id: string | null
          linked_surveillance_id: string | null
          occurred_at: string
          organization_id: string
          owner_id: string | null
          owner_label: string | null
          owner_labels: string[]
          reached_patient: boolean
          reported_by: string | null
          reported_by_label: string | null
          root_cause: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          category?: string
          code: string
          contributing_factors?: string | null
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          event_time?: string | null
          harm_occurred?: boolean
          history?: Json
          id?: string
          immediate_actions?: string | null
          impact?: string
          incident_class?: string
          lifecycle_status?: string
          linked_patient_id?: string | null
          linked_surveillance_id?: string | null
          occurred_at: string
          organization_id: string
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          reached_patient?: boolean
          reported_by?: string | null
          reported_by_label?: string | null
          root_cause?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          category?: string
          code?: string
          contributing_factors?: string | null
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          event_time?: string | null
          harm_occurred?: boolean
          history?: Json
          id?: string
          immediate_actions?: string | null
          impact?: string
          incident_class?: string
          lifecycle_status?: string
          linked_patient_id?: string | null
          linked_surveillance_id?: string | null
          occurred_at?: string
          organization_id?: string
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          reached_patient?: boolean
          reported_by?: string | null
          reported_by_label?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_incidents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_record_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          relationship: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          relationship: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          relationship?: string
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_record_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_risk_assessments: {
        Row: {
          approved_by_label: string | null
          approved_on: string | null
          assessed_on: string
          assessor_label: string | null
          code: string
          created_at: string
          created_by: string | null
          form_code: string | null
          history: Json
          id: string
          next_review_on: string | null
          organization_id: string
          period_kind: string
          period_label: string
          scope_note: string | null
          source_assessment_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_by_label?: string | null
          approved_on?: string | null
          assessed_on: string
          assessor_label?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          form_code?: string | null
          history?: Json
          id?: string
          next_review_on?: string | null
          organization_id: string
          period_kind?: string
          period_label: string
          scope_note?: string | null
          source_assessment_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_by_label?: string | null
          approved_on?: string | null
          assessed_on?: string
          assessor_label?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          form_code?: string | null
          history?: Json
          id?: string
          next_review_on?: string | null
          organization_id?: string
          period_kind?: string
          period_label?: string
          scope_note?: string | null
          source_assessment_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_risk_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_risk_assessments_source_assessment_id_fkey"
            columns: ["source_assessment_id"]
            isOneToOne: false
            referencedRelation: "quality_risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_risk_opportunities: {
        Row: {
          action_plan: string | null
          activity: string
          assessment_id: string
          created_at: string
          effectiveness: string | null
          effectiveness_status: string | null
          id: string
          opportunity: string | null
          organization_id: string
          owner_label: string | null
          position: number
          rating: string | null
          timeframe: string | null
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          activity: string
          assessment_id: string
          created_at?: string
          effectiveness?: string | null
          effectiveness_status?: string | null
          id?: string
          opportunity?: string | null
          organization_id: string
          owner_label?: string | null
          position?: number
          rating?: string | null
          timeframe?: string | null
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          activity?: string
          assessment_id?: string
          created_at?: string
          effectiveness?: string | null
          effectiveness_status?: string | null
          id?: string
          opportunity?: string | null
          organization_id?: string
          owner_label?: string | null
          position?: number
          rating?: string | null
          timeframe?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_risk_opportunities_assessment_id_organization_id_fkey"
            columns: ["assessment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_risk_assessments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_risk_templates: {
        Row: {
          code: string
          created_at: string
          id: string
          payload: Json
          source_file: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          payload: Json
          source_file?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          payload?: Json
          source_file?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      quality_risks: {
        Row: {
          additional_measures: string | null
          assessment_id: string
          consequence_rationale: string | null
          created_at: string
          due_date: string | null
          existing_controls: string | null
          hazard: string
          id: string
          indicator: string | null
          indicator_keys: string[]
          inherent_c: number | null
          inherent_l: number | null
          inherent_score: number | null
          jci_chapter: string | null
          jci_reference: string | null
          lineage_key: string
          notes: string | null
          organization_id: string
          owner_label: string | null
          position: number
          prioritized: boolean
          process: string | null
          residual_c: number | null
          residual_l: number | null
          residual_score: number | null
          review_frequency: string | null
          scope: string | null
          section: string
          target_c: number | null
          target_l: number | null
          target_score: number | null
          updated_at: string
        }
        Insert: {
          additional_measures?: string | null
          assessment_id: string
          consequence_rationale?: string | null
          created_at?: string
          due_date?: string | null
          existing_controls?: string | null
          hazard: string
          id?: string
          indicator?: string | null
          indicator_keys?: string[]
          inherent_c?: number | null
          inherent_l?: number | null
          inherent_score?: number | null
          jci_chapter?: string | null
          jci_reference?: string | null
          lineage_key: string
          notes?: string | null
          organization_id: string
          owner_label?: string | null
          position?: number
          prioritized?: boolean
          process?: string | null
          residual_c?: number | null
          residual_l?: number | null
          residual_score?: number | null
          review_frequency?: string | null
          scope?: string | null
          section?: string
          target_c?: number | null
          target_l?: number | null
          target_score?: number | null
          updated_at?: string
        }
        Update: {
          additional_measures?: string | null
          assessment_id?: string
          consequence_rationale?: string | null
          created_at?: string
          due_date?: string | null
          existing_controls?: string | null
          hazard?: string
          id?: string
          indicator?: string | null
          indicator_keys?: string[]
          inherent_c?: number | null
          inherent_l?: number | null
          inherent_score?: number | null
          jci_chapter?: string | null
          jci_reference?: string | null
          lineage_key?: string
          notes?: string | null
          organization_id?: string
          owner_label?: string | null
          position?: number
          prioritized?: boolean
          process?: string | null
          residual_c?: number | null
          residual_l?: number | null
          residual_score?: number | null
          review_frequency?: string | null
          scope?: string | null
          section?: string
          target_c?: number | null
          target_l?: number | null
          target_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_risks_assessment_id_organization_id_fkey"
            columns: ["assessment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_risk_assessments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      recycle_bin: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          deleted_by_name: string | null
          detail: string | null
          expires_at: string
          id: string
          kind: string
          label: string
          module: string
          organization_id: string
          payload: Json
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_name?: string | null
          detail?: string | null
          expires_at?: string
          id?: string
          kind: string
          label: string
          module: string
          organization_id: string
          payload: Json
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_name?: string | null
          detail?: string | null
          expires_at?: string
          id?: string
          kind?: string
          label?: string
          module?: string
          organization_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recycle_bin_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_capabilities: {
        Row: {
          allowed: boolean
          capability_key: string
          created_at: string
          role_key: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          allowed?: boolean
          capability_key: string
          created_at?: string
          role_key: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          allowed?: boolean
          capability_key?: string
          created_at?: string
          role_key?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_capabilities_capability_key_fkey"
            columns: ["capability_key"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_capabilities_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          is_active: boolean
          is_system: boolean
          key: Database["public"]["Enums"]["app_role"]
          label_el: string
          label_en: string
          landing_path: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          is_system?: boolean
          key: Database["public"]["Enums"]["app_role"]
          label_el: string
          label_en: string
          landing_path?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          is_system?: boolean
          key?: Database["public"]["Enums"]["app_role"]
          label_el?: string
          label_en?: string
          landing_path?: string
        }
        Relationships: []
      }
      surveillance_cases: {
        Row: {
          admission_id: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          organization_id: string
          patient_id: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          started_at: string
          status: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          admission_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          organization_id: string
          patient_id: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          admission_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_cases_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "patient_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_cases_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_cases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      surveillance_devices: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          device_type: string
          id: string
          indication: string | null
          inserted_at: string | null
          organization_id: string
          patient_id: string
          removed_at: string | null
          review_due_at: string | null
          site: string | null
          status: string
          surveillance_case_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          device_type: string
          id?: string
          indication?: string | null
          inserted_at?: string | null
          organization_id: string
          patient_id: string
          removed_at?: string | null
          review_due_at?: string | null
          site?: string | null
          status?: string
          surveillance_case_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          device_type?: string
          id?: string
          indication?: string | null
          inserted_at?: string | null
          organization_id?: string
          patient_id?: string
          removed_at?: string | null
          review_due_at?: string | null
          site?: string | null
          status?: string
          surveillance_case_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_devices_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_devices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_devices_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      surveillance_events: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          event_status: string
          event_type: string
          id: string
          occurred_at: string | null
          organization_id: string
          payload: Json
          surveillance_case_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          event_status?: string
          event_type: string
          id?: string
          occurred_at?: string | null
          organization_id: string
          payload?: Json
          surveillance_case_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          event_status?: string
          event_type?: string
          id?: string
          occurred_at?: string | null
          organization_id?: string
          payload?: Json
          surveillance_case_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_events_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      surveillance_outcomes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          occurred_at: string
          organization_id: string
          outcome: string
          patient_id: string
          surveillance_case_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          occurred_at: string
          organization_id: string
          outcome: string
          patient_id: string
          surveillance_case_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          outcome?: string
          patient_id?: string
          surveillance_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_outcomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_outcomes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_outcomes_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: true
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      surveillance_reassessments: {
        Row: {
          clinical_status: string
          created_at: string
          created_by: string
          id: string
          isolation_decision: string | null
          next_review_due_at: string | null
          notes: string | null
          organization_id: string
          patient_id: string
          reassessed_at: string
          surveillance_case_id: string
          therapy_decision: string | null
        }
        Insert: {
          clinical_status: string
          created_at?: string
          created_by: string
          id?: string
          isolation_decision?: string | null
          next_review_due_at?: string | null
          notes?: string | null
          organization_id: string
          patient_id: string
          reassessed_at?: string
          surveillance_case_id: string
          therapy_decision?: string | null
        }
        Update: {
          clinical_status?: string
          created_at?: string
          created_by?: string
          id?: string
          isolation_decision?: string | null
          next_review_due_at?: string | null
          notes?: string | null
          organization_id?: string
          patient_id?: string
          reassessed_at?: string
          surveillance_case_id?: string
          therapy_decision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_reassessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_reassessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_reassessments_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      system_audit_log: {
        Row: {
          actor_role: Database["public"]["Enums"]["app_role"] | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: number
          metadata: Json
          organization_id: string | null
        }
        Insert: {
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: never
          metadata?: Json
          organization_id?: string | null
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: never
          metadata?: Json
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          employee_user_id: string | null
          id: string
          organization_id: string
          payload: Json
          record_key: string
          record_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_user_id?: string | null
          id?: string
          organization_id: string
          payload?: Json
          record_key: string
          record_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_user_id?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          record_key?: string
          record_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_records_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_screen_guides: {
        Row: {
          dismissed: boolean
          guide_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          dismissed?: boolean
          guide_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          dismissed?: boolean
          guide_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waste_measurements: {
        Row: {
          collection_company: string | null
          containers: number | null
          created_at: string
          created_by: string | null
          department_id: string | null
          document_number: string | null
          id: string
          notes: string | null
          organization_id: string
          patient_days: number | null
          patient_days_source: string | null
          period_end: string
          period_start: string
          record_date: string
          responsible_name: string | null
          status: string
          updated_at: string
          updated_by: string | null
          waste_type_id: string | null
          weight_kg: number
        }
        Insert: {
          collection_company?: string | null
          containers?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          document_number?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          patient_days?: number | null
          patient_days_source?: string | null
          period_end: string
          period_start: string
          record_date: string
          responsible_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          waste_type_id?: string | null
          weight_kg: number
        }
        Update: {
          collection_company?: string | null
          containers?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          document_number?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          patient_days?: number | null
          patient_days_source?: string | null
          period_end?: string
          period_start?: string
          record_date?: string
          responsible_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          waste_type_id?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "waste_measurements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_measurements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_measurements_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "master_library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      who_ddd_reference: {
        Row: {
          antibiotic_code: string
          created_at: string
          created_by: string | null
          ddd_grams: number
          id: string
          notes: string | null
          organization_id: string | null
          route: string | null
          source_authority: string
          source_version: string | null
          updated_at: string
        }
        Insert: {
          antibiotic_code: string
          created_at?: string
          created_by?: string | null
          ddd_grams: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          route?: string | null
          source_authority?: string
          source_version?: string | null
          updated_at?: string
        }
        Update: {
          antibiotic_code?: string
          created_at?: string
          created_by?: string | null
          ddd_grams?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          route?: string | null
          source_authority?: string
          source_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "who_ddd_reference_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_assignments: {
        Row: {
          assigned_by: string | null
          assignment_type: string
          completed_at: string | null
          created_at: string
          department_id: string | null
          due_at: string | null
          id: string
          membership_id: string
          organization_id: string
          source_id: string | null
          source_type: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_type: string
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          due_at?: string | null
          id?: string
          membership_id: string
          organization_id: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_by?: string | null
          assignment_type?: string
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          due_at?: string | null
          id?: string
          membership_id?: string
          organization_id?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analysis_amr_susceptibility: {
        Args: {
          p_department_id?: string
          p_from?: string
          p_organization_id: string
          p_to?: string
        }
        Returns: {
          organism_group: string
          resistant: number
          tested: number
        }[]
      }
      analysis_crosstab_metrics: {
        Args: {
          p_department_id?: string
          p_from?: string
          p_organization_id?: string
          p_to?: string
        }
        Returns: Json
      }
      analysis_domain_metrics: {
        Args: {
          p_department_id?: string
          p_from?: string
          p_organization_id?: string
          p_to?: string
        }
        Returns: Json
      }
      analysis_microbiology_findings: {
        Args: {
          p_department_id?: string
          p_from?: string
          p_organization_id: string
          p_to?: string
        }
        Returns: {
          department_id: string
          department_name: string
          event_date: string
          is_critical: boolean
          microbiology_result_id: string
          organism: string
          organization_id: string
          resistance_class: string
          sample_type: string
          source: string
        }[]
      }
      analysis_people_metrics: {
        Args: {
          p_department_id?: string
          p_from?: string
          p_organization_id?: string
          p_to?: string
        }
        Returns: Json
      }
      answer_committee_membership: {
        Args: { p_member_id: string; p_status: string }
        Returns: {
          approval_status: string
          client_key: string | null
          committee_id: string
          created_at: string
          employee_id: string | null
          ended_at: string | null
          has_vote: boolean
          id: string
          member_name: string
          member_type: string
          organization_id: string
          responsibilities: string | null
          started_at: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "committee_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_lira_knowledge_source: {
        Args: { p_review_notes?: string; p_source_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          authority: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          ingestion_status: string
          language: string
          metadata: Json
          organization_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: string
          source_url: string | null
          source_version: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lira_knowledge_sources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_patient: {
        Args: {
          p_organization_id: string
          p_patient_id: string
          p_reason: string
        }
        Returns: {
          admission_date: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          birth_weight_grams: number | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          department_id: string | null
          discharge_date: string | null
          father_name: string | null
          first_name: string | null
          gestational_age_weeks: number | null
          hospital_record_number: string | null
          id: string
          last_name: string | null
          notes: string | null
          organization_id: string
          patient_code: string
          sex: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_view_surveillance_record: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      cancel_committee_meeting: {
        Args: { p_meeting_id: string; p_reason: string }
        Returns: {
          agenda: Json
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_key: string | null
          committee_id: string
          created_at: string
          created_by: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          location: string | null
          meeting_type: string
          minutes: string | null
          minutes_number: string | null
          organization_id: string
          quorum_met: boolean | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "committee_meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_patient_admission: {
        Args: {
          p_admission_id: string
          p_discharge_date: string
          p_organization_id: string
          p_patient_id: string
          p_reason?: string
        }
        Returns: {
          admission_date: string
          created_at: string
          created_by: string | null
          department_id: string | null
          discharge_date: string | null
          id: string
          notes: string | null
          organization_id: string
          patient_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patient_admissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      committee_minutes_external_access: {
        Args: { p_token: string }
        Returns: Json
      }
      committee_minutes_external_action: {
        Args: { p_action: string; p_id: string }
        Returns: Json
      }
      committee_minutes_external_decide: {
        Args: { p_comment?: string; p_decision: string; p_token: string }
        Returns: Json
      }
      create_lira_knowledge_source_version: {
        Args: {
          p_review_notes?: string
          p_source_id: string
          p_source_version: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          authority: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          ingestion_status: string
          language: string
          metadata: Json
          organization_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: string
          source_url: string | null
          source_version: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lira_knowledge_sources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_patient_admission: {
        Args: {
          p_admission_date: string
          p_department_id: string
          p_discharge_date?: string
          p_notes?: string
          p_organization_id: string
          p_patient_id: string
          p_status?: string
        }
        Returns: {
          admission_date: string
          created_at: string
          created_by: string | null
          department_id: string | null
          discharge_date: string | null
          id: string
          notes: string | null
          organization_id: string
          patient_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patient_admissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_demo_access: { Args: never; Returns: Json }
      current_membership_ids: { Args: never; Returns: string[] }
      current_user_can_access_control_department: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_manage_committee: {
        Args: {
          requested_capability: string
          target_committee: string
          target_org: string
        }
        Returns: boolean
      }
      current_user_can_patient_capability: {
        Args: {
          target_capability: string
          target_department: string
          target_org: string
        }
        Returns: boolean
      }
      current_user_can_read_antiseptic: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_read_hand_hygiene: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_read_pharmacy_consumption: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_read_prevalence_survey: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_read_prevention_bundle: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_read_waste: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_use_recycle_bin: {
        Args: { p_module: string; p_organization_id: string }
        Returns: boolean
      }
      current_user_can_view_committee: {
        Args: { target_committee: string; target_org: string }
        Returns: boolean
      }
      current_user_can_write_antiseptic: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_write_hand_hygiene: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_write_pharmacy_consumption: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_write_prevalence_survey: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_write_prevention_bundle: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_can_write_waste: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_has_capability: {
        Args: { capability_key: string; target_org: string }
        Returns: boolean
      }
      current_user_has_department_scope: {
        Args: { target_department: string; target_org: string }
        Returns: boolean
      }
      current_user_has_governance_capability: {
        Args: { requested_capability: string; target_org: string }
        Returns: boolean
      }
      current_user_has_org_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          target_org: string
        }
        Returns: boolean
      }
      current_user_is_demo_admin: {
        Args: { target_org: string }
        Returns: boolean
      }
      current_user_is_platform_owner: { Args: never; Returns: boolean }
      current_user_manages_department_control: {
        Args: { target_control: string; target_org: string }
        Returns: boolean
      }
      delete_lira_provider_secret: {
        Args: { p_secret_id: string }
        Returns: undefined
      }
      demo_rate_evaluation_step: {
        Args: {
          p_comment?: string
          p_organization_id: string
          p_rating: number
          p_step: string
        }
        Returns: Json
      }
      demo_request_application: {
        Args: {
          p_contact_name: string
          p_contact_phone?: string
          p_message?: string
          p_organization_id: string
        }
        Returns: Json
      }
      demo_set_evaluation_step: {
        Args: { p_done?: boolean; p_organization_id: string; p_step: string }
        Returns: Json
      }
      demo_submit_scenario_feedback: {
        Args: {
          p_clarity?: number
          p_comment?: string
          p_duration_seconds?: number
          p_ease?: number
          p_organization_id: string
          p_rating: number
          p_step: string
        }
        Returns: Json
      }
      demo_switch_my_role: {
        Args: {
          p_department_id?: string
          p_organization_id: string
          p_role: string
        }
        Returns: Json
      }
      document_acknowledgement_members: {
        Args: { p_organization_id: string }
        Returns: {
          department_ids: string[]
          employee_department: string
          employee_department_en: string
          full_name: string
          member_role: string
          profession: string
          profession_en: string
          user_id: string
        }[]
      }
      employee_admin_history: {
        Args: { p_employee_id: string }
        Returns: {
          action: string
          actor_name: string
          actor_role: string
          audit_id: number
          changed_fields: Json
          occurred_at: string
        }[]
      }
      generate_username: { Args: { source_name: string }; Returns: string }
      get_indicator_metric_snapshot: {
        Args: {
          p_department_id?: string
          p_from: string
          p_organization_id: string
          p_to: string
        }
        Returns: Json
      }
      get_lira_ai_provider_settings: {
        Args: { p_organization_id: string }
        Returns: {
          allow_aggregate_data: boolean
          allow_patient_level_data: boolean
          configured_at: string
          enabled: boolean
          key_hint: string
          model: string
          provider: string
        }[]
      }
      get_lira_provider_runtime_secret: {
        Args: { p_organization_id: string }
        Returns: {
          allow_aggregate_data: boolean
          allow_patient_level_data: boolean
          api_key: string
          model: string
          provider: string
        }[]
      }
      get_organism_clusters: {
        Args: {
          p_organization_id: string
          p_threshold?: number
          p_window_days?: number
        }
        Returns: {
          case_count: number
          department_id: string
          department_name: string
          first_event: string
          last_event: string
          organism: string
          resistance_class: string
        }[]
      }
      get_platform_maintenance_notice: { Args: never; Returns: Json }
      greek_to_latin: { Args: { input: string }; Returns: string }
      has_org_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          target_org: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { target_org: string }; Returns: boolean }
      is_org_member: { Args: { target_org: string }; Returns: boolean }
      lira_fold: { Args: { p_text: string }; Returns: string }
      platform_cancel_organization_deletion: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      platform_convert_demo_tx: {
        Args: {
          p_code: string
          p_details?: Json
          p_name: string
          p_organization_id: string
        }
        Returns: Json
      }
      platform_demo_purge_candidates: {
        Args: never
        Returns: {
          code: string
          name: string
          organization_id: string
          valid_until: string
        }[]
      }
      platform_demo_seed_member: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      platform_extend_demo: {
        Args: { p_entitlement_id: string; p_valid_until: string }
        Returns: Json
      }
      platform_open_owner_demo: { Args: never; Returns: string }
      platform_organization_deletion_impact: {
        Args: { p_organization_ids: string[] }
        Returns: Json
      }
      platform_organization_export_manifest: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      platform_purge_organization_tx: {
        Args: {
          p_confirmation: string
          p_organization_id: string
          p_ticket: string
        }
        Returns: Json
      }
      platform_report_summary: {
        Args: {
          p_department_id?: string
          p_from?: string
          p_organization_id?: string
          p_to?: string
        }
        Returns: Json
      }
      platform_reset_demo_organization: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      platform_schedule_organization_deletion: {
        Args: {
          p_export_waived_reason?: string
          p_organization_id: string
          p_reason: string
        }
        Returns: Json
      }
      platform_scheduler_secret_valid: {
        Args: { p_secret: string }
        Returns: boolean
      }
      public_login_notice: { Args: never; Returns: Json }
      purge_recycle_bin: { Args: never; Returns: number }
      queue_training_invitation: {
        Args: { p_assignment_key: string; p_language?: string }
        Returns: Json
      }
      record_runtime_event: {
        Args: {
          event_app_version?: string
          event_diagnostic_code?: string
          event_module?: string
          event_operation?: string
          event_route?: string
          event_severity: string
          event_type?: string
          event_user_message?: string
          target_organization_id: string
        }
        Returns: string
      }
      resolve_committee_member_user_id: {
        Args: { p_employee_id: string; p_organization_id: string }
        Returns: string
      }
      retire_lira_knowledge_source: {
        Args: { p_review_notes?: string; p_source_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          authority: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          ingestion_status: string
          language: string
          metadata: Json
          organization_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: string
          source_url: string | null
          source_version: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lira_knowledge_sources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revise_lira_knowledge_source: {
        Args: {
          p_review_notes?: string
          p_source_id: string
          p_source_url: string
          p_source_version: string
          p_title: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          authority: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          ingestion_status: string
          language: string
          metadata: Json
          organization_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: string
          source_url: string | null
          source_version: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lira_knowledge_sources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_custom_role: {
        Args: {
          p_capabilities?: string[]
          p_description?: string
          p_name: string
          p_organization_id: string
          p_role_id: string
        }
        Returns: Json
      }
      search_lira_knowledge_hybrid: {
        Args: {
          p_limit?: number
          p_min_similarity?: number
          p_organization_id: string
          p_query: string
          p_query_embedding?: string
        }
        Returns: {
          authority: string
          chunk_id: string
          citation_label: string
          content: string
          heading: string
          keyword_rank: number
          match_score: number
          page_end: number
          page_start: number
          semantic_similarity: number
          source_id: string
          source_url: string
          source_version: string
          title: string
        }[]
      }
      search_lira_knowledge_text: {
        Args: { p_limit?: number; p_organization_id: string; p_query: string }
        Returns: {
          authority: string
          chunk_id: string
          citation_label: string
          content: string
          heading: string
          match_score: number
          page_end: number
          page_start: number
          source_id: string
          source_url: string
          source_version: string
          title: string
        }[]
      }
      set_member_screen_guides: {
        Args: {
          p_enabled: boolean
          p_organization_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      set_organization_branding: {
        Args: { p_branding: Json; p_organization_id: string }
        Returns: Json
      }
      set_organization_idle_lock: {
        Args: { p_minutes: number; p_organization_id: string }
        Returns: number
      }
      set_organization_screen_guides: {
        Args: { p_enabled: boolean; p_organization_id: string }
        Returns: boolean
      }
      store_lira_provider_secret: {
        Args: {
          p_existing_secret_id?: string
          p_organization_id: string
          p_secret: string
        }
        Returns: string
      }
      submit_committee_minutes: {
        Args: { p_external?: Json; p_meeting_id: string }
        Returns: Json
      }
      sync_committee_member_addon: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      training_email_access: { Args: { p_token: string }; Returns: Json }
      training_submit_evaluation: {
        Args: {
          p_answers?: Json
          p_attendance_attested?: boolean
          p_feedback_comment?: string
          p_feedback_scores?: Json
          p_token: string
        }
        Returns: Json
      }
      transfer_patient_admission: {
        Args: {
          p_admission_id: string
          p_organization_id: string
          p_patient_id: string
          p_reason?: string
          p_to_department_id: string
          p_transfer_date: string
        }
        Returns: {
          admission_date: string
          created_at: string
          created_by: string | null
          department_id: string | null
          discharge_date: string | null
          id: string
          notes: string | null
          organization_id: string
          patient_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "patient_admissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_organization_profile: {
        Args: {
          p_bed_capacity?: number
          p_city?: string
          p_contact_email?: string
          p_contact_phone?: string
          p_country?: string
          p_health_region?: string
          p_name: string
          p_organization_id: string
          p_region?: string
        }
        Returns: {
          bed_capacity: number | null
          branding: Json
          city: string | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string
          deletion_export_waived_reason: string | null
          deletion_reason: string | null
          deletion_requested_at: string | null
          deletion_requested_by: string | null
          deletion_scheduled_at: string | null
          enabled_addons: string[]
          enabled_modules: string[] | null
          health_region: string | null
          id: string
          idle_lock_minutes: number
          is_demo: boolean
          name: string
          operating_profile: string
          parent_id: string | null
          paused_at: string | null
          region: string | null
          screen_guides_enabled: boolean | null
          status: Database["public"]["Enums"]["organization_status"]
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "platform_owner"
        | "hospital_admin"
        | "infection_control_lead"
        | "link_nurse"
        | "doctor_reviewer"
        | "department_user"
        | "laboratory"
        | "staff_user"
        | "infection_control_member"
        | "department_manager"
        | "committee_secretariat"
        | "hr_office"
        | "pharmacy"
        | "occupational_physician"
        | "quality_manager"
        | "demo"
      member_status: "invited" | "active" | "disabled"
      organization_status: "active" | "suspended" | "archived"
      organization_type: "group" | "hospital" | "clinic" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "platform_owner",
        "hospital_admin",
        "infection_control_lead",
        "link_nurse",
        "doctor_reviewer",
        "department_user",
        "laboratory",
        "staff_user",
        "infection_control_member",
        "department_manager",
        "committee_secretariat",
        "hr_office",
        "pharmacy",
        "occupational_physician",
        "quality_manager",
        "demo",
      ],
      member_status: ["invited", "active", "disabled"],
      organization_status: ["active", "suspended", "archived"],
      organization_type: ["group", "hospital", "clinic", "other"],
    },
  },
} as const
