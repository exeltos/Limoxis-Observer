// Τύποι της βάσης (Supabase, σχήμα public), από το generate_typescript_types.
// Δεν γράφεται με το χέρι: ξαναπαράγεται μετά από αλλαγές στο σχήμα.
// Λείπουν σκόπιμα οι πίνακες που φτιάχνει δυναμικά κάθε μητρώο τμήματος
// (register_<πρότυπο>_<8 χαρακτήρες>), τα αντίγραφα ασφαλείας (bk_*) και οι
// προσωρινοί πίνακες εισαγωγής (fm_stage_*, rebuild_*).
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
      access_token_attempts: {
        Row: {
          action: string
          created_at: string
          id: number
          invitation_id: string | null
          ip_hash: string
          success: boolean
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          invitation_id?: string | null
          ip_hash: string
          success?: boolean
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          invitation_id?: string | null
          ip_hash?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "access_token_attempts_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "account_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_creation_batches: {
        Row: {
          batch_key: string
          created_at: string
          created_by: string | null
          created_count: number
          failed_count: number
          finished_at: string | null
          id: string
          linked_count: number
          organization_id: string
          status: string
          summary_sent_at: string | null
          total: number
        }
        Insert: {
          batch_key: string
          created_at?: string
          created_by?: string | null
          created_count?: number
          failed_count?: number
          finished_at?: string | null
          id?: string
          linked_count?: number
          organization_id: string
          status?: string
          summary_sent_at?: string | null
          total?: number
        }
        Update: {
          batch_key?: string
          created_at?: string
          created_by?: string | null
          created_count?: number
          failed_count?: number
          finished_at?: string | null
          id?: string
          linked_count?: number
          organization_id?: string
          status?: string
          summary_sent_at?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_creation_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_creation_items: {
        Row: {
          batch_id: string
          created_at: string
          department_id: string | null
          employee_id: string
          error_code: string | null
          id: string
          invitation_id: string | null
          last_sent_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          send_count: number
          status: string
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          department_id?: string | null
          employee_id: string
          error_code?: string | null
          id?: string
          invitation_id?: string | null
          last_sent_at?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          send_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          department_id?: string | null
          employee_id?: string
          error_code?: string | null
          id?: string
          invitation_id?: string | null
          last_sent_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          send_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_creation_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "account_creation_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_creation_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_creation_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_creation_items_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "account_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_creation_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      amr_classification_categories: {
        Row: {
          amr_classification_id: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          position: number
          susceptible: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amr_classification_id: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          position: number
          susceptible: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amr_classification_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          position?: number
          susceptible?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amr_classification_categories_amr_classification_id_organi_fkey"
            columns: ["amr_classification_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "amr_classifications"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "amr_classification_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      amr_classifications: {
        Row: {
          categories_tested: number | null
          classification: string | null
          classified_at: string | null
          classified_by: string | null
          created_at: string
          definition_source: string
          definition_version: string
          id: string
          mechanism: string | null
          microbiology_result_id: string
          organism: string | null
          organization_id: string
          rationale: string | null
          status: string
        }
        Insert: {
          categories_tested?: number | null
          classification?: string | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string
          definition_source: string
          definition_version: string
          id?: string
          mechanism?: string | null
          microbiology_result_id: string
          organism?: string | null
          organization_id: string
          rationale?: string | null
          status?: string
        }
        Update: {
          categories_tested?: number | null
          classification?: string | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string
          definition_source?: string
          definition_version?: string
          id?: string
          mechanism?: string | null
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
      antimicrobial_therapy_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          new_regimen: string | null
          note: string | null
          organization_id: string
          reasons: string[]
          reviewed_at: string
          reviewed_by: string
          reviewer_job_title: string | null
          reviewer_name: string | null
          surveillance_case_id: string | null
          therapy_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          new_regimen?: string | null
          note?: string | null
          organization_id: string
          reasons?: string[]
          reviewed_at?: string
          reviewed_by?: string
          reviewer_job_title?: string | null
          reviewer_name?: string | null
          surveillance_case_id?: string | null
          therapy_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          new_regimen?: string | null
          note?: string | null
          organization_id?: string
          reasons?: string[]
          reviewed_at?: string
          reviewed_by?: string
          reviewer_job_title?: string | null
          reviewer_name?: string | null
          surveillance_case_id?: string | null
          therapy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "antimicrobial_therapy_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antimicrobial_therapy_reviews_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antimicrobial_therapy_reviews_therapy_id_fkey"
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
      clinical_assessment_findings: {
        Row: {
          assessment_id: string
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string
          notes: string | null
          observed_at: string | null
          organization_id: string
          position: number
          updated_at: string
          updated_by: string | null
          value_boolean: boolean | null
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          assessment_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          label: string
          notes?: string | null
          observed_at?: string | null
          organization_id: string
          position: number
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          assessment_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label?: string
          notes?: string | null
          observed_at?: string | null
          organization_id?: string
          position?: number
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_assessment_findings_assessment_id_organization_id_fkey"
            columns: ["assessment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "clinical_assessments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "clinical_assessment_findings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      clinical_protocol_events: {
        Row: {
          actor_id: string
          actor_name: string | null
          detail: Json
          event_type: string
          id: string
          occurred_at: string
          organization_id: string
          reason: string | null
          run_id: string
          step_key: string | null
        }
        Insert: {
          actor_id?: string
          actor_name?: string | null
          detail?: Json
          event_type: string
          id?: string
          occurred_at?: string
          organization_id: string
          reason?: string | null
          run_id: string
          step_key?: string | null
        }
        Update: {
          actor_id?: string
          actor_name?: string | null
          detail?: Json
          event_type?: string
          id?: string
          occurred_at?: string
          organization_id?: string
          reason?: string | null
          run_id?: string
          step_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_protocol_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocol_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "clinical_protocol_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_protocol_runs: {
        Row: {
          admission_id: string | null
          close_reason: string | null
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          department_id: string | null
          id: string
          organization_id: string
          patient_id: string | null
          protocol_key: string
          protocol_version: string
          recognition_source: string | null
          recognized_at: string
          started_at: string
          started_by: string
          started_by_name: string | null
          status: string
          surveillance_case_id: string
          trigger_assessment_id: string | null
          updated_at: string
          updated_by: string | null
          weight_kg: number | null
        }
        Insert: {
          admission_id?: string | null
          close_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          department_id?: string | null
          id?: string
          organization_id: string
          patient_id?: string | null
          protocol_key: string
          protocol_version?: string
          recognition_source?: string | null
          recognized_at: string
          started_at?: string
          started_by?: string
          started_by_name?: string | null
          status?: string
          surveillance_case_id: string
          trigger_assessment_id?: string | null
          updated_at?: string
          updated_by?: string | null
          weight_kg?: number | null
        }
        Update: {
          admission_id?: string | null
          close_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          department_id?: string | null
          id?: string
          organization_id?: string
          patient_id?: string | null
          protocol_key?: string
          protocol_version?: string
          recognition_source?: string | null
          recognized_at?: string
          started_at?: string
          started_by?: string
          started_by_name?: string | null
          status?: string
          surveillance_case_id?: string
          trigger_assessment_id?: string | null
          updated_at?: string
          updated_by?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_protocol_runs_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "patient_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocol_runs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocol_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocol_runs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocol_runs_surveillance_case_id_fkey"
            columns: ["surveillance_case_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocol_runs_trigger_assessment_id_fkey"
            columns: ["trigger_assessment_id"]
            isOneToOne: false
            referencedRelation: "patient_clinical_scale_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_protocol_steps: {
        Row: {
          done_at: string | null
          id: string
          laboratory_sample_id: string | null
          not_indicated_reason: string | null
          organization_id: string
          recorded_at: string
          recorded_by: string
          recorded_by_name: string | null
          run_id: string
          status: string
          step_key: string
          therapy_id: string | null
          updated_at: string
          updated_by: string | null
          value_text: string | null
        }
        Insert: {
          done_at?: string | null
          id?: string
          laboratory_sample_id?: string | null
          not_indicated_reason?: string | null
          organization_id: string
          recorded_at?: string
          recorded_by?: string
          recorded_by_name?: string | null
          run_id: string
          status?: string
          step_key: string
          therapy_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value_text?: string | null
        }
        Update: {
          done_at?: string | null
          id?: string
          laboratory_sample_id?: string | null
          not_indicated_reason?: string | null
          organization_id?: string
          recorded_at?: string
          recorded_by?: string
          recorded_by_name?: string | null
          run_id?: string
          status?: string
          step_key?: string
          therapy_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_protocol_steps_laboratory_sample_id_fkey"
            columns: ["laboratory_sample_id"]
            isOneToOne: false
            referencedRelation: "laboratory_samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocol_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocol_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "clinical_protocol_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocol_steps_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "antimicrobial_therapies"
            referencedColumns: ["id"]
          },
        ]
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
          owner_employee_id: string | null
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
          owner_employee_id?: string | null
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
          owner_employee_id?: string | null
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
            foreignKeyName: "committee_decisions_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
          composition: string
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
          composition?: string
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
          composition?: string
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
          in_control_team: boolean
          is_external: boolean
          member_name: string
          member_roles: string[]
          member_type: string
          organization_id: string
          responsibilities: string | null
          specialty: string | null
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
          in_control_team?: boolean
          is_external?: boolean
          member_name: string
          member_roles?: string[]
          member_type?: string
          organization_id: string
          responsibilities?: string | null
          specialty?: string | null
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
          in_control_team?: boolean
          is_external?: boolean
          member_name?: string
          member_roles?: string[]
          member_type?: string
          organization_id?: string
          responsibilities?: string | null
          specialty?: string | null
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
          owner_employee_id: string | null
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
          owner_employee_id?: string | null
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
          owner_employee_id?: string | null
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
            foreignKeyName: "committee_plan_items_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      content_translations: {
        Row: {
          entity: string
          entity_id: string
          field: string
          id: string
          lang: string
          model: string | null
          organization_id: string
          origin: string
          source_hash: string
          text: string
          translated_at: string
        }
        Insert: {
          entity: string
          entity_id: string
          field: string
          id?: string
          lang?: string
          model?: string | null
          organization_id: string
          origin?: string
          source_hash: string
          text: string
          translated_at?: string
        }
        Update: {
          entity?: string
          entity_id?: string
          field?: string
          id?: string
          lang?: string
          model?: string | null
          organization_id?: string
          origin?: string
          source_hash?: string
          text?: string
          translated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_translations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      control_assignment_stats: {
        Row: {
          assignment_id: string
          department_id: string
          executions: number
          findings: number
          last_performed_at: string | null
          organization_id: string
        }
        Insert: {
          assignment_id: string
          department_id: string
          executions?: number
          findings?: number
          last_performed_at?: string | null
          organization_id: string
        }
        Update: {
          assignment_id?: string
          department_id?: string
          executions?: number
          findings?: number
          last_performed_at?: string | null
          organization_id?: string
        }
        Relationships: []
      }
      control_assignments: {
        Row: {
          assignee_id: string | null
          control_id: string
          department_id: string
          frequency_config: Json | null
          id: string
          last_completed_at: string | null
          next_due_at: string | null
          organization_id: string
          response_override: Json | null
          status: string
        }
        Insert: {
          assignee_id?: string | null
          control_id: string
          department_id: string
          frequency_config?: Json | null
          id?: string
          last_completed_at?: string | null
          next_due_at?: string | null
          organization_id: string
          response_override?: Json | null
          status?: string
        }
        Update: {
          assignee_id?: string | null
          control_id?: string
          department_id?: string
          frequency_config?: Json | null
          id?: string
          last_completed_at?: string | null
          next_due_at?: string | null
          organization_id?: string
          response_override?: Json | null
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
          acceptance_criteria: string | null
          category: string
          code: string
          created_at: string
          created_by: string
          culture_department_id: string | null
          culture_group: string | null
          culture_sample_types: string[] | null
          description: string | null
          frequency_config: Json
          goal: string | null
          guide_notes: string | null
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
          acceptance_criteria?: string | null
          category: string
          code: string
          created_at?: string
          created_by?: string
          culture_department_id?: string | null
          culture_group?: string | null
          culture_sample_types?: string[] | null
          description?: string | null
          frequency_config?: Json
          goal?: string | null
          guide_notes?: string | null
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
          acceptance_criteria?: string | null
          category?: string
          code?: string
          created_at?: string
          created_by?: string
          culture_department_id?: string | null
          culture_group?: string | null
          culture_sample_types?: string[] | null
          description?: string | null
          frequency_config?: Json
          goal?: string | null
          guide_notes?: string | null
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
            foreignKeyName: "control_definitions_culture_department_id_fkey"
            columns: ["culture_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
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
          checked_points: string | null
          control_id: string
          created_at: string
          department_id: string
          edited_at: string | null
          edited_by: string | null
          extra_reason: string | null
          has_finding: boolean
          has_item_list: boolean | null
          id: string
          is_extra: boolean
          notes: string | null
          organization_id: string
          performed_at: string
          performed_by: string
          response_data: Json
          result_text: string | null
          status: string
          value_text: string | null
        }
        Insert: {
          assignment_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_points?: string | null
          control_id: string
          created_at?: string
          department_id: string
          edited_at?: string | null
          edited_by?: string | null
          extra_reason?: string | null
          has_finding?: boolean
          has_item_list?: boolean | null
          id?: string
          is_extra?: boolean
          notes?: string | null
          organization_id: string
          performed_at?: string
          performed_by?: string
          response_data?: Json
          result_text?: string | null
          status?: string
          value_text?: string | null
        }
        Update: {
          assignment_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_points?: string | null
          control_id?: string
          created_at?: string
          department_id?: string
          edited_at?: string | null
          edited_by?: string | null
          extra_reason?: string | null
          has_finding?: boolean
          has_item_list?: boolean | null
          id?: string
          is_extra?: boolean
          notes?: string | null
          organization_id?: string
          performed_at?: string
          performed_by?: string
          response_data?: Json
          result_text?: string | null
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
          clinical_area: string | null
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
          protocol_kind: string | null
          published_at: string | null
          published_by: string | null
          renewal_months: number | null
          required_by: string[] | null
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
          clinical_area?: string | null
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
          protocol_kind?: string | null
          published_at?: string | null
          published_by?: string | null
          renewal_months?: number | null
          required_by?: string[] | null
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
          clinical_area?: string | null
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
          protocol_kind?: string | null
          published_at?: string | null
          published_by?: string | null
          renewal_months?: number | null
          required_by?: string[] | null
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
      demo_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          handled_at: string | null
          handled_by: string | null
          id: string
          language: string
          message: string | null
          organization_name: string
          phone: string | null
          privacy_accepted_at: string
          role_title: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          language?: string
          message?: string | null
          organization_name: string
          phone?: string | null
          privacy_accepted_at: string
          role_title: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          language?: string
          message?: string | null
          organization_name?: string
          phone?: string | null
          privacy_accepted_at?: string
          role_title?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      department_register_fields: {
        Row: {
          aliases: string[]
          archived: boolean
          computed_from: string | null
          computed_kind: string | null
          computed_to: string | null
          field_type: string
          help_el: string | null
          help_en: string | null
          id: string
          in_breakdown: boolean
          in_list: boolean
          key: string
          label_el: string
          label_en: string | null
          max_value: number | null
          min_value: number | null
          not_before_key: string | null
          organization_id: string
          position: number
          provisional: boolean
          register_id: string
          required: boolean
          required_from: string | null
          section_key: string | null
          show_when_key: string | null
          show_when_value: string | null
          unit_el: string | null
          unit_en: string | null
          usual_max: number | null
          usual_min: number | null
        }
        Insert: {
          aliases?: string[]
          archived?: boolean
          computed_from?: string | null
          computed_kind?: string | null
          computed_to?: string | null
          field_type: string
          help_el?: string | null
          help_en?: string | null
          id?: string
          in_breakdown?: boolean
          in_list?: boolean
          key: string
          label_el: string
          label_en?: string | null
          max_value?: number | null
          min_value?: number | null
          not_before_key?: string | null
          organization_id: string
          position?: number
          provisional?: boolean
          register_id: string
          required?: boolean
          required_from?: string | null
          section_key?: string | null
          show_when_key?: string | null
          show_when_value?: string | null
          unit_el?: string | null
          unit_en?: string | null
          usual_max?: number | null
          usual_min?: number | null
        }
        Update: {
          aliases?: string[]
          archived?: boolean
          computed_from?: string | null
          computed_kind?: string | null
          computed_to?: string | null
          field_type?: string
          help_el?: string | null
          help_en?: string | null
          id?: string
          in_breakdown?: boolean
          in_list?: boolean
          key?: string
          label_el?: string
          label_en?: string | null
          max_value?: number | null
          min_value?: number | null
          not_before_key?: string | null
          organization_id?: string
          position?: number
          provisional?: boolean
          register_id?: string
          required?: boolean
          required_from?: string | null
          section_key?: string | null
          show_when_key?: string | null
          show_when_value?: string | null
          unit_el?: string | null
          unit_en?: string | null
          usual_max?: number | null
          usual_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "department_register_fields_register_id_organization_id_fkey"
            columns: ["register_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "department_registers"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      department_register_indicator_filters: {
        Row: {
          field_key: string
          id: string
          indicator_id: string
          op: string
          organization_id: string
          part: string
          position: number
          register_id: string
          value: string | null
        }
        Insert: {
          field_key: string
          id?: string
          indicator_id: string
          op: string
          organization_id: string
          part: string
          position?: number
          register_id: string
          value?: string | null
        }
        Update: {
          field_key?: string
          id?: string
          indicator_id?: string
          op?: string
          organization_id?: string
          part?: string
          position?: number
          register_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_register_indicator__register_id_organization_id_fkey"
            columns: ["register_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "department_registers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "department_register_indicator_fil_indicator_id_register_id_fkey"
            columns: ["indicator_id", "register_id"]
            isOneToOne: false
            referencedRelation: "department_register_indicators"
            referencedColumns: ["id", "register_id"]
          },
        ]
      }
      department_register_indicators: {
        Row: {
          aggregation: string
          archived: boolean
          daily_only: boolean
          date_field_key: string | null
          denominator_field_key: string | null
          denominator_measure: string | null
          denominator_rows: string[]
          direction: string
          field_key: string | null
          id: string
          key: string
          multiplier: number | null
          note_el: string | null
          note_en: string | null
          organization_id: string
          position: number
          register_id: string
          sheet_measure: string | null
          sheet_rows: string[]
          target: number | null
          threshold: number | null
          title_el: string
          title_en: string | null
          unit_el: string | null
          unit_en: string | null
        }
        Insert: {
          aggregation: string
          archived?: boolean
          daily_only?: boolean
          date_field_key?: string | null
          denominator_field_key?: string | null
          denominator_measure?: string | null
          denominator_rows?: string[]
          direction?: string
          field_key?: string | null
          id?: string
          key: string
          multiplier?: number | null
          note_el?: string | null
          note_en?: string | null
          organization_id: string
          position?: number
          register_id: string
          sheet_measure?: string | null
          sheet_rows?: string[]
          target?: number | null
          threshold?: number | null
          title_el: string
          title_en?: string | null
          unit_el?: string | null
          unit_en?: string | null
        }
        Update: {
          aggregation?: string
          archived?: boolean
          daily_only?: boolean
          date_field_key?: string | null
          denominator_field_key?: string | null
          denominator_measure?: string | null
          denominator_rows?: string[]
          direction?: string
          field_key?: string | null
          id?: string
          key?: string
          multiplier?: number | null
          note_el?: string | null
          note_en?: string | null
          organization_id?: string
          position?: number
          register_id?: string
          sheet_measure?: string | null
          sheet_rows?: string[]
          target?: number | null
          threshold?: number | null
          title_el?: string
          title_en?: string | null
          unit_el?: string | null
          unit_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_register_indicators_register_id_organization_id_fkey"
            columns: ["register_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "department_registers"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      department_register_options: {
        Row: {
          archived: boolean
          field_id: string
          id: string
          label_el: string
          label_en: string | null
          match: string[]
          organization_id: string
          position: number
          register_id: string
          value: string
        }
        Insert: {
          archived?: boolean
          field_id: string
          id?: string
          label_el: string
          label_en?: string | null
          match?: string[]
          organization_id: string
          position?: number
          register_id: string
          value: string
        }
        Update: {
          archived?: boolean
          field_id?: string
          id?: string
          label_el?: string
          label_en?: string | null
          match?: string[]
          organization_id?: string
          position?: number
          register_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_register_options_field_id_register_id_fkey"
            columns: ["field_id", "register_id"]
            isOneToOne: false
            referencedRelation: "department_register_fields"
            referencedColumns: ["id", "register_id"]
          },
          {
            foreignKeyName: "department_register_options_register_id_organization_id_fkey"
            columns: ["register_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "department_registers"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      department_register_sections: {
        Row: {
          id: string
          key: string
          label_el: string
          label_en: string | null
          organization_id: string
          position: number
          register_id: string
        }
        Insert: {
          id?: string
          key: string
          label_el: string
          label_en?: string | null
          organization_id: string
          position?: number
          register_id: string
        }
        Update: {
          id?: string
          key?: string
          label_el?: string
          label_en?: string | null
          organization_id?: string
          position?: number
          register_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_register_sections_register_id_organization_id_fkey"
            columns: ["register_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "department_registers"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      department_register_sheet_axes: {
        Row: {
          aliases: string[]
          archived: boolean
          axis: string
          group_key: string | null
          help_el: string | null
          help_en: string | null
          id: string
          key: string
          label_el: string
          label_en: string | null
          organization_id: string
          position: number
          register_id: string
        }
        Insert: {
          aliases?: string[]
          archived?: boolean
          axis: string
          group_key?: string | null
          help_el?: string | null
          help_en?: string | null
          id?: string
          key: string
          label_el: string
          label_en?: string | null
          organization_id: string
          position?: number
          register_id: string
        }
        Update: {
          aliases?: string[]
          archived?: boolean
          axis?: string
          group_key?: string | null
          help_el?: string | null
          help_en?: string | null
          id?: string
          key?: string
          label_el?: string
          label_en?: string | null
          organization_id?: string
          position?: number
          register_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_register_sheet_axes_register_id_organization_id_fkey"
            columns: ["register_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "department_registers"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      department_registers: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          daily_from: string | null
          department_id: string | null
          description_el: string | null
          description_en: string | null
          entry_date_field: string | null
          history: Json
          id: string
          identity_case_number: boolean
          identity_patient_name: boolean
          kind: string
          name_el: string
          name_en: string | null
          organization_id: string
          sheet_period: string
          status: string
          table_name: string | null
          template_key: string | null
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          daily_from?: string | null
          department_id?: string | null
          description_el?: string | null
          description_en?: string | null
          entry_date_field?: string | null
          history?: Json
          id?: string
          identity_case_number?: boolean
          identity_patient_name?: boolean
          kind?: string
          name_el: string
          name_en?: string | null
          organization_id: string
          sheet_period?: string
          status?: string
          table_name?: string | null
          template_key?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          daily_from?: string | null
          department_id?: string | null
          description_el?: string | null
          description_en?: string | null
          entry_date_field?: string | null
          history?: Json
          id?: string
          identity_case_number?: boolean
          identity_patient_name?: boolean
          kind?: string
          name_el?: string
          name_en?: string | null
          organization_id?: string
          sheet_period?: string
          status?: string
          table_name?: string | null
          template_key?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "department_registers_department_id_fkey1"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_registers_organization_id_fkey1"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      department_rosters: {
        Row: {
          assignments: Json
          change_log: Json
          created_at: string
          created_by: string | null
          demand: Json
          department_id: string
          id: string
          members: Json
          organization_id: string
          period_end: string
          period_start: string
          published_at: string | null
          rules: Json
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignments?: Json
          change_log?: Json
          created_at?: string
          created_by?: string | null
          demand?: Json
          department_id: string
          id?: string
          members?: Json
          organization_id: string
          period_end: string
          period_start: string
          published_at?: string | null
          rules?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignments?: Json
          change_log?: Json
          created_at?: string
          created_by?: string | null
          demand?: Json
          department_id?: string
          id?: string
          members?: Json
          organization_id?: string
          period_end?: string
          period_start?: string
          published_at?: string | null
          rules?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_rosters_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_rosters_organization_id_fkey"
            columns: ["organization_id"]
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
          patient_days_separate: boolean
          patient_days_tracked: boolean
        }
        Insert: {
          code?: string | null
          created_at?: string
          department_type?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          patient_days_separate?: boolean
          patient_days_tracked?: boolean
        }
        Update: {
          code?: string | null
          created_at?: string
          department_type?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          patient_days_separate?: boolean
          patient_days_tracked?: boolean
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
          cme_credits: number | null
          created_at: string
          created_by: string | null
          document_type: string | null
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
          cme_credits?: number | null
          created_at?: string
          created_by?: string | null
          document_type?: string | null
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
          cme_credits?: number | null
          created_at?: string
          created_by?: string | null
          document_type?: string | null
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
          vaccination_date: string | null
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
          vaccination_date?: string | null
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
          vaccination_date?: string | null
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
          directorate_name: string | null
          email: string | null
          employee_code: string
          employment_status: string
          father_name: string | null
          first_name: string
          first_name_en: string | null
          hire_date: string | null
          hr_department_name: string | null
          id: string
          last_name: string
          last_name_en: string | null
          organization_id: string
          phone: string | null
          photo_path: string | null
          position_name: string | null
          position_name_en: string | null
          profession_name: string | null
          profession_name_en: string | null
          professional_category_id: string | null
          staff_category: string
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
          directorate_name?: string | null
          email?: string | null
          employee_code: string
          employment_status?: string
          father_name?: string | null
          first_name: string
          first_name_en?: string | null
          hire_date?: string | null
          hr_department_name?: string | null
          id?: string
          last_name: string
          last_name_en?: string | null
          organization_id: string
          phone?: string | null
          photo_path?: string | null
          position_name?: string | null
          position_name_en?: string | null
          profession_name?: string | null
          profession_name_en?: string | null
          professional_category_id?: string | null
          staff_category?: string
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
          directorate_name?: string | null
          email?: string | null
          employee_code?: string
          employment_status?: string
          father_name?: string | null
          first_name?: string
          first_name_en?: string | null
          hire_date?: string | null
          hr_department_name?: string | null
          id?: string
          last_name?: string
          last_name_en?: string | null
          organization_id?: string
          phone?: string | null
          photo_path?: string | null
          position_name?: string | null
          position_name_en?: string | null
          profession_name?: string | null
          profession_name_en?: string | null
          professional_category_id?: string | null
          staff_category?: string
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
      epi_questionnaire_question_settings: {
        Row: {
          created_at: string
          help_el: string | null
          help_en: string | null
          id: string
          is_active: boolean
          label_el: string | null
          label_en: string | null
          organization_id: string
          question_key: string
          updated_at: string
          updated_by: string | null
          version: number
          window_days: number | null
        }
        Insert: {
          created_at?: string
          help_el?: string | null
          help_en?: string | null
          id?: string
          is_active?: boolean
          label_el?: string | null
          label_en?: string | null
          organization_id: string
          question_key: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          window_days?: number | null
        }
        Update: {
          created_at?: string
          help_el?: string | null
          help_en?: string | null
          id?: string
          is_active?: boolean
          label_el?: string | null
          label_en?: string | null
          organization_id?: string
          question_key?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          window_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_questionnaire_question_settings_organization_id_fkey"
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
      hai_classification_criteria: {
        Row: {
          created_at: string
          created_by: string | null
          criterion_id: string
          hai_classification_id: string
          id: string
          organization_id: string
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criterion_id: string
          hai_classification_id: string
          id?: string
          organization_id: string
          position: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criterion_id?: string
          hai_classification_id?: string
          id?: string
          organization_id?: string
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hai_classification_criteria_hai_classification_id_organiza_fkey"
            columns: ["hai_classification_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hai_classifications"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hai_classification_criteria_organization_id_fkey"
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
          people_observed: number | null
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
          people_observed?: number | null
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
          people_observed?: number | null
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
      hr_application_links: {
        Row: {
          cancelled_at: string | null
          candidate_id: string | null
          created_at: string
          created_by: string | null
          employment_type: string | null
          expires_at: string
          id: string
          organization_id: string
          professional_category: string | null
          requested_position: string | null
          token_hash: string
          used_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          employment_type?: string | null
          expires_at: string
          id?: string
          organization_id: string
          professional_category?: string | null
          requested_position?: string | null
          token_hash: string
          used_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          employment_type?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          professional_category?: string | null
          requested_position?: string | null
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_application_links_candidate_id_organization_id_fkey"
            columns: ["candidate_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "hr_application_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_candidate_employers: {
        Row: {
          candidate_id: string
          created_at: string
          employer: string
          from_on: string | null
          id: string
          job_title: string | null
          leaving_reason: string | null
          organization_id: string
          position: number
          salary: number | null
          to_on: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          employer: string
          from_on?: string | null
          id?: string
          job_title?: string | null
          leaving_reason?: string | null
          organization_id: string
          position?: number
          salary?: number | null
          to_on?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          employer?: string
          from_on?: string | null
          id?: string
          job_title?: string | null
          leaving_reason?: string | null
          organization_id?: string
          position?: number
          salary?: number | null
          to_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_candidate_employers_candidate_id_organization_id_fkey"
            columns: ["candidate_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      hr_candidate_languages: {
        Row: {
          candidate_id: string
          certificate: boolean | null
          certificate_name: string | null
          created_at: string
          id: string
          language: string
          organization_id: string
          position: number
          reading: string | null
          speaking: string | null
          updated_at: string
          writing: string | null
        }
        Insert: {
          candidate_id: string
          certificate?: boolean | null
          certificate_name?: string | null
          created_at?: string
          id?: string
          language: string
          organization_id: string
          position?: number
          reading?: string | null
          speaking?: string | null
          updated_at?: string
          writing?: string | null
        }
        Update: {
          candidate_id?: string
          certificate?: boolean | null
          certificate_name?: string | null
          created_at?: string
          id?: string
          language?: string
          organization_id?: string
          position?: number
          reading?: string | null
          speaking?: string | null
          updated_at?: string
          writing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_candidate_languages_candidate_id_organization_id_fkey"
            columns: ["candidate_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      hr_candidate_signatures: {
        Row: {
          candidate_id: string
          created_at: string
          image: string
          organization_id: string
          signed_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          image: string
          organization_id: string
          signed_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          image?: string
          organization_id?: string
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_candidate_signatures_candidate_id_organization_id_fkey"
            columns: ["candidate_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      hr_candidates: {
        Row: {
          activities: string | null
          address: string | null
          application_link_id: string | null
          application_reason: string | null
          applied_on: string | null
          area: string | null
          birth_date: string | null
          birth_place: string | null
          children: number | null
          citizenship: string | null
          code: string
          consent_at: string | null
          consent_future: boolean | null
          consent_given: boolean
          consent_references: boolean | null
          consent_text: string | null
          consent_texts: Json
          consent_version: string | null
          created_at: string
          created_by: string | null
          decision: string | null
          decision_by_name: string | null
          decision_notes: string | null
          decision_on: string | null
          declaration_truth: boolean | null
          education: Json
          education_level: string | null
          email: string | null
          employee_id: string | null
          employment_type: string | null
          father_name: string | null
          full_name: string
          gender: string | null
          id: string
          id_authority: string | null
          id_issued_on: string | null
          id_number: string | null
          it_skills: string | null
          marital_status: string | null
          military_service: string | null
          mother_name: string | null
          nationality: string | null
          notes: string | null
          organization_id: string
          phone_landline: string | null
          phone_mobile: string | null
          postcode: string | null
          practice_licence: boolean | null
          professional_category: string | null
          requested_position: string | null
          signed_at: string | null
          smoker: boolean | null
          source: string
          status: string
          tablet_attachments_allowed: boolean
          updated_at: string
          updated_by: string | null
          why_us: string | null
          work_permit: boolean | null
        }
        Insert: {
          activities?: string | null
          address?: string | null
          application_link_id?: string | null
          application_reason?: string | null
          applied_on?: string | null
          area?: string | null
          birth_date?: string | null
          birth_place?: string | null
          children?: number | null
          citizenship?: string | null
          code: string
          consent_at?: string | null
          consent_future?: boolean | null
          consent_given?: boolean
          consent_references?: boolean | null
          consent_text?: string | null
          consent_texts?: Json
          consent_version?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          decision_by_name?: string | null
          decision_notes?: string | null
          decision_on?: string | null
          declaration_truth?: boolean | null
          education?: Json
          education_level?: string | null
          email?: string | null
          employee_id?: string | null
          employment_type?: string | null
          father_name?: string | null
          full_name: string
          gender?: string | null
          id?: string
          id_authority?: string | null
          id_issued_on?: string | null
          id_number?: string | null
          it_skills?: string | null
          marital_status?: string | null
          military_service?: string | null
          mother_name?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id: string
          phone_landline?: string | null
          phone_mobile?: string | null
          postcode?: string | null
          practice_licence?: boolean | null
          professional_category?: string | null
          requested_position?: string | null
          signed_at?: string | null
          smoker?: boolean | null
          source?: string
          status?: string
          tablet_attachments_allowed?: boolean
          updated_at?: string
          updated_by?: string | null
          why_us?: string | null
          work_permit?: boolean | null
        }
        Update: {
          activities?: string | null
          address?: string | null
          application_link_id?: string | null
          application_reason?: string | null
          applied_on?: string | null
          area?: string | null
          birth_date?: string | null
          birth_place?: string | null
          children?: number | null
          citizenship?: string | null
          code?: string
          consent_at?: string | null
          consent_future?: boolean | null
          consent_given?: boolean
          consent_references?: boolean | null
          consent_text?: string | null
          consent_texts?: Json
          consent_version?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          decision_by_name?: string | null
          decision_notes?: string | null
          decision_on?: string | null
          declaration_truth?: boolean | null
          education?: Json
          education_level?: string | null
          email?: string | null
          employee_id?: string | null
          employment_type?: string | null
          father_name?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          id_authority?: string | null
          id_issued_on?: string | null
          id_number?: string | null
          it_skills?: string | null
          marital_status?: string | null
          military_service?: string | null
          mother_name?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id?: string
          phone_landline?: string | null
          phone_mobile?: string | null
          postcode?: string | null
          practice_licence?: boolean | null
          professional_category?: string | null
          requested_position?: string | null
          signed_at?: string | null
          smoker?: boolean | null
          source?: string
          status?: string
          tablet_attachments_allowed?: boolean
          updated_at?: string
          updated_by?: string | null
          why_us?: string | null
          work_permit?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_candidates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_division_categories: {
        Row: {
          created_at: string
          division_id: string
          id: string
          organization_id: string
          professional_category: string
        }
        Insert: {
          created_at?: string
          division_id: string
          id?: string
          organization_id: string
          professional_category: string
        }
        Update: {
          created_at?: string
          division_id?: string
          id?: string
          organization_id?: string
          professional_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_division_categories_division_id_organization_id_fkey"
            columns: ["division_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hr_divisions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      hr_division_departments: {
        Row: {
          created_at: string
          department_id: string
          division_id: string
          id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          division_id: string
          id?: string
          organization_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          division_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_division_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_division_departments_division_id_organization_id_fkey"
            columns: ["division_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hr_divisions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      hr_division_members: {
        Row: {
          created_at: string
          division_id: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          division_id: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          division_id?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_division_members_division_id_organization_id_fkey"
            columns: ["division_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hr_divisions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      hr_divisions: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_divisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_interview_opinions: {
        Row: {
          author_id: string
          candidate_id: string
          comment: string | null
          created_at: string
          division_id: string | null
          id: string
          organization_id: string
          role_kind: string
          stance: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          candidate_id: string
          comment?: string | null
          created_at?: string
          division_id?: string | null
          id?: string
          organization_id: string
          role_kind: string
          stance?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          candidate_id?: string
          comment?: string | null
          created_at?: string
          division_id?: string | null
          id?: string
          organization_id?: string
          role_kind?: string
          stance?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_interview_opinions_candidate_id_organization_id_fkey"
            columns: ["candidate_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      hr_interview_settings: {
        Row: {
          organization_id: string
          tablet_attachments: boolean
          updated_at: string
        }
        Insert: {
          organization_id: string
          tablet_attachments?: boolean
          updated_at?: string
        }
        Update: {
          organization_id?: string
          tablet_attachments?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_interview_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_interviews: {
        Row: {
          available_from: string | null
          benefits: string | null
          candidate_id: string
          created_at: string
          created_by: string | null
          evaluated_at: string | null
          evaluated_by_name: string | null
          id: string
          interviewers: Json
          location: string | null
          notes: string | null
          offered_salary: number | null
          organization_id: string
          outcome: string | null
          overall_rating: number | null
          recommendation: string | null
          salary_expectation: number | null
          scheduled_at: string | null
          scores: Json
          source: string
          status: string
          strengths: string | null
          updated_at: string
          updated_by: string | null
          weaknesses: string | null
        }
        Insert: {
          available_from?: string | null
          benefits?: string | null
          candidate_id: string
          created_at?: string
          created_by?: string | null
          evaluated_at?: string | null
          evaluated_by_name?: string | null
          id?: string
          interviewers?: Json
          location?: string | null
          notes?: string | null
          offered_salary?: number | null
          organization_id: string
          outcome?: string | null
          overall_rating?: number | null
          recommendation?: string | null
          salary_expectation?: number | null
          scheduled_at?: string | null
          scores?: Json
          source?: string
          status?: string
          strengths?: string | null
          updated_at?: string
          updated_by?: string | null
          weaknesses?: string | null
        }
        Update: {
          available_from?: string | null
          benefits?: string | null
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          evaluated_at?: string | null
          evaluated_by_name?: string | null
          id?: string
          interviewers?: Json
          location?: string | null
          notes?: string | null
          offered_salary?: number | null
          organization_id?: string
          outcome?: string | null
          overall_rating?: number | null
          recommendation?: string | null
          salary_expectation?: number | null
          scheduled_at?: string | null
          scores?: Json
          source?: string
          status?: string
          strengths?: string | null
          updated_at?: string
          updated_by?: string | null
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_interviews_candidate_id_organization_id_fkey"
            columns: ["candidate_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
            referencedColumns: ["id", "organization_id"]
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
      isolation_episode_precautions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          isolation_episode_id: string
          organization_id: string
          position: number
          precaution: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          isolation_episode_id: string
          organization_id: string
          position: number
          precaution: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          isolation_episode_id?: string
          organization_id?: string
          position?: number
          precaution?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "isolation_episode_precautions_isolation_episode_id_organiz_fkey"
            columns: ["isolation_episode_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "isolation_episodes"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "isolation_episode_precautions_organization_id_fkey"
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
      kitchen_defrosting: {
        Row: {
          corrective_action: string | null
          created_at: string
          created_by: string | null
          end_temp: number | null
          end_text: string | null
          ended_at: string | null
          id: string
          limit_status: string | null
          method: string | null
          notes: string | null
          organization_id: string
          product_id: string | null
          product_name: string
          production_id: string | null
          quantity: number | null
          receipt_item_id: string | null
          recorded_by_employee_id: string | null
          recorded_by_name: string | null
          reopen_reason: string | null
          source: string
          start_temp: number | null
          start_text: string | null
          started_at: string
          temperature_unparsed: boolean
          unit: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          verified_by_employee_id: string | null
          verified_by_name: string | null
        }
        Insert: {
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          end_temp?: number | null
          end_text?: string | null
          ended_at?: string | null
          id?: string
          limit_status?: string | null
          method?: string | null
          notes?: string | null
          organization_id: string
          product_id?: string | null
          product_name: string
          production_id?: string | null
          quantity?: number | null
          receipt_item_id?: string | null
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          reopen_reason?: string | null
          source?: string
          start_temp?: number | null
          start_text?: string | null
          started_at: string
          temperature_unparsed?: boolean
          unit?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_employee_id?: string | null
          verified_by_name?: string | null
        }
        Update: {
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          end_temp?: number | null
          end_text?: string | null
          ended_at?: string | null
          id?: string
          limit_status?: string | null
          method?: string | null
          notes?: string | null
          organization_id?: string
          product_id?: string | null
          product_name?: string
          production_id?: string | null
          quantity?: number | null
          receipt_item_id?: string | null
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          reopen_reason?: string | null
          source?: string
          start_temp?: number | null
          start_text?: string | null
          started_at?: string
          temperature_unparsed?: boolean
          unit?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_employee_id?: string | null
          verified_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_defrosting_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_defrosting_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kitchen_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_defrosting_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "kitchen_productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_defrosting_receipt_item_id_fkey"
            columns: ["receipt_item_id"]
            isOneToOne: false
            referencedRelation: "kitchen_receipt_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_defrosting_receipt_item_id_fkey"
            columns: ["receipt_item_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stock"
            referencedColumns: ["receipt_item_id"]
          },
          {
            foreignKeyName: "kitchen_defrosting_recorded_by_employee_id_fkey"
            columns: ["recorded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_defrosting_verified_by_employee_id_fkey"
            columns: ["verified_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_haccp_steps: {
        Row: {
          active: boolean
          control_measure: string | null
          corrective_action: string | null
          created_at: string
          frequency: string | null
          hazard_allergen: boolean
          hazard_biological: boolean
          hazard_chemical: boolean
          hazard_physical: boolean
          hazards: string | null
          id: string
          is_ccp: boolean
          limit_key: string | null
          monitoring: string | null
          name: string
          organization_id: string
          position: number
          records: string | null
          responsible: string | null
          step_key: string | null
          updated_at: string
          verification: string | null
        }
        Insert: {
          active?: boolean
          control_measure?: string | null
          corrective_action?: string | null
          created_at?: string
          frequency?: string | null
          hazard_allergen?: boolean
          hazard_biological?: boolean
          hazard_chemical?: boolean
          hazard_physical?: boolean
          hazards?: string | null
          id?: string
          is_ccp?: boolean
          limit_key?: string | null
          monitoring?: string | null
          name: string
          organization_id: string
          position?: number
          records?: string | null
          responsible?: string | null
          step_key?: string | null
          updated_at?: string
          verification?: string | null
        }
        Update: {
          active?: boolean
          control_measure?: string | null
          corrective_action?: string | null
          created_at?: string
          frequency?: string | null
          hazard_allergen?: boolean
          hazard_biological?: boolean
          hazard_chemical?: boolean
          hazard_physical?: boolean
          hazards?: string | null
          id?: string
          is_ccp?: boolean
          limit_key?: string | null
          monitoring?: string | null
          name?: string
          organization_id?: string
          position?: number
          records?: string | null
          responsible?: string | null
          step_key?: string | null
          updated_at?: string
          verification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_haccp_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_limits: {
        Row: {
          active: boolean
          id: string
          label: string
          limit_key: string
          max_value: number | null
          min_value: number | null
          notes: string | null
          organization_id: string
          unit: string
          updated_at: string
          updated_by: string | null
          within_minutes: number | null
        }
        Insert: {
          active?: boolean
          id?: string
          label: string
          limit_key: string
          max_value?: number | null
          min_value?: number | null
          notes?: string | null
          organization_id: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
          within_minutes?: number | null
        }
        Update: {
          active?: boolean
          id?: string
          label?: string
          limit_key?: string
          max_value?: number | null
          min_value?: number | null
          notes?: string | null
          organization_id?: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
          within_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_limits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_material_usage: {
        Row: {
          created_at: string
          created_by: string | null
          dish_name: string | null
          id: string
          lot_label: string | null
          notes: string | null
          organization_id: string
          product_id: string | null
          product_name: string
          production_id: string | null
          quantity: number | null
          receipt_item_id: string | null
          recorded_by_employee_id: string | null
          recorded_by_name: string | null
          source: string
          unit: string
          updated_at: string
          used_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dish_name?: string | null
          id?: string
          lot_label?: string | null
          notes?: string | null
          organization_id: string
          product_id?: string | null
          product_name: string
          production_id?: string | null
          quantity?: number | null
          receipt_item_id?: string | null
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          source?: string
          unit?: string
          updated_at?: string
          used_on?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dish_name?: string | null
          id?: string
          lot_label?: string | null
          notes?: string | null
          organization_id?: string
          product_id?: string | null
          product_name?: string
          production_id?: string | null
          quantity?: number | null
          receipt_item_id?: string | null
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          source?: string
          unit?: string
          updated_at?: string
          used_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_material_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_material_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kitchen_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_material_usage_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "kitchen_productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_material_usage_receipt_item_id_fkey"
            columns: ["receipt_item_id"]
            isOneToOne: false
            referencedRelation: "kitchen_receipt_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_material_usage_receipt_item_id_fkey"
            columns: ["receipt_item_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stock"
            referencedColumns: ["receipt_item_id"]
          },
          {
            foreignKeyName: "kitchen_material_usage_recorded_by_employee_id_fkey"
            columns: ["recorded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_menus: {
        Row: {
          active: boolean
          created_at: string
          id: string
          menu_text: string | null
          name: string
          notes: string | null
          organization_id: string
          source: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          menu_text?: string | null
          name: string
          notes?: string | null
          organization_id: string
          source?: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          menu_text?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          source?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_menus_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_production_meals: {
        Row: {
          created_at: string
          diet: string
          dish: string
          id: string
          meal: string
          notes: string | null
          organization_id: string
          portions: number | null
          position: number
          production_id: string
        }
        Insert: {
          created_at?: string
          diet?: string
          dish: string
          id?: string
          meal: string
          notes?: string | null
          organization_id: string
          portions?: number | null
          position?: number
          production_id: string
        }
        Update: {
          created_at?: string
          diet?: string
          dish?: string
          id?: string
          meal?: string
          notes?: string | null
          organization_id?: string
          portions?: number | null
          position?: number
          production_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_production_meals_production_id_organization_id_fkey"
            columns: ["production_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kitchen_productions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      kitchen_productions: {
        Row: {
          created_at: string
          created_by: string | null
          disinfection_agent: string | null
          disinfection_concentration_ppm: number | null
          disinfection_fruit: boolean
          disinfection_minutes: number | null
          disinfection_notes: string | null
          disinfection_vegetables: boolean
          id: string
          menu_id: string | null
          menu_text: string | null
          notes: string | null
          organization_id: string
          production_date: string
          recorded_by_employee_id: string | null
          recorded_by_name: string | null
          reopen_reason: string | null
          source: string
          updated_at: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
          verified_by_employee_id: string | null
          verified_by_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          disinfection_agent?: string | null
          disinfection_concentration_ppm?: number | null
          disinfection_fruit?: boolean
          disinfection_minutes?: number | null
          disinfection_notes?: string | null
          disinfection_vegetables?: boolean
          id?: string
          menu_id?: string | null
          menu_text?: string | null
          notes?: string | null
          organization_id: string
          production_date: string
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          reopen_reason?: string | null
          source?: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_by_employee_id?: string | null
          verified_by_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          disinfection_agent?: string | null
          disinfection_concentration_ppm?: number | null
          disinfection_fruit?: boolean
          disinfection_minutes?: number | null
          disinfection_notes?: string | null
          disinfection_vegetables?: boolean
          id?: string
          menu_id?: string | null
          menu_text?: string | null
          notes?: string | null
          organization_id?: string
          production_date?: string
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          reopen_reason?: string | null
          source?: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_by_employee_id?: string | null
          verified_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_productions_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "kitchen_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_productions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_productions_recorded_by_employee_id_fkey"
            columns: ["recorded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_productions_verified_by_employee_id_fkey"
            columns: ["verified_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by: string | null
          id: string
          low_stock_quantity: number | null
          name: string
          notes: string | null
          organization_id: string
          source: string
          storage: string
          supplier_code: string | null
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          low_stock_quantity?: number | null
          name: string
          notes?: string | null
          organization_id: string
          source?: string
          storage?: string
          supplier_code?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          low_stock_quantity?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          source?: string
          storage?: string
          supplier_code?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_pureeing: {
        Row: {
          blade_check: boolean | null
          corrective_action: string | null
          created_at: string
          created_by: string | null
          id: string
          limit_status: string | null
          method: string
          notes: string | null
          organization_id: string
          product_name: string
          production_id: string | null
          pureed_on: string
          recorded_by_employee_id: string | null
          recorded_by_name: string | null
          source: string
          updated_at: string
          visual_check: boolean | null
        }
        Insert: {
          blade_check?: boolean | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          limit_status?: string | null
          method?: string
          notes?: string | null
          organization_id: string
          product_name: string
          production_id?: string | null
          pureed_on?: string
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          source?: string
          updated_at?: string
          visual_check?: boolean | null
        }
        Update: {
          blade_check?: boolean | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          limit_status?: string | null
          method?: string
          notes?: string | null
          organization_id?: string
          product_name?: string
          production_id?: string | null
          pureed_on?: string
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          source?: string
          updated_at?: string
          visual_check?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_pureeing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_pureeing_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "kitchen_productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_pureeing_recorded_by_employee_id_fkey"
            columns: ["recorded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_recall_drills: {
        Row: {
          accounted_percent: number | null
          actions: string | null
          affected_days: number | null
          affected_meals: number | null
          affected_portions: number | null
          batches_count: number | null
          code: string
          conducted_by_employee_id: string | null
          conducted_by_name: string | null
          created_at: string
          created_by: string | null
          dish_name: string | null
          drill_date: string
          elapsed_minutes: number | null
          finished_at: string | null
          id: string
          lessons: string | null
          notes: string | null
          notified: string | null
          organization_id: string
          product_id: string | null
          product_name: string | null
          quantity_unit: string | null
          receipt_item_id: string | null
          received_quantity: number | null
          result: string | null
          scenario: string
          started_at: string
          status: string
          stock_quantity: number | null
          target_minutes: number
          trace_snapshot: Json | null
          traced_within_target: boolean | null
          trigger_text: string | null
          updated_at: string
          updated_by: string | null
          used_quantity: number | null
          written_off_quantity: number | null
        }
        Insert: {
          accounted_percent?: number | null
          actions?: string | null
          affected_days?: number | null
          affected_meals?: number | null
          affected_portions?: number | null
          batches_count?: number | null
          code: string
          conducted_by_employee_id?: string | null
          conducted_by_name?: string | null
          created_at?: string
          created_by?: string | null
          dish_name?: string | null
          drill_date?: string
          elapsed_minutes?: number | null
          finished_at?: string | null
          id?: string
          lessons?: string | null
          notes?: string | null
          notified?: string | null
          organization_id: string
          product_id?: string | null
          product_name?: string | null
          quantity_unit?: string | null
          receipt_item_id?: string | null
          received_quantity?: number | null
          result?: string | null
          scenario?: string
          started_at?: string
          status?: string
          stock_quantity?: number | null
          target_minutes?: number
          trace_snapshot?: Json | null
          traced_within_target?: boolean | null
          trigger_text?: string | null
          updated_at?: string
          updated_by?: string | null
          used_quantity?: number | null
          written_off_quantity?: number | null
        }
        Update: {
          accounted_percent?: number | null
          actions?: string | null
          affected_days?: number | null
          affected_meals?: number | null
          affected_portions?: number | null
          batches_count?: number | null
          code?: string
          conducted_by_employee_id?: string | null
          conducted_by_name?: string | null
          created_at?: string
          created_by?: string | null
          dish_name?: string | null
          drill_date?: string
          elapsed_minutes?: number | null
          finished_at?: string | null
          id?: string
          lessons?: string | null
          notes?: string | null
          notified?: string | null
          organization_id?: string
          product_id?: string | null
          product_name?: string | null
          quantity_unit?: string | null
          receipt_item_id?: string | null
          received_quantity?: number | null
          result?: string | null
          scenario?: string
          started_at?: string
          status?: string
          stock_quantity?: number | null
          target_minutes?: number
          trace_snapshot?: Json | null
          traced_within_target?: boolean | null
          trigger_text?: string | null
          updated_at?: string
          updated_by?: string | null
          used_quantity?: number | null
          written_off_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_recall_drills_conducted_by_employee_id_fkey"
            columns: ["conducted_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_recall_drills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_recall_drills_product_id_organization_id_fkey"
            columns: ["product_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kitchen_products"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kitchen_recall_drills_receipt_item_id_organization_id_fkey"
            columns: ["receipt_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kitchen_receipt_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kitchen_recall_drills_receipt_item_id_organization_id_fkey"
            columns: ["receipt_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stock"
            referencedColumns: ["receipt_item_id", "organization_id"]
          },
        ]
      }
      kitchen_receipt_items: {
        Row: {
          accepted: boolean
          batch_code: string | null
          created_at: string
          expiry_on: string | null
          id: string
          lot_label: string | null
          notes: string | null
          organization_id: string
          position: number
          product_id: string | null
          product_name: string
          quantity: number | null
          receipt_id: string
          rejection_reason: string | null
          storage: string | null
          temperature: number | null
          temperature_status: string | null
          temperature_text: string | null
          temperature_unparsed: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          accepted?: boolean
          batch_code?: string | null
          created_at?: string
          expiry_on?: string | null
          id?: string
          lot_label?: string | null
          notes?: string | null
          organization_id: string
          position?: number
          product_id?: string | null
          product_name: string
          quantity?: number | null
          receipt_id: string
          rejection_reason?: string | null
          storage?: string | null
          temperature?: number | null
          temperature_status?: string | null
          temperature_text?: string | null
          temperature_unparsed?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          accepted?: boolean
          batch_code?: string | null
          created_at?: string
          expiry_on?: string | null
          id?: string
          lot_label?: string | null
          notes?: string | null
          organization_id?: string
          position?: number
          product_id?: string | null
          product_name?: string
          quantity?: number | null
          receipt_id?: string
          rejection_reason?: string | null
          storage?: string | null
          temperature?: number | null
          temperature_status?: string | null
          temperature_text?: string | null
          temperature_unparsed?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kitchen_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_receipt_items_receipt_id_organization_id_fkey"
            columns: ["receipt_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kitchen_receipts"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      kitchen_receipts: {
        Row: {
          accepted: boolean | null
          code: string
          coding_check: string | null
          corrective_action: string | null
          created_at: string
          created_by: string | null
          expiry_check: string | null
          id: string
          limit_status: string | null
          measured_temperature: number | null
          measured_temperature_text: string | null
          order_reference: string | null
          organization_id: string
          packaging_check: string | null
          quality_notes: string | null
          received_on: string
          received_time: string | null
          receiver_employee_id: string | null
          receiver_name: string | null
          result: string | null
          source: string
          status: string
          supplier_id: string | null
          supplier_name: string | null
          temperature_check: string | null
          temperature_class: string | null
          temperature_status: string | null
          temperature_unparsed: boolean
          updated_at: string
          vehicle_check: string | null
        }
        Insert: {
          accepted?: boolean | null
          code: string
          coding_check?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          expiry_check?: string | null
          id?: string
          limit_status?: string | null
          measured_temperature?: number | null
          measured_temperature_text?: string | null
          order_reference?: string | null
          organization_id: string
          packaging_check?: string | null
          quality_notes?: string | null
          received_on?: string
          received_time?: string | null
          receiver_employee_id?: string | null
          receiver_name?: string | null
          result?: string | null
          source?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          temperature_check?: string | null
          temperature_class?: string | null
          temperature_status?: string | null
          temperature_unparsed?: boolean
          updated_at?: string
          vehicle_check?: string | null
        }
        Update: {
          accepted?: boolean | null
          code?: string
          coding_check?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          expiry_check?: string | null
          id?: string
          limit_status?: string | null
          measured_temperature?: number | null
          measured_temperature_text?: string | null
          order_reference?: string | null
          organization_id?: string
          packaging_check?: string | null
          quality_notes?: string | null
          received_on?: string
          received_time?: string | null
          receiver_employee_id?: string | null
          receiver_name?: string | null
          result?: string | null
          source?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          temperature_check?: string | null
          temperature_class?: string | null
          temperature_status?: string | null
          temperature_unparsed?: boolean
          updated_at?: string
          vehicle_check?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_receipts_receiver_employee_id_fkey"
            columns: ["receiver_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_settings: {
        Row: {
          expiry_warning_days: number
          haccp_document_id: string | null
          haccp_last_review_on: string | null
          haccp_review_months: number
          haccp_team: string | null
          notes: string | null
          organization_id: string
          recall_drill_months: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          expiry_warning_days?: number
          haccp_document_id?: string | null
          haccp_last_review_on?: string | null
          haccp_review_months?: number
          haccp_team?: string | null
          notes?: string | null
          organization_id: string
          recall_drill_months?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          expiry_warning_days?: number
          haccp_document_id?: string | null
          haccp_last_review_on?: string | null
          haccp_review_months?: number
          haccp_team?: string | null
          notes?: string | null
          organization_id?: string
          recall_drill_months?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_settings_haccp_document_id_fkey"
            columns: ["haccp_document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_stock_writeoffs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          quantity: number
          reason: string
          receipt_item_id: string
          recorded_by_employee_id: string | null
          recorded_by_name: string | null
          written_off_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          quantity: number
          reason: string
          receipt_item_id: string
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          written_off_on?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          reason?: string
          receipt_item_id?: string
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          written_off_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_stock_writeoffs_receipt_item_id_organization_id_fkey"
            columns: ["receipt_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kitchen_receipt_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kitchen_stock_writeoffs_receipt_item_id_organization_id_fkey"
            columns: ["receipt_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stock"
            referencedColumns: ["receipt_item_id", "organization_id"]
          },
          {
            foreignKeyName: "kitchen_stock_writeoffs_recorded_by_employee_id_fkey"
            columns: ["recorded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_thermal_processes: {
        Row: {
          chill_minutes: number | null
          chill_status: string | null
          chill_temp: number | null
          chill_text: string | null
          cooking_status: string | null
          cooking_temp: number | null
          cooking_text: string | null
          corrective_action: string | null
          created_at: string
          created_by: string | null
          dish_name: string
          frying_status: string | null
          frying_temp: number | null
          frying_text: string | null
          id: string
          limit_status: string | null
          notes: string | null
          organization_id: string
          process_date: string
          process_time: string | null
          product_id: string | null
          production_id: string | null
          recorded_by_employee_id: string | null
          recorded_by_name: string | null
          reheat_status: string | null
          reheat_temp: number | null
          reheat_text: string | null
          source: string
          temperature_unparsed: boolean
          updated_at: string
        }
        Insert: {
          chill_minutes?: number | null
          chill_status?: string | null
          chill_temp?: number | null
          chill_text?: string | null
          cooking_status?: string | null
          cooking_temp?: number | null
          cooking_text?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          dish_name: string
          frying_status?: string | null
          frying_temp?: number | null
          frying_text?: string | null
          id?: string
          limit_status?: string | null
          notes?: string | null
          organization_id: string
          process_date?: string
          process_time?: string | null
          product_id?: string | null
          production_id?: string | null
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          reheat_status?: string | null
          reheat_temp?: number | null
          reheat_text?: string | null
          source?: string
          temperature_unparsed?: boolean
          updated_at?: string
        }
        Update: {
          chill_minutes?: number | null
          chill_status?: string | null
          chill_temp?: number | null
          chill_text?: string | null
          cooking_status?: string | null
          cooking_temp?: number | null
          cooking_text?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          dish_name?: string
          frying_status?: string | null
          frying_temp?: number | null
          frying_text?: string | null
          id?: string
          limit_status?: string | null
          notes?: string | null
          organization_id?: string
          process_date?: string
          process_time?: string | null
          product_id?: string | null
          production_id?: string | null
          recorded_by_employee_id?: string | null
          recorded_by_name?: string | null
          reheat_status?: string | null
          reheat_temp?: number | null
          reheat_text?: string | null
          source?: string
          temperature_unparsed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_thermal_processes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_thermal_processes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kitchen_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_thermal_processes_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "kitchen_productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_thermal_processes_recorded_by_employee_id_fkey"
            columns: ["recorded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratory_samples: {
        Row: {
          clinical_context: Json | null
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
          environmental_plate: string | null
          environmental_position: string | null
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
          sampling_round: number | null
          scheduled_check: boolean | null
          source_site: string | null
          specimen_condition: string | null
          specimen_type_id: string | null
          status: string
          subject_code: string | null
          subject_name: string | null
          subject_type: string | null
          surveillance_case_id: string | null
          surveillance_review_note: string | null
          surveillance_review_reason: string | null
          surveillance_review_status: string | null
          surveillance_reviewed_at: string | null
          surveillance_reviewed_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          clinical_context?: Json | null
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
          environmental_plate?: string | null
          environmental_position?: string | null
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
          sampling_round?: number | null
          scheduled_check?: boolean | null
          source_site?: string | null
          specimen_condition?: string | null
          specimen_type_id?: string | null
          status?: string
          subject_code?: string | null
          subject_name?: string | null
          subject_type?: string | null
          surveillance_case_id?: string | null
          surveillance_review_note?: string | null
          surveillance_review_reason?: string | null
          surveillance_review_status?: string | null
          surveillance_reviewed_at?: string | null
          surveillance_reviewed_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          clinical_context?: Json | null
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
          environmental_plate?: string | null
          environmental_position?: string | null
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
          sampling_round?: number | null
          scheduled_check?: boolean | null
          source_site?: string | null
          specimen_condition?: string | null
          specimen_type_id?: string | null
          status?: string
          subject_code?: string | null
          subject_name?: string | null
          subject_type?: string | null
          surveillance_case_id?: string | null
          surveillance_review_note?: string | null
          surveillance_review_reason?: string | null
          surveillance_review_status?: string | null
          surveillance_reviewed_at?: string | null
          surveillance_reviewed_by?: string | null
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
            foreignKeyName: "laboratory_samples_specimen_type_id_fkey"
            columns: ["specimen_type_id"]
            isOneToOne: false
            referencedRelation: "master_library_items"
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
      legacy_person_matches: {
        Row: {
          candidate_employee_ids: string[]
          created_at: string
          employee_id: string | null
          id: string
          label: string
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          row_count: number
          source_column: string
          source_table: string
          status: string
        }
        Insert: {
          candidate_employee_ids?: string[]
          created_at?: string
          employee_id?: string | null
          id?: string
          label: string
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          row_count?: number
          source_column: string
          source_table: string
          status: string
        }
        Update: {
          candidate_employee_ids?: string[]
          created_at?: string
          employee_id?: string | null
          id?: string
          label?: string
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          row_count?: number
          source_column?: string
          source_table?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_person_matches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_person_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legislation_candidates: {
        Row: {
          detected_at: string
          excerpt: string | null
          id: string
          item_key: string
          linked_text_id: string | null
          matched_keywords: string[]
          note: string | null
          notified_at: string | null
          published_hint: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          status: string
          title: string
          url: string | null
        }
        Insert: {
          detected_at?: string
          excerpt?: string | null
          id?: string
          item_key: string
          linked_text_id?: string | null
          matched_keywords?: string[]
          note?: string | null
          notified_at?: string | null
          published_hint?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
          title: string
          url?: string | null
        }
        Update: {
          detected_at?: string
          excerpt?: string | null
          id?: string
          item_key?: string
          linked_text_id?: string | null
          matched_keywords?: string[]
          note?: string | null
          notified_at?: string | null
          published_hint?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legislation_candidates_linked_text_id_fkey"
            columns: ["linked_text_id"]
            isOneToOne: false
            referencedRelation: "legislation_texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legislation_candidates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "legislation_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      legislation_sources: {
        Row: {
          active: boolean
          consecutive_failures: number
          created_at: string
          failure_notified: boolean
          id: string
          keywords: string[]
          kind: string
          last_checked_at: string | null
          last_error: string | null
          last_status: number | null
          name: string
          seen_keys: string[]
          url: string
        }
        Insert: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          failure_notified?: boolean
          id?: string
          keywords?: string[]
          kind?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_status?: number | null
          name: string
          seen_keys?: string[]
          url: string
        }
        Update: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          failure_notified?: boolean
          id?: string
          keywords?: string[]
          kind?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_status?: number | null
          name?: string
          seen_keys?: string[]
          url?: string
        }
        Relationships: []
      }
      legislation_text_versions: {
        Row: {
          change_note: string | null
          changed_requirements: string[]
          published_at: string
          published_by: string | null
          snapshot: Json
          text_id: string
          version: number
        }
        Insert: {
          change_note?: string | null
          changed_requirements?: string[]
          published_at?: string
          published_by?: string | null
          snapshot: Json
          text_id: string
          version: number
        }
        Update: {
          change_note?: string | null
          changed_requirements?: string[]
          published_at?: string
          published_by?: string | null
          snapshot?: Json
          text_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legislation_text_versions_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "legislation_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      legislation_texts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          issued_on: string | null
          issuer: string | null
          kind: string
          published_at: string | null
          reference: string | null
          requirements: Json
          status: string
          summary: string | null
          title: string
          title_en: string | null
          topics: string[]
          updated_at: string
          url: string | null
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          issued_on?: string | null
          issuer?: string | null
          kind?: string
          published_at?: string | null
          reference?: string | null
          requirements?: Json
          status?: string
          summary?: string | null
          title: string
          title_en?: string | null
          topics?: string[]
          updated_at?: string
          url?: string | null
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          issued_on?: string | null
          issuer?: string | null
          kind?: string
          published_at?: string | null
          reference?: string | null
          requirements?: Json
          status?: string
          summary?: string | null
          title?: string
          title_en?: string | null
          topics?: string[]
          updated_at?: string
          url?: string | null
          version?: number
        }
        Relationships: []
      }
      library_items: {
        Row: {
          abbreviation: string | null
          created_at: string
          created_by: string | null
          description_el: string | null
          description_en: string | null
          file_name: string | null
          file_path: string | null
          file_type: string | null
          id: string
          is_proposed: boolean
          kind: string
          language: string
          limoxis_note_el: string | null
          limoxis_note_en: string | null
          link_group: string
          name: string
          note_el: string | null
          note_en: string | null
          organisation: string | null
          organization_id: string | null
          sort_order: number
          status: string
          summary_el: string | null
          summary_en: string | null
          tags: string[]
          updated_at: string
          url: string | null
          year: number | null
        }
        Insert: {
          abbreviation?: string | null
          created_at?: string
          created_by?: string | null
          description_el?: string | null
          description_en?: string | null
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          is_proposed?: boolean
          kind?: string
          language?: string
          limoxis_note_el?: string | null
          limoxis_note_en?: string | null
          link_group?: string
          name: string
          note_el?: string | null
          note_en?: string | null
          organisation?: string | null
          organization_id?: string | null
          sort_order?: number
          status?: string
          summary_el?: string | null
          summary_en?: string | null
          tags?: string[]
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Update: {
          abbreviation?: string | null
          created_at?: string
          created_by?: string | null
          description_el?: string | null
          description_en?: string | null
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          is_proposed?: boolean
          kind?: string
          language?: string
          limoxis_note_el?: string | null
          limoxis_note_en?: string | null
          link_group?: string
          name?: string
          note_el?: string | null
          note_en?: string | null
          organisation?: string | null
          organization_id?: string | null
          sort_order?: number
          status?: string
          summary_el?: string | null
          summary_en?: string | null
          tags?: string[]
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      library_news: {
        Row: {
          created_by: string | null
          detected_at: string
          excerpt: string | null
          id: string
          item_key: string
          organization_id: string | null
          published_at: string | null
          source_id: string | null
          title: string
          url: string | null
        }
        Insert: {
          created_by?: string | null
          detected_at?: string
          excerpt?: string | null
          id?: string
          item_key: string
          organization_id?: string | null
          published_at?: string | null
          source_id?: string | null
          title: string
          url?: string | null
        }
        Update: {
          created_by?: string | null
          detected_at?: string
          excerpt?: string | null
          id?: string
          item_key?: string
          organization_id?: string | null
          published_at?: string | null
          source_id?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_news_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_news_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "library_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      library_sources: {
        Row: {
          abbreviation: string | null
          active: boolean
          consecutive_failures: number
          created_at: string
          id: string
          interval_hours: number
          item_id: string | null
          keywords: string[]
          kind: string
          last_checked_at: string | null
          last_error: string | null
          last_ok_at: string | null
          last_status: number | null
          name: string
          updated_at: string
          url: string
          verified: boolean
        }
        Insert: {
          abbreviation?: string | null
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          id?: string
          interval_hours?: number
          item_id?: string | null
          keywords?: string[]
          kind?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_ok_at?: string | null
          last_status?: number | null
          name: string
          updated_at?: string
          url: string
          verified?: boolean
        }
        Update: {
          abbreviation?: string | null
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          id?: string
          interval_hours?: number
          item_id?: string | null
          keywords?: string[]
          kind?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_ok_at?: string | null
          last_status?: number | null
          name?: string
          updated_at?: string
          url?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "library_sources_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
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
      microbiology_result_organisms: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          microbiology_result_id: string
          organism: string
          organization_id: string
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          microbiology_result_id: string
          organism: string
          organization_id: string
          position: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          microbiology_result_id?: string
          organism?: string
          organization_id?: string
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "microbiology_result_organisms_microbiology_result_id_organ_fkey"
            columns: ["microbiology_result_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "microbiology_results"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "microbiology_result_organisms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          department_id: string | null
          disease_code: string
          disease_label: string | null
          finding_key: string
          id: string
          notes: string | null
          notification_deadline: string | null
          notified_at: string | null
          organization_id: string
          patient_id: string | null
          reference: string | null
          reporting_doctor: string | null
          sample_id: string | null
          source: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          disease_code: string
          disease_label?: string | null
          finding_key: string
          id?: string
          notes?: string | null
          notification_deadline?: string | null
          notified_at?: string | null
          organization_id: string
          patient_id?: string | null
          reference?: string | null
          reporting_doctor?: string | null
          sample_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          disease_code?: string
          disease_label?: string | null
          finding_key?: string
          id?: string
          notes?: string | null
          notification_deadline?: string | null
          notified_at?: string | null
          organization_id?: string
          patient_id?: string | null
          reference?: string | null
          reporting_doctor?: string | null
          sample_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifiable_disease_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiable_disease_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiable_disease_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          employee_surveillance_record_id: string | null
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
          source_case_id: string | null
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
          employee_surveillance_record_id?: string | null
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
          source_case_id?: string | null
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
          employee_surveillance_record_id?: string | null
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
          source_case_id?: string | null
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
          {
            foreignKeyName: "occupational_exposure_incidents_record_fk"
            columns: ["employee_surveillance_record_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "employee_surveillance_records"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "occupational_exposure_incidents_source_case_fk"
            columns: ["source_case_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id", "organization_id"]
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
      organization_indicator_settings: {
        Row: {
          enabled: boolean
          indicator_key: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          indicator_key: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          indicator_key?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_indicator_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_legislation: {
        Row: {
          accepted_version: number
          applicable: boolean
          compliance: Json
          id: string
          next_review_on: string | null
          notes: string | null
          organization_id: string
          responsible: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          text_id: string
          updated_at: string
        }
        Insert: {
          accepted_version?: number
          applicable?: boolean
          compliance?: Json
          id?: string
          next_review_on?: string | null
          notes?: string | null
          organization_id: string
          responsible?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          text_id: string
          updated_at?: string
        }
        Update: {
          accepted_version?: number
          applicable?: boolean
          compliance?: Json
          id?: string
          next_review_on?: string | null
          notes?: string | null
          organization_id?: string
          responsible?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          text_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_legislation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_legislation_text_id_fkey"
            columns: ["text_id"]
            isOneToOne: false
            referencedRelation: "legislation_texts"
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
          granted_by_division: boolean
          id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          granted_by_division?: boolean
          id?: string
          membership_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          granted_by_division?: boolean
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
      organization_translation_settings: {
        Row: {
          enabled: boolean
          monthly_char_limit: number
          organization_id: string
          updated_at: string
          updated_by: string | null
          used_chars: number
          used_month: string
        }
        Insert: {
          enabled?: boolean
          monthly_char_limit?: number
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          used_chars?: number
          used_month?: string
        }
        Update: {
          enabled?: boolean
          monthly_char_limit?: number
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          used_chars?: number
          used_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_translation_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
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
          controls_on_time_from: string | null
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
          lira_launcher_enabled: boolean | null
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
          controls_on_time_from?: string | null
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
          lira_launcher_enabled?: boolean | null
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
          controls_on_time_from?: string | null
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
          lira_launcher_enabled?: boolean | null
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
          admission_source: string | null
          case_number: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          discharge_date: string | null
          id: string
          mdr_on_admission: boolean
          mdr_on_admission_date: string | null
          mdr_on_admission_source: string | null
          notes: string | null
          organization_id: string
          patient_id: string
          source_facility: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admission_date: string
          admission_source?: string | null
          case_number?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          discharge_date?: string | null
          id?: string
          mdr_on_admission?: boolean
          mdr_on_admission_date?: string | null
          mdr_on_admission_source?: string | null
          notes?: string | null
          organization_id: string
          patient_id: string
          source_facility?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admission_date?: string
          admission_source?: string | null
          case_number?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          discharge_date?: string | null
          id?: string
          mdr_on_admission?: boolean
          mdr_on_admission_date?: string | null
          mdr_on_admission_source?: string | null
          notes?: string | null
          organization_id?: string
          patient_id?: string
          source_facility?: string | null
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
          surveillance_case_id: string | null
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
          surveillance_case_id?: string | null
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
          surveillance_case_id?: string | null
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
            foreignKeyName: "patient_clinical_scale_assessments_case_fk"
            columns: ["surveillance_case_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id", "organization_id"]
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
      platform_announcement_views: {
        Row: {
          announcement_id: string
          organization_id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          organization_id: string
          seen_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          organization_id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_announcement_views_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "platform_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_announcement_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          audience_all_hospitals: boolean
          audience_org_ids: string[]
          body_el: string
          body_en: string | null
          created_at: string
          created_by: string | null
          cta_label_el: string | null
          cta_label_en: string | null
          cta_url: string | null
          document_name: string | null
          document_path: string | null
          document_type: string | null
          ends_at: string | null
          frequency: string
          id: string
          image_position: string
          image_url: string | null
          kind: string
          show_in_demo: boolean
          starts_at: string
          status: string
          title_el: string
          title_en: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          audience_all_hospitals?: boolean
          audience_org_ids?: string[]
          body_el: string
          body_en?: string | null
          created_at?: string
          created_by?: string | null
          cta_label_el?: string | null
          cta_label_en?: string | null
          cta_url?: string | null
          document_name?: string | null
          document_path?: string | null
          document_type?: string | null
          ends_at?: string | null
          frequency?: string
          id?: string
          image_position?: string
          image_url?: string | null
          kind?: string
          show_in_demo?: boolean
          starts_at?: string
          status?: string
          title_el: string
          title_en?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          audience_all_hospitals?: boolean
          audience_org_ids?: string[]
          body_el?: string
          body_en?: string | null
          created_at?: string
          created_by?: string | null
          cta_label_el?: string | null
          cta_label_en?: string | null
          cta_url?: string | null
          document_name?: string | null
          document_path?: string | null
          document_type?: string | null
          ends_at?: string | null
          frequency?: string
          id?: string
          image_position?: string
          image_url?: string | null
          kind?: string
          show_in_demo?: boolean
          starts_at?: string
          status?: string
          title_el?: string
          title_en?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      platform_login_attempts: {
        Row: {
          created_at: string
          id: number
          identifier: string
          ip: string | null
          reason: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          identifier: string
          ip?: string | null
          reason?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          identifier?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      platform_login_locks: {
        Row: {
          created_at: string
          failures: number
          id: number
          kind: string
          locked_until: string
          released_at: string | null
          released_by: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          failures?: number
          id?: never
          kind: string
          locked_until: string
          released_at?: string | null
          released_by?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          failures?: number
          id?: never
          kind?: string
          locked_until?: string
          released_at?: string | null
          released_by?: string | null
          subject?: string
        }
        Relationships: []
      }
      platform_login_sessions: {
        Row: {
          aal: string | null
          ended_at: string | null
          ended_by: string | null
          ended_reason: string | null
          ip: string | null
          last_ip: string | null
          last_seen_at: string
          session_id: string
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          aal?: string | null
          ended_at?: string | null
          ended_by?: string | null
          ended_reason?: string | null
          ip?: string | null
          last_ip?: string | null
          last_seen_at?: string
          session_id: string
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          aal?: string | null
          ended_at?: string | null
          ended_by?: string | null
          ended_reason?: string | null
          ip?: string | null
          last_ip?: string | null
          last_seen_at?: string
          session_id?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
          public_email: string | null
          public_name: string | null
          public_phone: string | null
          public_website: string | null
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
          public_email?: string | null
          public_name?: string | null
          public_phone?: string | null
          public_website?: string | null
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
          public_email?: string | null
          public_name?: string | null
          public_phone?: string | null
          public_website?: string | null
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
          device_day: number | null
          evidence: Json
          id: string
          organization_id: string
          patient_id: string | null
          period_label: string | null
          score: number | null
          status: string
          surveillance_case_id: string | null
          surveillance_device_id: string | null
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
          device_day?: number | null
          evidence?: Json
          id?: string
          organization_id: string
          patient_id?: string | null
          period_label?: string | null
          score?: number | null
          status?: string
          surveillance_case_id?: string | null
          surveillance_device_id?: string | null
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
          device_day?: number | null
          evidence?: Json
          id?: string
          organization_id?: string
          patient_id?: string | null
          period_label?: string | null
          score?: number | null
          status?: string
          surveillance_case_id?: string | null
          surveillance_device_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prevention_bundle_assessments_case_fk"
            columns: ["surveillance_case_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "prevention_bundle_assessments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prevention_bundle_assessments_device_fk"
            columns: ["surveillance_device_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveillance_devices"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "prevention_bundle_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prevention_bundle_assessments_patient_fk"
            columns: ["patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
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
          must_change_password: boolean
          phone: string | null
          temporary_password_expires_at: string | null
          temporary_password_locked_at: string | null
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
          must_change_password?: boolean
          phone?: string | null
          temporary_password_expires_at?: string | null
          temporary_password_locked_at?: string | null
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
          must_change_password?: boolean
          phone?: string | null
          temporary_password_expires_at?: string | null
          temporary_password_locked_at?: string | null
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
      protocol_references: {
        Row: {
          cited_year: number | null
          context: string | null
          created_at: string
          document_id: string
          id: string
          kind: string
          label: string
          organisation: string | null
          organization_id: string
          ref_key: string
          section: string | null
          text_version_id: string
        }
        Insert: {
          cited_year?: number | null
          context?: string | null
          created_at?: string
          document_id: string
          id?: string
          kind: string
          label: string
          organisation?: string | null
          organization_id: string
          ref_key: string
          section?: string | null
          text_version_id: string
        }
        Update: {
          cited_year?: number | null
          context?: string | null
          created_at?: string
          document_id?: string
          id?: string
          kind?: string
          label?: string
          organisation?: string | null
          organization_id?: string
          ref_key?: string
          section?: string | null
          text_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_references_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_references_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_references_text_version_id_fkey"
            columns: ["text_version_id"]
            isOneToOne: false
            referencedRelation: "protocol_text_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_text_versions: {
        Row: {
          attachment_ids: string[]
          attempts: number
          body: string | null
          char_count: number | null
          content_hash: string | null
          document_id: string
          document_version: string | null
          error: string | null
          extracted_at: string | null
          extractor: string | null
          id: string
          organization_id: string
          page_count: number | null
          sections: Json
          started_at: string
          status: string
        }
        Insert: {
          attachment_ids?: string[]
          attempts?: number
          body?: string | null
          char_count?: number | null
          content_hash?: string | null
          document_id: string
          document_version?: string | null
          error?: string | null
          extracted_at?: string | null
          extractor?: string | null
          id?: string
          organization_id: string
          page_count?: number | null
          sections?: Json
          started_at?: string
          status?: string
        }
        Update: {
          attachment_ids?: string[]
          attempts?: number
          body?: string | null
          char_count?: number | null
          content_hash?: string | null
          document_id?: string
          document_version?: string | null
          error?: string | null
          extracted_at?: string | null
          extractor?: string | null
          id?: string
          organization_id?: string
          page_count?: number | null
          sections?: Json
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_text_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_text_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_update_suggestions: {
        Row: {
          affected_sections: string[]
          created_at: string
          decided_at: string | null
          decided_by: string | null
          details: Json
          document_id: string
          draft_attempted_at: string | null
          draft_citation: string | null
          draft_generated_at: string | null
          draft_text: string | null
          id: string
          organization_id: string
          reason: string
          rejection_reason: string | null
          revision_document_id: string | null
          snoozed_until: string | null
          source_excerpt: string | null
          source_kind: string | null
          source_label: string | null
          source_ref: string
          source_url: string | null
          status: string
          trigger_key: string
          updated_at: string
          what_changed: string
        }
        Insert: {
          affected_sections?: string[]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          details?: Json
          document_id: string
          draft_attempted_at?: string | null
          draft_citation?: string | null
          draft_generated_at?: string | null
          draft_text?: string | null
          id?: string
          organization_id: string
          reason: string
          rejection_reason?: string | null
          revision_document_id?: string | null
          snoozed_until?: string | null
          source_excerpt?: string | null
          source_kind?: string | null
          source_label?: string | null
          source_ref?: string
          source_url?: string | null
          status?: string
          trigger_key: string
          updated_at?: string
          what_changed: string
        }
        Update: {
          affected_sections?: string[]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          details?: Json
          document_id?: string
          draft_attempted_at?: string | null
          draft_citation?: string | null
          draft_generated_at?: string | null
          draft_text?: string | null
          id?: string
          organization_id?: string
          reason?: string
          rejection_reason?: string | null
          revision_document_id?: string | null
          snoozed_until?: string | null
          source_excerpt?: string | null
          source_kind?: string | null
          source_label?: string | null
          source_ref?: string
          source_url?: string | null
          status?: string
          trigger_key?: string
          updated_at?: string
          what_changed?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_update_suggestions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_update_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_update_suggestions_revision_document_id_fkey"
            columns: ["revision_document_id"]
            isOneToOne: false
            referencedRelation: "controlled_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audit_checklist_items: {
        Row: {
          ad_hoc: boolean
          answer: string | null
          audit_id: string
          chapter_ref: string | null
          chapter_title: string | null
          clause_ref: string | null
          created_at: string
          created_by: string | null
          critical: boolean
          evidence: string | null
          evidence_required: string | null
          finding_class: string | null
          finding_id: string | null
          guidance: string | null
          id: string
          item: string
          item_en: string | null
          note: string | null
          organization_id: string
          position: number
          required: boolean
          result: string | null
          standard: string | null
          template_question_id: string | null
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          ad_hoc?: boolean
          answer?: string | null
          audit_id: string
          chapter_ref?: string | null
          chapter_title?: string | null
          clause_ref?: string | null
          created_at?: string
          created_by?: string | null
          critical?: boolean
          evidence?: string | null
          evidence_required?: string | null
          finding_class?: string | null
          finding_id?: string | null
          guidance?: string | null
          id?: string
          item: string
          item_en?: string | null
          note?: string | null
          organization_id: string
          position: number
          required?: boolean
          result?: string | null
          standard?: string | null
          template_question_id?: string | null
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Update: {
          ad_hoc?: boolean
          answer?: string | null
          audit_id?: string
          chapter_ref?: string | null
          chapter_title?: string | null
          clause_ref?: string | null
          created_at?: string
          created_by?: string | null
          critical?: boolean
          evidence?: string | null
          evidence_required?: string | null
          finding_class?: string | null
          finding_id?: string | null
          guidance?: string | null
          id?: string
          item?: string
          item_en?: string | null
          note?: string | null
          organization_id?: string
          position?: number
          required?: boolean
          result?: string | null
          standard?: string | null
          template_question_id?: string | null
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_audit_checklist_items_audit_id_organization_id_fkey"
            columns: ["audit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_audits"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_audit_checklist_items_finding_id_organization_id_fkey"
            columns: ["finding_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_findings"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_audit_checklist_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audit_checklist_items_template_question_id_fkey"
            columns: ["template_question_id"]
            isOneToOne: false
            referencedRelation: "quality_audit_template_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audit_team_members: {
        Row: {
          affiliation: string | null
          audit_id: string
          created_at: string
          created_by: string | null
          employee_id: string | null
          full_name: string
          id: string
          is_external: boolean
          organization_id: string
          position: number
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          affiliation?: string | null
          audit_id: string
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          full_name: string
          id?: string
          is_external?: boolean
          organization_id: string
          position?: number
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          affiliation?: string | null
          audit_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          full_name?: string
          id?: string
          is_external?: boolean
          organization_id?: string
          position?: number
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_audit_team_members_audit_id_organization_id_fkey"
            columns: ["audit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_audits"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_audit_team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audit_team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audit_template_questions: {
        Row: {
          areas: string[]
          chapter_ref: string
          chapter_title: string | null
          clause_ref: string
          created_at: string
          created_by: string | null
          critical: boolean
          evidence: string | null
          guidance: string | null
          id: string
          organization_id: string | null
          position: number
          question: string
          template_id: string
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          areas?: string[]
          chapter_ref?: string
          chapter_title?: string | null
          clause_ref?: string
          created_at?: string
          created_by?: string | null
          critical?: boolean
          evidence?: string | null
          guidance?: string | null
          id?: string
          organization_id?: string | null
          position: number
          question: string
          template_id: string
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Update: {
          areas?: string[]
          chapter_ref?: string
          chapter_title?: string | null
          clause_ref?: string
          created_at?: string
          created_by?: string | null
          critical?: boolean
          evidence?: string | null
          guidance?: string | null
          id?: string
          organization_id?: string | null
          position?: number
          question?: string
          template_id?: string
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_audit_template_questio_template_id_organization_id_fkey"
            columns: ["template_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_audit_templates"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_audit_template_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audit_template_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quality_audit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audit_templates: {
        Row: {
          active: boolean
          based_on: string | null
          created_at: string
          created_by: string | null
          department_types: string[]
          description: string | null
          id: string
          is_system: boolean
          organization_id: string | null
          scope: string | null
          source: string
          standard: string
          standard_version: string | null
          template_key: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          based_on?: string | null
          created_at?: string
          created_by?: string | null
          department_types?: string[]
          description?: string | null
          id?: string
          is_system?: boolean
          organization_id?: string | null
          scope?: string | null
          source?: string
          standard: string
          standard_version?: string | null
          template_key?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          based_on?: string | null
          created_at?: string
          created_by?: string | null
          department_types?: string[]
          description?: string | null
          id?: string
          is_system?: boolean
          organization_id?: string | null
          scope?: string | null
          source?: string
          standard?: string
          standard_version?: string | null
          template_key?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_audit_templates_based_on_fkey"
            columns: ["based_on"]
            isOneToOne: false
            referencedRelation: "quality_audit_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audit_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audits: {
        Row: {
          audit_body: string | null
          audit_kind: string | null
          audit_type: string
          auditee_representative: string | null
          checklist_source: string | null
          clauses_scope: string[]
          closing_attendees: string | null
          closing_meeting_on: string | null
          code: string
          completed_date: string | null
          conclusion: string | null
          correction_opened_at: string | null
          correction_opened_by: string | null
          correction_reason: string | null
          corrections_due_on: string | null
          created_at: string
          department_id: string | null
          duration_days: number | null
          extra_template_ids: string[]
          follow_up_of: string | null
          frequency_months: number | null
          history: Json
          id: string
          lead_auditor_employee_id: string | null
          lead_auditor_id: string | null
          lead_auditor_label: string | null
          lifecycle_status: string
          notes: string | null
          opening_attendees: string | null
          opening_meeting_on: string | null
          organization_id: string
          owner_employee_id: string | null
          owner_label: string | null
          owner_labels: string[]
          planned_date: string | null
          planned_month_only: boolean
          report_sent_on: string | null
          risk_level: string | null
          scope: string | null
          source: string
          standard: string | null
          standards: string[]
          status: string
          template_id: string | null
          template_title: string | null
          template_version: number | null
          title: string
          title_en: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          audit_body?: string | null
          audit_kind?: string | null
          audit_type: string
          auditee_representative?: string | null
          checklist_source?: string | null
          clauses_scope?: string[]
          closing_attendees?: string | null
          closing_meeting_on?: string | null
          code: string
          completed_date?: string | null
          conclusion?: string | null
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          corrections_due_on?: string | null
          created_at?: string
          department_id?: string | null
          duration_days?: number | null
          extra_template_ids?: string[]
          follow_up_of?: string | null
          frequency_months?: number | null
          history?: Json
          id?: string
          lead_auditor_employee_id?: string | null
          lead_auditor_id?: string | null
          lead_auditor_label?: string | null
          lifecycle_status?: string
          notes?: string | null
          opening_attendees?: string | null
          opening_meeting_on?: string | null
          organization_id: string
          owner_employee_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          planned_date?: string | null
          planned_month_only?: boolean
          report_sent_on?: string | null
          risk_level?: string | null
          scope?: string | null
          source?: string
          standard?: string | null
          standards?: string[]
          status?: string
          template_id?: string | null
          template_title?: string | null
          template_version?: number | null
          title: string
          title_en?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          audit_body?: string | null
          audit_kind?: string | null
          audit_type?: string
          auditee_representative?: string | null
          checklist_source?: string | null
          clauses_scope?: string[]
          closing_attendees?: string | null
          closing_meeting_on?: string | null
          code?: string
          completed_date?: string | null
          conclusion?: string | null
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          corrections_due_on?: string | null
          created_at?: string
          department_id?: string | null
          duration_days?: number | null
          extra_template_ids?: string[]
          follow_up_of?: string | null
          frequency_months?: number | null
          history?: Json
          id?: string
          lead_auditor_employee_id?: string | null
          lead_auditor_id?: string | null
          lead_auditor_label?: string | null
          lifecycle_status?: string
          notes?: string | null
          opening_attendees?: string | null
          opening_meeting_on?: string | null
          organization_id?: string
          owner_employee_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          planned_date?: string | null
          planned_month_only?: boolean
          report_sent_on?: string | null
          risk_level?: string | null
          scope?: string | null
          source?: string
          standard?: string | null
          standards?: string[]
          status?: string
          template_id?: string | null
          template_title?: string | null
          template_version?: number | null
          title?: string
          title_en?: string | null
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
            foreignKeyName: "quality_audits_follow_up_of_fkey"
            columns: ["follow_up_of", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_audits"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_audits_lead_auditor_employee_id_fkey"
            columns: ["lead_auditor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audits_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quality_audit_templates"
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
          description_en: string | null
          due_date: string | null
          effectiveness_due: string | null
          effectiveness_status: string | null
          history: Json
          id: string
          lifecycle_status: string
          organization_id: string
          owner_employee_id: string | null
          owner_id: string | null
          owner_label: string | null
          owner_labels: string[]
          priority: string
          source_id: string | null
          source_type: string
          status: string
          title: string
          title_en: string | null
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
          description_en?: string | null
          due_date?: string | null
          effectiveness_due?: string | null
          effectiveness_status?: string | null
          history?: Json
          id?: string
          lifecycle_status?: string
          organization_id: string
          owner_employee_id?: string | null
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          priority?: string
          source_id?: string | null
          source_type: string
          status?: string
          title: string
          title_en?: string | null
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
          description_en?: string | null
          due_date?: string | null
          effectiveness_due?: string | null
          effectiveness_status?: string | null
          history?: Json
          id?: string
          lifecycle_status?: string
          organization_id?: string
          owner_employee_id?: string | null
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          priority?: string
          source_id?: string | null
          source_type?: string
          status?: string
          title?: string
          title_en?: string | null
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
          {
            foreignKeyName: "quality_capa_actions_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_capa_progress: {
        Row: {
          author_label: string | null
          capa_id: string
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          note: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          author_label?: string | null
          capa_id: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          note: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          author_label?: string | null
          capa_id?: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          note?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_capa_progress_capa_id_organization_id_fkey"
            columns: ["capa_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_capa_actions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_capa_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_capa_root_cause_analyses: {
        Row: {
          capa_id: string
          created_at: string
          created_by: string | null
          organization_id: string
          problem_statement: string | null
          root_cause: string | null
          updated_at: string
          updated_by: string | null
          updated_by_label: string | null
        }
        Insert: {
          capa_id: string
          created_at?: string
          created_by?: string | null
          organization_id: string
          problem_statement?: string | null
          root_cause?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_label?: string | null
        }
        Update: {
          capa_id?: string
          created_at?: string
          created_by?: string | null
          organization_id?: string
          problem_statement?: string | null
          root_cause?: string | null
          updated_at?: string
          updated_by?: string | null
          updated_by_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_capa_root_cause_analyses_capa_id_organization_id_fkey"
            columns: ["capa_id", "organization_id"]
            isOneToOne: true
            referencedRelation: "quality_capa_actions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_capa_root_cause_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_capa_root_cause_factors: {
        Row: {
          capa_id: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          organization_id: string
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capa_id: string
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          organization_id: string
          position: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capa_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          organization_id?: string
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_capa_root_cause_factors_capa_id_organization_id_fkey"
            columns: ["capa_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_capa_root_cause_analyses"
            referencedColumns: ["capa_id", "organization_id"]
          },
          {
            foreignKeyName: "quality_capa_root_cause_factors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_capa_root_cause_whys: {
        Row: {
          answer: string
          capa_id: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          answer: string
          capa_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          position: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          answer?: string
          capa_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_capa_root_cause_whys_capa_id_organization_id_fkey"
            columns: ["capa_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_capa_root_cause_analyses"
            referencedColumns: ["capa_id", "organization_id"]
          },
          {
            foreignKeyName: "quality_capa_root_cause_whys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_capa_sub_actions: {
        Row: {
          capa_id: string
          created_at: string
          created_by: string | null
          done: boolean
          done_at: string | null
          done_by_label: string | null
          due_date: string | null
          id: string
          organization_id: string
          owner_employee_id: string | null
          owner_label: string | null
          position: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capa_id: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_at?: string | null
          done_by_label?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          owner_employee_id?: string | null
          owner_label?: string | null
          position: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capa_id?: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_at?: string | null
          done_by_label?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          owner_employee_id?: string | null
          owner_label?: string | null
          position?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_capa_sub_actions_capa_id_organization_id_fkey"
            columns: ["capa_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_capa_actions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_capa_sub_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_capa_sub_actions_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_department_meeting_decisions: {
        Row: {
          capa_id: string | null
          carried_from: string | null
          due_date: string | null
          id: string
          meeting_id: string
          organization_id: string
          owner_label: string | null
          position: number
          status: string
          title: string
          topic_id: string | null
        }
        Insert: {
          capa_id?: string | null
          carried_from?: string | null
          due_date?: string | null
          id?: string
          meeting_id: string
          organization_id: string
          owner_label?: string | null
          position?: number
          status?: string
          title: string
          topic_id?: string | null
        }
        Update: {
          capa_id?: string | null
          carried_from?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string
          organization_id?: string
          owner_label?: string | null
          position?: number
          status?: string
          title?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_department_meeting_deci_meeting_id_organization_id_fkey"
            columns: ["meeting_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_department_meetings"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_department_meeting_decisions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "quality_department_meeting_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_department_meeting_groups: {
        Row: {
          active: boolean
          created_at: string
          department_id: string | null
          duration_hours: number | null
          frequency_days: number
          id: string
          manager_label: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          duration_hours?: number | null
          frequency_days?: number
          id?: string
          manager_label?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          duration_hours?: number | null
          frequency_days?: number
          id?: string
          manager_label?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_department_meeting_groups_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_department_meeting_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_department_meeting_participants: {
        Row: {
          attended: boolean
          employee_id: string | null
          id: string
          meeting_id: string
          name: string
          organization_id: string
          position: number
          role: string | null
        }
        Insert: {
          attended?: boolean
          employee_id?: string | null
          id?: string
          meeting_id: string
          name: string
          organization_id: string
          position?: number
          role?: string | null
        }
        Update: {
          attended?: boolean
          employee_id?: string | null
          id?: string
          meeting_id?: string
          name?: string
          organization_id?: string
          position?: number
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_department_meeting_part_meeting_id_organization_id_fkey"
            columns: ["meeting_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_department_meetings"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_department_meeting_participants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_department_meeting_topics: {
        Row: {
          conclusion: string | null
          discussion: string | null
          id: string
          meeting_id: string
          organization_id: string
          position: number
          subject: string
        }
        Insert: {
          conclusion?: string | null
          discussion?: string | null
          id?: string
          meeting_id: string
          organization_id: string
          position?: number
          subject: string
        }
        Update: {
          conclusion?: string | null
          discussion?: string | null
          id?: string
          meeting_id?: string
          organization_id?: string
          position?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_department_meeting_topi_meeting_id_organization_id_fkey"
            columns: ["meeting_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_department_meetings"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_department_meeting_trainings: {
        Row: {
          audience: string | null
          due_date: string | null
          id: string
          meeting_id: string
          organization_id: string
          position: number
          topic: string
          training_program_id: string | null
        }
        Insert: {
          audience?: string | null
          due_date?: string | null
          id?: string
          meeting_id: string
          organization_id: string
          position?: number
          topic: string
          training_program_id?: string | null
        }
        Update: {
          audience?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string
          organization_id?: string
          position?: number
          topic?: string
          training_program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_department_meeting_trai_meeting_id_organization_id_fkey"
            columns: ["meeting_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_department_meetings"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_department_meeting_trainings_training_program_id_fkey"
            columns: ["training_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_department_meetings: {
        Row: {
          agenda: string | null
          code: string
          created_at: string
          created_by: string | null
          department_id: string
          finalized_at: string | null
          finalized_by_label: string | null
          group_id: string | null
          id: string
          kind: string
          meeting_date: string
          minutes: string | null
          next_meeting_date: string | null
          organization_id: string
          period_month: string | null
          status: string
          title: string
          training_held: boolean
          training_program_id: string | null
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          department_id: string
          finalized_at?: string | null
          finalized_by_label?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          meeting_date: string
          minutes?: string | null
          next_meeting_date?: string | null
          organization_id: string
          period_month?: string | null
          status?: string
          title: string
          training_held?: boolean
          training_program_id?: string | null
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          department_id?: string
          finalized_at?: string | null
          finalized_by_label?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          meeting_date?: string
          minutes?: string | null
          next_meeting_date?: string | null
          organization_id?: string
          period_month?: string | null
          status?: string
          title?: string
          training_held?: boolean
          training_program_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_department_meetings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_department_meetings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "quality_department_meeting_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_department_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_department_meetings_training_program_id_fkey"
            columns: ["training_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_equipment: {
        Row: {
          calibration_months: number | null
          code: string
          created_at: string
          created_by: string | null
          criticality: string
          department_id: string | null
          equipment_type: string | null
          id: string
          installed_on: string | null
          inventory_number: string | null
          location: string | null
          maintenance_months: number | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          safety_months: number | null
          serial_number: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          warranty_ends_on: string | null
        }
        Insert: {
          calibration_months?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          criticality?: string
          department_id?: string | null
          equipment_type?: string | null
          id?: string
          installed_on?: string | null
          inventory_number?: string | null
          location?: string | null
          maintenance_months?: number | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id: string
          safety_months?: number | null
          serial_number?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          warranty_ends_on?: string | null
        }
        Update: {
          calibration_months?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          criticality?: string
          department_id?: string | null
          equipment_type?: string | null
          id?: string
          installed_on?: string | null
          inventory_number?: string | null
          location?: string | null
          maintenance_months?: number | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          safety_months?: number | null
          serial_number?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          warranty_ends_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_equipment_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_equipment_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_equipment_events: {
        Row: {
          capa_code: string | null
          certificate: string | null
          description: string | null
          equipment_id: string
          happened_on: string
          id: string
          kind: string
          organization_id: string
          performed_by: string | null
          recorded_at: string
          recorded_by: string | null
          result: string
        }
        Insert: {
          capa_code?: string | null
          certificate?: string | null
          description?: string | null
          equipment_id: string
          happened_on?: string
          id?: string
          kind: string
          organization_id: string
          performed_by?: string | null
          recorded_at?: string
          recorded_by?: string | null
          result?: string
        }
        Update: {
          capa_code?: string | null
          certificate?: string | null
          description?: string | null
          equipment_id?: string
          happened_on?: string
          id?: string
          kind?: string
          organization_id?: string
          performed_by?: string | null
          recorded_at?: string
          recorded_by?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_equipment_events_equipment_id_organization_id_fkey"
            columns: ["equipment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_equipment"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_findings: {
        Row: {
          assessed_at: string | null
          assessed_by_label: string | null
          audit_item_id: string | null
          cause_categories: string[]
          clause_ref: string | null
          code: string
          correction_opened_at: string | null
          correction_opened_by: string | null
          correction_reason: string | null
          corrective_action_needed: boolean | null
          created_at: string
          department_id: string | null
          description: string | null
          description_en: string | null
          deviation_kind: string | null
          due_date: string | null
          finding_class: string | null
          follow_up_audit_id: string | null
          history: Json
          id: string
          identified_at: string
          lifecycle_status: string
          no_action_reason: string | null
          organization_id: string
          owner_employee_id: string | null
          owner_id: string | null
          owner_label: string | null
          owner_labels: string[]
          recurring: boolean | null
          reported_by_employee_id: string | null
          reported_by_label: string | null
          root_cause: string | null
          severity: string
          source_id: string | null
          source_type: string
          standard: string | null
          status: string
          title: string
          title_en: string | null
          updated_at: string
          verification_note: string | null
          verification_status: string
          verified_by_employee_id: string | null
          verified_by_label: string | null
          verified_on: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          assessed_at?: string | null
          assessed_by_label?: string | null
          audit_item_id?: string | null
          cause_categories?: string[]
          clause_ref?: string | null
          code: string
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          corrective_action_needed?: boolean | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          description_en?: string | null
          deviation_kind?: string | null
          due_date?: string | null
          finding_class?: string | null
          follow_up_audit_id?: string | null
          history?: Json
          id?: string
          identified_at?: string
          lifecycle_status?: string
          no_action_reason?: string | null
          organization_id: string
          owner_employee_id?: string | null
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          recurring?: boolean | null
          reported_by_employee_id?: string | null
          reported_by_label?: string | null
          root_cause?: string | null
          severity: string
          source_id?: string | null
          source_type: string
          standard?: string | null
          status?: string
          title: string
          title_en?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_by_employee_id?: string | null
          verified_by_label?: string | null
          verified_on?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          assessed_at?: string | null
          assessed_by_label?: string | null
          audit_item_id?: string | null
          cause_categories?: string[]
          clause_ref?: string | null
          code?: string
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          corrective_action_needed?: boolean | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          description_en?: string | null
          deviation_kind?: string | null
          due_date?: string | null
          finding_class?: string | null
          follow_up_audit_id?: string | null
          history?: Json
          id?: string
          identified_at?: string
          lifecycle_status?: string
          no_action_reason?: string | null
          organization_id?: string
          owner_employee_id?: string | null
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          recurring?: boolean | null
          reported_by_employee_id?: string | null
          reported_by_label?: string | null
          root_cause?: string | null
          severity?: string
          source_id?: string | null
          source_type?: string
          standard?: string | null
          status?: string
          title?: string
          title_en?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_by_employee_id?: string | null
          verified_by_label?: string | null
          verified_on?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_findings_audit_item_fkey"
            columns: ["audit_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_audit_checklist_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_findings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_findings_follow_up_audit_fkey"
            columns: ["follow_up_audit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_audits"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_findings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_findings_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_findings_reported_by_employee_id_fkey"
            columns: ["reported_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_findings_verified_by_employee_id_fkey"
            columns: ["verified_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_incident_blue_codes: {
        Row: {
          created_at: string
          created_by: string | null
          doctor_employee_id: string | null
          doctor_label: string | null
          gloves: boolean | null
          incident_id: string
          interventions: string[]
          nurse_employee_id: string | null
          nurse_label: string | null
          organization_id: string
          outcome: string | null
          patient_status: string | null
          staff_involved: string | null
          transfer_to: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doctor_employee_id?: string | null
          doctor_label?: string | null
          gloves?: boolean | null
          incident_id: string
          interventions?: string[]
          nurse_employee_id?: string | null
          nurse_label?: string | null
          organization_id: string
          outcome?: string | null
          patient_status?: string | null
          staff_involved?: string | null
          transfer_to?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doctor_employee_id?: string | null
          doctor_label?: string | null
          gloves?: boolean | null
          incident_id?: string
          interventions?: string[]
          nurse_employee_id?: string | null
          nurse_label?: string | null
          organization_id?: string
          outcome?: string | null
          patient_status?: string | null
          staff_involved?: string | null
          transfer_to?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_incident_blue_codes_doctor_employee_id_fkey"
            columns: ["doctor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_incident_blue_codes_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_incidents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_incident_blue_codes_nurse_employee_id_fkey"
            columns: ["nurse_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_incident_blue_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_incident_falls: {
        Row: {
          bed_rails: string | null
          created_at: string
          created_by: string | null
          doctor_instructions: string | null
          examined_by_doctor: boolean | null
          fall_type: string | null
          floor_condition: string | null
          incident_id: string
          injured_employee_id: string | null
          injured_person_type: string | null
          injury_category: string | null
          injury_description: string | null
          injury_subcategory: string | null
          location: string | null
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bed_rails?: string | null
          created_at?: string
          created_by?: string | null
          doctor_instructions?: string | null
          examined_by_doctor?: boolean | null
          fall_type?: string | null
          floor_condition?: string | null
          incident_id: string
          injured_employee_id?: string | null
          injured_person_type?: string | null
          injury_category?: string | null
          injury_description?: string | null
          injury_subcategory?: string | null
          location?: string | null
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bed_rails?: string | null
          created_at?: string
          created_by?: string | null
          doctor_instructions?: string | null
          examined_by_doctor?: boolean | null
          fall_type?: string | null
          floor_condition?: string | null
          incident_id?: string
          injured_employee_id?: string | null
          injured_person_type?: string | null
          injury_category?: string | null
          injury_description?: string | null
          injury_subcategory?: string | null
          location?: string | null
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_incident_falls_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_incidents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_incident_falls_injured_employee_id_fkey"
            columns: ["injured_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_incident_falls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_incident_obstetric: {
        Row: {
          created_at: string
          created_by: string | null
          incident_id: string
          organization_id: string
          subcategory: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          incident_id: string
          organization_id: string
          subcategory: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          incident_id?: string
          organization_id?: string
          subcategory?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_incident_obstetric_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_incidents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_incident_obstetric_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_incident_sharps: {
        Row: {
          body_site: string | null
          body_site_other: string | null
          contact_duration: string | null
          created_at: string
          created_by: string | null
          exposed_body_part: string | null
          first_user: string | null
          incident_id: string
          organization_id: string
          substance: string | null
          tool: string | null
          tool_state: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_site?: string | null
          body_site_other?: string | null
          contact_duration?: string | null
          created_at?: string
          created_by?: string | null
          exposed_body_part?: string | null
          first_user?: string | null
          incident_id: string
          organization_id: string
          substance?: string | null
          tool?: string | null
          tool_state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_site?: string | null
          body_site_other?: string | null
          contact_duration?: string | null
          created_at?: string
          created_by?: string | null
          exposed_body_part?: string | null
          first_user?: string | null
          incident_id?: string
          organization_id?: string
          substance?: string | null
          tool?: string | null
          tool_state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_incident_sharps_incident_id_organization_id_fkey"
            columns: ["incident_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_incidents"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_incident_sharps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_incidents: {
        Row: {
          affects: string | null
          category: string
          code: string
          contributing_factors: string | null
          correction_opened_at: string | null
          correction_opened_by: string | null
          correction_reason: string | null
          created_at: string
          department_id: string | null
          description: string | null
          description_en: string | null
          event_time: string | null
          event_type: string | null
          harm_occurred: boolean
          history: Json
          id: string
          immediate_actions: string | null
          impact: string
          incident_class: string | null
          involved_people: string | null
          is_anonymous: boolean
          is_sentinel: boolean
          lifecycle_status: string
          linked_admission_id: string | null
          linked_patient_id: string | null
          linked_surveillance_id: string | null
          notes: string | null
          occurred_at: string
          organization_id: string
          owner_employee_id: string | null
          owner_id: string | null
          owner_label: string | null
          owner_labels: string[]
          patient_reference: string | null
          privacy: string
          rca_due_date: string | null
          reached_patient: boolean
          report_kind: string
          reported_by: string | null
          reported_by_employee_id: string | null
          reported_by_label: string | null
          room: string | null
          root_cause: string | null
          severity: string | null
          status: string
          title: string
          title_en: string | null
          updated_at: string
          visibility: string | null
          visible_to: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          affects?: string | null
          category?: string
          code: string
          contributing_factors?: string | null
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          description_en?: string | null
          event_time?: string | null
          event_type?: string | null
          harm_occurred?: boolean
          history?: Json
          id?: string
          immediate_actions?: string | null
          impact?: string
          incident_class?: string | null
          involved_people?: string | null
          is_anonymous?: boolean
          is_sentinel?: boolean
          lifecycle_status?: string
          linked_admission_id?: string | null
          linked_patient_id?: string | null
          linked_surveillance_id?: string | null
          notes?: string | null
          occurred_at: string
          organization_id: string
          owner_employee_id?: string | null
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          patient_reference?: string | null
          privacy?: string
          rca_due_date?: string | null
          reached_patient?: boolean
          report_kind?: string
          reported_by?: string | null
          reported_by_employee_id?: string | null
          reported_by_label?: string | null
          room?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string
          title: string
          title_en?: string | null
          updated_at?: string
          visibility?: string | null
          visible_to?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          affects?: string | null
          category?: string
          code?: string
          contributing_factors?: string | null
          correction_opened_at?: string | null
          correction_opened_by?: string | null
          correction_reason?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          description_en?: string | null
          event_time?: string | null
          event_type?: string | null
          harm_occurred?: boolean
          history?: Json
          id?: string
          immediate_actions?: string | null
          impact?: string
          incident_class?: string | null
          involved_people?: string | null
          is_anonymous?: boolean
          is_sentinel?: boolean
          lifecycle_status?: string
          linked_admission_id?: string | null
          linked_patient_id?: string | null
          linked_surveillance_id?: string | null
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          owner_employee_id?: string | null
          owner_id?: string | null
          owner_label?: string | null
          owner_labels?: string[]
          patient_reference?: string | null
          privacy?: string
          rca_due_date?: string | null
          reached_patient?: boolean
          report_kind?: string
          reported_by?: string | null
          reported_by_employee_id?: string | null
          reported_by_label?: string | null
          room?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string
          title?: string
          title_en?: string | null
          updated_at?: string
          visibility?: string | null
          visible_to?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_incidents_admission_fk"
            columns: ["linked_admission_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patient_admissions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_incidents_case_fk"
            columns: ["linked_surveillance_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id", "organization_id"]
          },
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
          {
            foreignKeyName: "quality_incidents_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_incidents_patient_fk"
            columns: ["linked_patient_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_incidents_reported_by_employee_id_fkey"
            columns: ["reported_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_management_review_actions: {
        Row: {
          capa_id: string | null
          due_date: string | null
          id: string
          organization_id: string
          owner_label: string | null
          position: number
          review_id: string
          section_key: string | null
          status: string
          title: string
        }
        Insert: {
          capa_id?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          owner_label?: string | null
          position?: number
          review_id: string
          section_key?: string | null
          status?: string
          title: string
        }
        Update: {
          capa_id?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          owner_label?: string | null
          position?: number
          review_id?: string
          section_key?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_management_review_action_review_id_organization_id_fkey"
            columns: ["review_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_management_reviews"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_management_review_participants: {
        Row: {
          attended: boolean
          id: string
          name: string
          organization_id: string
          position: number
          review_id: string
          role: string | null
          signed_at: string | null
        }
        Insert: {
          attended?: boolean
          id?: string
          name: string
          organization_id: string
          position?: number
          review_id: string
          role?: string | null
          signed_at?: string | null
        }
        Update: {
          attended?: boolean
          id?: string
          name?: string
          organization_id?: string
          position?: number
          review_id?: string
          role?: string | null
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_management_review_partic_review_id_organization_id_fkey"
            columns: ["review_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_management_reviews"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_management_review_sections: {
        Row: {
          body: string | null
          id: string
          key: string
          organization_id: string
          position: number
          review_id: string
          title: string
        }
        Insert: {
          body?: string | null
          id?: string
          key: string
          organization_id: string
          position?: number
          review_id: string
          title: string
        }
        Update: {
          body?: string | null
          id?: string
          key?: string
          organization_id?: string
          position?: number
          review_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_management_review_sectio_review_id_organization_id_fkey"
            columns: ["review_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_management_reviews"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_management_reviews: {
        Row: {
          approved_at: string | null
          approved_by_label: string | null
          code: string
          created_at: string
          created_by: string | null
          frequency_days: number
          id: string
          next_review_date: string | null
          organization_id: string
          period_from: string | null
          period_to: string | null
          review_date: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_label?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          frequency_days?: number
          id?: string
          next_review_date?: string | null
          organization_id: string
          period_from?: string | null
          period_to?: string | null
          review_date: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_label?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          frequency_days?: number
          id?: string
          next_review_date?: string | null
          organization_id?: string
          period_from?: string | null
          period_to?: string | null
          review_date?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_management_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_objective_values: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month: string
          objective_id: string
          organization_id: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          objective_id: string
          organization_id: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          objective_id?: string
          organization_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_objective_values_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "quality_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_objective_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_objectives: {
        Row: {
          code: string
          committee_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          direction: string
          due_date: string | null
          id: string
          indicator_key: string | null
          level: string | null
          organization_id: string
          owner_employee_id: string | null
          owner_id: string | null
          owner_label: string | null
          platform_indicator_key: string | null
          register_id: string | null
          reported_value: number | null
          status: string
          target: number | null
          title: string
          title_en: string | null
          unit: string | null
          updated_at: string
          year: number
        }
        Insert: {
          code: string
          committee_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          direction?: string
          due_date?: string | null
          id?: string
          indicator_key?: string | null
          level?: string | null
          organization_id: string
          owner_employee_id?: string | null
          owner_id?: string | null
          owner_label?: string | null
          platform_indicator_key?: string | null
          register_id?: string | null
          reported_value?: number | null
          status?: string
          target?: number | null
          title: string
          title_en?: string | null
          unit?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          code?: string
          committee_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          direction?: string
          due_date?: string | null
          id?: string
          indicator_key?: string | null
          level?: string | null
          organization_id?: string
          owner_employee_id?: string | null
          owner_id?: string | null
          owner_label?: string | null
          platform_indicator_key?: string | null
          register_id?: string | null
          reported_value?: number | null
          status?: string
          target?: number | null
          title?: string
          title_en?: string | null
          unit?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_objectives_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_objectives_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_objectives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_objectives_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_objectives_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "department_registers"
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
          owner_employee_id: string | null
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
          owner_employee_id?: string | null
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
          owner_employee_id?: string | null
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
          {
            foreignKeyName: "quality_risk_opportunities_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
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
          owner_employee_id: string | null
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
          owner_employee_id?: string | null
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
          owner_employee_id?: string | null
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
          {
            foreignKeyName: "quality_risks_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_self_assessments: {
        Row: {
          answered_count: number
          checklist: Json
          created_at: string
          created_by: string | null
          department_id: string
          department_name: string
          due_on: string | null
          id: string
          organization_id: string
          released_at: string | null
          released_by: string | null
          score: number | null
          standard: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          template_id: string | null
          title: string
          total_count: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          answered_count?: number
          checklist?: Json
          created_at?: string
          created_by?: string | null
          department_id: string
          department_name?: string
          due_on?: string | null
          id?: string
          organization_id: string
          released_at?: string | null
          released_by?: string | null
          score?: number | null
          standard?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          template_id?: string | null
          title: string
          total_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          answered_count?: number
          checklist?: Json
          created_at?: string
          created_by?: string | null
          department_id?: string
          department_name?: string
          due_on?: string | null
          id?: string
          organization_id?: string
          released_at?: string | null
          released_by?: string | null
          score?: number | null
          standard?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          template_id?: string | null
          title?: string
          total_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_self_assessments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_self_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_self_assessments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quality_audit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_supplier_certificate_request_items: {
        Row: {
          attachment_id: string | null
          certificate_number: string | null
          certificate_snapshot: Json
          certificate_type: string | null
          certification_id: string
          created_at: string
          expires_on: string | null
          history: Json
          id: string
          issued_on: string | null
          issuer: string | null
          note: string | null
          organization_id: string
          owner_notified_at: string | null
          previous_values: Json | null
          request_id: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          attachment_id?: string | null
          certificate_number?: string | null
          certificate_snapshot?: Json
          certificate_type?: string | null
          certification_id: string
          created_at?: string
          expires_on?: string | null
          history?: Json
          id?: string
          issued_on?: string | null
          issuer?: string | null
          note?: string | null
          organization_id: string
          owner_notified_at?: string | null
          previous_values?: Json | null
          request_id: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          attachment_id?: string | null
          certificate_number?: string | null
          certificate_snapshot?: Json
          certificate_type?: string | null
          certification_id?: string
          created_at?: string
          expires_on?: string | null
          history?: Json
          id?: string
          issued_on?: string | null
          issuer?: string | null
          note?: string | null
          organization_id?: string
          owner_notified_at?: string | null
          previous_values?: Json | null
          request_id?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_certificate__supplier_id_organization_id_fkey1"
            columns: ["supplier_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_supplier_certificate_request_item_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "quality_supplier_certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_supplier_certificate_request_items_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_supplier_certificate_request_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_supplier_certificate_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "quality_supplier_certificate_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_supplier_certificate_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          certificate_snapshot: Json | null
          certification_id: string | null
          created_at: string
          first_sent_at: string | null
          id: string
          last_reminder_at: string | null
          organization_id: string
          previous_values: Json | null
          recipient_email: string
          reminder_count: number
          requested_at: string
          requested_by: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          send_count: number
          send_history: Json
          sent_at: string | null
          status: string
          submitted_at: string | null
          supplier_id: string
          token_expires_at: string | null
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          certificate_snapshot?: Json | null
          certification_id?: string | null
          created_at?: string
          first_sent_at?: string | null
          id?: string
          last_reminder_at?: string | null
          organization_id: string
          previous_values?: Json | null
          recipient_email: string
          reminder_count?: number
          requested_at?: string
          requested_by?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          send_count?: number
          send_history?: Json
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id: string
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          certificate_snapshot?: Json | null
          certification_id?: string | null
          created_at?: string
          first_sent_at?: string | null
          id?: string
          last_reminder_at?: string | null
          organization_id?: string
          previous_values?: Json | null
          recipient_email?: string
          reminder_count?: number
          requested_at?: string
          requested_by?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          send_count?: number
          send_history?: Json
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id?: string
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_certificate_r_supplier_id_organization_id_fkey"
            columns: ["supplier_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_supplier_certificate_requests_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "quality_supplier_certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_supplier_certificate_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_supplier_certifications: {
        Row: {
          attachment_id: string | null
          certificate_number: string | null
          certificate_type: string
          created_at: string
          created_by: string | null
          document_kind: string
          expires_on: string | null
          id: string
          issuer: string | null
          organization_id: string
          supplier_id: string
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attachment_id?: string | null
          certificate_number?: string | null
          certificate_type: string
          created_at?: string
          created_by?: string | null
          document_kind?: string
          expires_on?: string | null
          id?: string
          issuer?: string | null
          organization_id: string
          supplier_id: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attachment_id?: string | null
          certificate_number?: string | null
          certificate_type?: string
          created_at?: string
          created_by?: string | null
          document_kind?: string
          expires_on?: string | null
          id?: string
          issuer?: string | null
          organization_id?: string
          supplier_id?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_certification_supplier_id_organization_id_fkey"
            columns: ["supplier_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_supplier_certifications_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_supplier_certifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_supplier_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          job_title: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          position: number
          supplier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          job_title?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          position?: number
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          position?: number
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_supplier_contacts_supplier_id_organization_id_fkey"
            columns: ["supplier_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_supplier_eval_template_criteria: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          label: string
          optional: boolean
          organization_id: string
          position: number
          template_id: string
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          optional?: boolean
          organization_id: string
          position?: number
          template_id: string
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          optional?: boolean
          organization_id?: string
          position?: number
          template_id?: string
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_eval_template_criteria_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_supplier_eval_template_template_id_organization_id_fkey"
            columns: ["template_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_supplier_eval_templates"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_supplier_eval_templates: {
        Row: {
          active: boolean
          categories: string[]
          conditional_threshold: number
          created_at: string
          created_by: string | null
          description: string | null
          frequency_months: number
          id: string
          name: string
          organization_id: string
          pass_threshold: number
          score_scale: number
          source: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          categories?: string[]
          conditional_threshold?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency_months?: number
          id?: string
          name: string
          organization_id: string
          pass_threshold?: number
          score_scale?: number
          source?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          categories?: string[]
          conditional_threshold?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency_months?: number
          id?: string
          name?: string
          organization_id?: string
          pass_threshold?: number
          score_scale?: number
          source?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_eval_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_supplier_evaluation_scores: {
        Row: {
          created_at: string
          created_by: string | null
          criterion: string | null
          criterion_id: string | null
          criterion_label: string | null
          evaluation_id: string
          id: string
          organization_id: string
          position: number
          score: number
          score_scale: number
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criterion?: string | null
          criterion_id?: string | null
          criterion_label?: string | null
          evaluation_id: string
          id?: string
          organization_id: string
          position?: number
          score: number
          score_scale?: number
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criterion?: string | null
          criterion_id?: string | null
          criterion_label?: string | null
          evaluation_id?: string
          id?: string
          organization_id?: string
          position?: number
          score?: number
          score_scale?: number
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_evaluation__evaluation_id_organization_i_fkey1"
            columns: ["evaluation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_supplier_evaluations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_supplier_evaluation_scores_criterion_fkey"
            columns: ["criterion_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_supplier_eval_template_criteria"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_supplier_evaluation_scores_organization_id_fkey1"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_supplier_evaluations: {
        Row: {
          conditional_threshold: number | null
          created_at: string
          created_by: string | null
          criteria_scores: string
          evaluated_on: string
          evaluator: string | null
          id: string
          notes: string | null
          organization_id: string
          pass_threshold: number | null
          period_year: number | null
          result: string | null
          score_scale: number
          source: string
          supplier_id: string
          template_id: string | null
          template_name: string | null
          template_version: number | null
          total_score: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conditional_threshold?: number | null
          created_at?: string
          created_by?: string | null
          criteria_scores?: string
          evaluated_on: string
          evaluator?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          pass_threshold?: number | null
          period_year?: number | null
          result?: string | null
          score_scale?: number
          source?: string
          supplier_id: string
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
          total_score?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conditional_threshold?: number | null
          created_at?: string
          created_by?: string | null
          criteria_scores?: string
          evaluated_on?: string
          evaluator?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          pass_threshold?: number | null
          period_year?: number | null
          result?: string | null
          score_scale?: number
          source?: string
          supplier_id?: string
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
          total_score?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_evaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_supplier_evaluations_supplier_id_organization_id_fkey"
            columns: ["supplier_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_supplier_evaluations_template_fkey"
            columns: ["template_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_supplier_eval_templates"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_supplier_nonconformities: {
        Row: {
          capa_code: string | null
          closed_on: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          occurred_on: string
          organization_id: string
          severity: string
          status: string
          supplier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capa_code?: string | null
          closed_on?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          occurred_on: string
          organization_id: string
          severity?: string
          status?: string
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capa_code?: string | null
          closed_on?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          occurred_on?: string
          organization_id?: string
          severity?: string
          status?: string
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_nonconformiti_supplier_id_organization_id_fkey"
            columns: ["supplier_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "quality_supplier_nonconformities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_supplier_renewal_settings: {
        Row: {
          auto_enabled: boolean
          last_result: Json
          last_run_at: string | null
          max_reminders: number
          organization_id: string
          remind_after_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_enabled?: boolean
          last_result?: Json
          last_run_at?: string | null
          max_reminders?: number
          organization_id: string
          remind_after_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_enabled?: boolean
          last_result?: Json
          last_run_at?: string | null
          max_reminders?: number
          organization_id?: string
          remind_after_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_supplier_renewal_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_suppliers: {
        Row: {
          address: string | null
          approval_status: string | null
          category: string
          city: string | null
          code: string
          contact_name: string | null
          contract_ends_on: string | null
          country: string | null
          created_at: string
          created_by: string | null
          criticality: string
          department_ids: string[]
          email: string | null
          evaluation_months: number | null
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          products: string | null
          status: string
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          approval_status?: string | null
          category?: string
          city?: string | null
          code: string
          contact_name?: string | null
          contract_ends_on?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: string
          department_ids?: string[]
          email?: string | null
          evaluation_months?: number | null
          id?: string
          legal_name?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          products?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          approval_status?: string | null
          category?: string
          city?: string | null
          code?: string
          contact_name?: string | null
          contract_ends_on?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: string
          department_ids?: string[]
          email?: string | null
          evaluation_months?: number | null
          id?: string
          legal_name?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          products?: string | null
          status?: string
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_survey_responses: {
        Row: {
          answers: Json
          channel: string
          department_id: string | null
          entered_by: string | null
          id: string
          organization_id: string
          submitted_at: string
          survey_id: string
        }
        Insert: {
          answers?: Json
          channel?: string
          department_id?: string | null
          entered_by?: string | null
          id?: string
          organization_id: string
          submitted_at?: string
          survey_id: string
        }
        Update: {
          answers?: Json
          channel?: string
          department_id?: string | null
          entered_by?: string | null
          id?: string
          organization_id?: string
          submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_survey_responses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_survey_responses_survey_id_organization_id_fkey"
            columns: ["survey_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "quality_surveys"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      quality_surveys: {
        Row: {
          audience: string
          closes_on: string | null
          code: string
          created_at: string
          created_by: string | null
          department_ids: string[]
          description: string | null
          description_en: string | null
          id: string
          opens_on: string | null
          organization_id: string
          public_token: string
          questions: Json
          satisfied_target: number
          sections: Json
          status: string
          target_responses: number | null
          template_key: string | null
          title: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          audience?: string
          closes_on?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          department_ids?: string[]
          description?: string | null
          description_en?: string | null
          id?: string
          opens_on?: string | null
          organization_id: string
          public_token?: string
          questions?: Json
          satisfied_target?: number
          sections?: Json
          status?: string
          target_responses?: number | null
          template_key?: string | null
          title: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string
          closes_on?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          department_ids?: string[]
          description?: string | null
          description_en?: string | null
          id?: string
          opens_on?: string | null
          organization_id?: string
          public_token?: string
          questions?: Json
          satisfied_target?: number
          sections?: Json
          status?: string
          target_responses?: number | null
          template_key?: string | null
          title?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_surveys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
      regulation_drafts: {
        Row: {
          active: boolean
          change_note: string | null
          content: Json
          organization_id: string
          regulation_id: string
          revision: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          change_note?: string | null
          content: Json
          organization_id: string
          regulation_id: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          change_note?: string | null
          content?: Json
          organization_id?: string
          regulation_id?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulation_drafts_regulation_id_organization_id_fkey"
            columns: ["regulation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "regulations"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      regulation_editions: {
        Row: {
          approved_at: string
          approved_by: string | null
          approved_by_name: string | null
          change_note: string | null
          content: Json
          edition: number
          id: string
          issued_on: string | null
          organization_id: string
          regulation_id: string
          signatures: Json
          template_version: number | null
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          approved_by_name?: string | null
          change_note?: string | null
          content: Json
          edition: number
          id?: string
          issued_on?: string | null
          organization_id: string
          regulation_id: string
          signatures?: Json
          template_version?: number | null
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          approved_by_name?: string | null
          change_note?: string | null
          content?: Json
          edition?: number
          id?: string
          issued_on?: string | null
          organization_id?: string
          regulation_id?: string
          signatures?: Json
          template_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "regulation_editions_regulation_id_organization_id_fkey"
            columns: ["regulation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "regulations"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      regulation_signatures: {
        Row: {
          draft_revision: number
          edition: number | null
          id: string
          image: string | null
          organization_id: string
          regulation_id: string
          role: string
          signed_at: string
          signed_by: string | null
          signer_name: string
          signer_title: string | null
        }
        Insert: {
          draft_revision: number
          edition?: number | null
          id?: string
          image?: string | null
          organization_id: string
          regulation_id: string
          role: string
          signed_at?: string
          signed_by?: string | null
          signer_name: string
          signer_title?: string | null
        }
        Update: {
          draft_revision?: number
          edition?: number | null
          id?: string
          image?: string | null
          organization_id?: string
          regulation_id?: string
          role?: string
          signed_at?: string
          signed_by?: string | null
          signer_name?: string
          signer_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulation_signatures_regulation_fkey"
            columns: ["regulation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "regulations"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      regulation_template_versions: {
        Row: {
          change_note: string | null
          content: Json
          published_at: string
          published_by: string | null
          template_key: string
          version: number
        }
        Insert: {
          change_note?: string | null
          content: Json
          published_at?: string
          published_by?: string | null
          template_key: string
          version: number
        }
        Update: {
          change_note?: string | null
          content?: Json
          published_at?: string
          published_by?: string | null
          template_key?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "regulation_template_versions_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "regulation_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      regulation_templates: {
        Row: {
          category: string
          change_note: string | null
          content: Json
          description: string | null
          key: string
          published_at: string
          sources: string | null
          title: string
          title_en: string | null
          updated_at: string
          version: number
        }
        Insert: {
          category?: string
          change_note?: string | null
          content?: Json
          description?: string | null
          key: string
          published_at?: string
          sources?: string | null
          title: string
          title_en?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          change_note?: string | null
          content?: Json
          description?: string | null
          key?: string
          published_at?: string
          sources?: string | null
          title?: string
          title_en?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      regulations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          archived: boolean
          category: string
          code: string
          content: Json
          created_at: string
          created_by: string | null
          description: string | null
          edition: number
          id: string
          issued_on: string | null
          organization_id: string
          signatures: Json
          template_key: string | null
          template_version: number | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          archived?: boolean
          category?: string
          code: string
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          edition?: number
          id?: string
          issued_on?: string | null
          organization_id: string
          signatures?: Json
          template_key?: string | null
          template_version?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          archived?: boolean
          category?: string
          code?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          edition?: number
          id?: string
          issued_on?: string | null
          organization_id?: string
          signatures?: Json
          template_key?: string | null
          template_version?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulations_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "regulation_templates"
            referencedColumns: ["key"]
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
      roster_requests: {
        Row: {
          created_at: string
          date_from: string
          date_to: string | null
          decided_at: string | null
          decided_by: string | null
          department_id: string
          employee_id: string
          id: string
          kind: string
          note: string | null
          organization_id: string
          requested_by: string | null
          status: string
          swap_date: string | null
          swap_employee_id: string | null
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to?: string | null
          decided_at?: string | null
          decided_by?: string | null
          department_id: string
          employee_id: string
          id?: string
          kind: string
          note?: string | null
          organization_id: string
          requested_by?: string | null
          status?: string
          swap_date?: string | null
          swap_employee_id?: string | null
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string | null
          decided_at?: string | null
          decided_by?: string | null
          department_id?: string
          employee_id?: string
          id?: string
          kind?: string
          note?: string | null
          organization_id?: string
          requested_by?: string | null
          status?: string
          swap_date?: string | null
          swap_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_requests_swap_employee_id_fkey"
            columns: ["swap_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      surveillance_case_infection_types: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          infection_type: string
          label: string
          organization_id: string
          position: number
          surveillance_case_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          infection_type: string
          label: string
          organization_id: string
          position: number
          surveillance_case_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          infection_type?: string
          label?: string
          organization_id?: string
          position?: number
          surveillance_case_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_case_infection_t_surveillance_case_id_organiz_fkey"
            columns: ["surveillance_case_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "surveillance_case_infection_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      surveillance_case_questionnaires: {
        Row: {
          answered_at: string | null
          answered_by: string | null
          answers: Json
          core_complete: boolean
          created_at: string
          definition_version: number
          id: string
          organization_id: string
          prefilled: Json
          surveillance_case_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          answered_at?: string | null
          answered_by?: string | null
          answers?: Json
          core_complete?: boolean
          created_at?: string
          definition_version?: number
          id?: string
          organization_id: string
          prefilled?: Json
          surveillance_case_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          answered_at?: string | null
          answered_by?: string | null
          answers?: Json
          core_complete?: boolean
          created_at?: string
          definition_version?: number
          id?: string
          organization_id?: string
          prefilled?: Json
          surveillance_case_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_case_questionnaires_case_fk"
            columns: ["surveillance_case_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "surveillance_case_questionnaires_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      surveillance_cases: {
        Row: {
          admission_id: string | null
          case_kind: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          final_diagnosis: string | null
          hospital_acquired: boolean | null
          id: string
          isolation_decided_at: string | null
          isolation_decided_by: string | null
          isolation_required: boolean | null
          organization_id: string
          patient_id: string
          reason: string | null
          reason_en: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          review_due_on: string | null
          room: string | null
          sepsis_severity: string | null
          started_at: string
          status: string
          suspected_source: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          admission_id?: string | null
          case_kind?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          final_diagnosis?: string | null
          hospital_acquired?: boolean | null
          id?: string
          isolation_decided_at?: string | null
          isolation_decided_by?: string | null
          isolation_required?: boolean | null
          organization_id: string
          patient_id: string
          reason?: string | null
          reason_en?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          review_due_on?: string | null
          room?: string | null
          sepsis_severity?: string | null
          started_at?: string
          status?: string
          suspected_source?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          admission_id?: string | null
          case_kind?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          final_diagnosis?: string | null
          hospital_acquired?: boolean | null
          id?: string
          isolation_decided_at?: string | null
          isolation_decided_by?: string | null
          isolation_required?: boolean | null
          organization_id?: string
          patient_id?: string
          reason?: string | null
          reason_en?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          review_due_on?: string | null
          room?: string | null
          sepsis_severity?: string | null
          started_at?: string
          status?: string
          suspected_source?: string | null
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
          detail: string | null
          due_at: string | null
          event_status: string
          event_type: string
          id: string
          occurred_at: string | null
          organization_id: string
          surveillance_case_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          due_at?: string | null
          event_status?: string
          event_type: string
          id?: string
          occurred_at?: string | null
          organization_id: string
          surveillance_case_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          due_at?: string | null
          event_status?: string
          event_type?: string
          id?: string
          occurred_at?: string | null
          organization_id?: string
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
      surveillance_neonatal_details: {
        Row: {
          admitted_from: string | null
          admitted_from_details: string | null
          care_level: string | null
          created_at: string
          created_by: string | null
          infection_episode: number | null
          organization_id: string
          outcome_answer: boolean | null
          outcome_notes: string | null
          record_number: string | null
          surveillance_case_id: string
          unit_admitted_on: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admitted_from?: string | null
          admitted_from_details?: string | null
          care_level?: string | null
          created_at?: string
          created_by?: string | null
          infection_episode?: number | null
          organization_id: string
          outcome_answer?: boolean | null
          outcome_notes?: string | null
          record_number?: string | null
          surveillance_case_id: string
          unit_admitted_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admitted_from?: string | null
          admitted_from_details?: string | null
          care_level?: string | null
          created_at?: string
          created_by?: string | null
          infection_episode?: number | null
          organization_id?: string
          outcome_answer?: boolean | null
          outcome_notes?: string | null
          record_number?: string | null
          surveillance_case_id?: string
          unit_admitted_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_neonatal_details_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveillance_neonatal_details_surveillance_case_id_organiz_fkey"
            columns: ["surveillance_case_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id", "organization_id"]
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
      surveillance_surgical_procedures: {
        Row: {
          antibiotic_prophylaxis: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          devices_added: boolean | null
          devices_added_details: string | null
          id: string
          organization_id: string
          performed_on: string | null
          position: number
          reoperation: boolean | null
          surveillance_case_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          antibiotic_prophylaxis?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          devices_added?: boolean | null
          devices_added_details?: string | null
          id?: string
          organization_id: string
          performed_on?: string | null
          position: number
          reoperation?: boolean | null
          surveillance_case_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          antibiotic_prophylaxis?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          devices_added?: boolean | null
          devices_added_details?: string | null
          id?: string
          organization_id?: string
          performed_on?: string | null
          position?: number
          reoperation?: boolean | null
          surveillance_case_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_surgical_procedu_surveillance_case_id_organiz_fkey"
            columns: ["surveillance_case_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveillance_cases"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "surveillance_surgical_procedures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      training_assessment_answers: {
        Row: {
          answer_boolean: boolean | null
          answer_kind: string
          answer_number: number | null
          answer_option_keys: string[] | null
          answer_text: string | null
          assignment_id: string
          awarded_points: number | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          question_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          answer_boolean?: boolean | null
          answer_kind: string
          answer_number?: number | null
          answer_option_keys?: string[] | null
          answer_text?: string | null
          assignment_id: string
          awarded_points?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          question_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          answer_boolean?: boolean | null
          answer_kind?: string
          answer_number?: number | null
          answer_option_keys?: string[] | null
          answer_text?: string | null
          assignment_id?: string
          awarded_points?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          question_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_assessment_answers_assignment_id_organization_id_fkey"
            columns: ["assignment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_assignments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "training_assessment_answers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_assessment_options: {
        Row: {
          correct: boolean
          created_at: string
          created_by: string | null
          id: string
          option_key: string
          organization_id: string
          position: number
          question_id: string
          text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          correct?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          option_key: string
          organization_id: string
          position?: number
          question_id: string
          text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          correct?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          option_key?: string
          organization_id?: string
          position?: number
          question_id?: string
          text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_assessment_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assessment_options_question_id_organization_id_fkey"
            columns: ["question_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_assessment_questions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      training_assessment_questions: {
        Row: {
          correct_boolean: boolean | null
          created_at: string
          created_by: string | null
          id: string
          manual_review: boolean
          model_answer: string | null
          organization_id: string
          points: number
          position: number
          program_id: string
          question_key: string
          question_type: string
          required: boolean
          text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          correct_boolean?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          manual_review?: boolean
          model_answer?: string | null
          organization_id: string
          points?: number
          position?: number
          program_id: string
          question_key: string
          question_type?: string
          required?: boolean
          text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          correct_boolean?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          manual_review?: boolean
          model_answer?: string | null
          organization_id?: string
          points?: number
          position?: number
          program_id?: string
          question_key?: string
          question_type?: string
          required?: boolean
          text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_assessment_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assessment_questions_program_id_organization_id_fkey"
            columns: ["program_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      training_assignments: {
        Row: {
          access_token: string | null
          account_linked: boolean | null
          assessment_review_acknowledged: boolean | null
          assessment_review_note: string | null
          assessment_review_status: string | null
          assessment_reviewed_at: string | null
          assessment_reviewed_by: string | null
          assessment_submitted_at: string | null
          assigned_date: string | null
          assignment_key: string
          attendance: boolean | null
          attendance_attestation_method: string | null
          attendance_attestation_version: string | null
          attendance_attested: boolean | null
          attendance_attested_at: string | null
          attendance_confirmed_at: string | null
          attendance_response: string
          competent: boolean | null
          completed_date: string | null
          completion_confirmed_at: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          department_name: string | null
          due_date: string | null
          email: string | null
          employee_code: string | null
          employee_id: string | null
          employee_name: string | null
          employee_user_id: string | null
          feedback_submitted_at: string | null
          id: string
          invitation_sent_at: string | null
          manual_entry: boolean
          organization_id: string
          program_id: string
          score: number | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_token?: string | null
          account_linked?: boolean | null
          assessment_review_acknowledged?: boolean | null
          assessment_review_note?: string | null
          assessment_review_status?: string | null
          assessment_reviewed_at?: string | null
          assessment_reviewed_by?: string | null
          assessment_submitted_at?: string | null
          assigned_date?: string | null
          assignment_key: string
          attendance?: boolean | null
          attendance_attestation_method?: string | null
          attendance_attestation_version?: string | null
          attendance_attested?: boolean | null
          attendance_attested_at?: string | null
          attendance_confirmed_at?: string | null
          attendance_response?: string
          competent?: boolean | null
          completed_date?: string | null
          completion_confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          department_name?: string | null
          due_date?: string | null
          email?: string | null
          employee_code?: string | null
          employee_id?: string | null
          employee_name?: string | null
          employee_user_id?: string | null
          feedback_submitted_at?: string | null
          id?: string
          invitation_sent_at?: string | null
          manual_entry?: boolean
          organization_id: string
          program_id: string
          score?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_token?: string | null
          account_linked?: boolean | null
          assessment_review_acknowledged?: boolean | null
          assessment_review_note?: string | null
          assessment_review_status?: string | null
          assessment_reviewed_at?: string | null
          assessment_reviewed_by?: string | null
          assessment_submitted_at?: string | null
          assigned_date?: string | null
          assignment_key?: string
          attendance?: boolean | null
          attendance_attestation_method?: string | null
          attendance_attestation_version?: string | null
          attendance_attested?: boolean | null
          attendance_attested_at?: string | null
          attendance_confirmed_at?: string | null
          attendance_response?: string
          competent?: boolean | null
          completed_date?: string | null
          completion_confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          department_name?: string | null
          due_date?: string | null
          email?: string | null
          employee_code?: string | null
          employee_id?: string | null
          employee_name?: string | null
          employee_user_id?: string | null
          feedback_submitted_at?: string | null
          id?: string
          invitation_sent_at?: string | null
          manual_entry?: boolean
          organization_id?: string
          program_id?: string
          score?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_program_id_organization_id_fkey"
            columns: ["program_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      training_certificates: {
        Row: {
          assignment_id: string
          certificate_key: string
          created_at: string
          created_by: string | null
          department_id: string | null
          employee_code: string | null
          employee_user_id: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          issued_date: string | null
          issuer: string | null
          organization_id: string
          title: string | null
          updated_at: string
          updated_by: string | null
          valid_until: string | null
        }
        Insert: {
          assignment_id: string
          certificate_key: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_code?: string | null
          employee_user_id?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          issued_date?: string | null
          issuer?: string | null
          organization_id: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Update: {
          assignment_id?: string
          certificate_key?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employee_code?: string | null
          employee_user_id?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          issued_date?: string | null
          issuer?: string | null
          organization_id?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_certificates_assignment_id_organization_id_fkey"
            columns: ["assignment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_assignments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "training_certificates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_certificates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_feedback_responses: {
        Row: {
          assignment_id: string
          comment: string | null
          created_at: string
          created_by: string | null
          employee_code: string | null
          organization_id: string
          program_id: string
          submitted_at: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          assignment_id: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          employee_code?: string | null
          organization_id: string
          program_id: string
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          assignment_id?: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          employee_code?: string | null
          organization_id?: string
          program_id?: string
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_feedback_responses_assignment_id_organization_id_fkey"
            columns: ["assignment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_assignments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "training_feedback_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_feedback_responses_program_id_organization_id_fkey"
            columns: ["program_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      training_feedback_scores: {
        Row: {
          assignment_id: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          question_key: string
          score: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          question_key: string
          score: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          question_key?: string
          score?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_feedback_scores_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "training_feedback_responses"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "training_feedback_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_feedback_template_questions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label_el: string
          label_en: string | null
          organization_id: string
          position: number
          question_key: string
          template_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label_el?: string
          label_en?: string | null
          organization_id: string
          position?: number
          question_key: string
          template_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label_el?: string
          label_en?: string | null
          organization_id?: string
          position?: number
          question_key?: string
          template_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_feedback_template_que_template_id_organization_id_fkey"
            columns: ["template_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_feedback_templates"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "training_feedback_template_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_feedback_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          template_key: string
          title_el: string | null
          title_en: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          template_key: string
          title_el?: string | null
          title_en?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          template_key?: string
          title_el?: string | null
          title_en?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_feedback_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_history_events: {
        Row: {
          action: string | null
          actor: string | null
          created_at: string
          created_by: string | null
          id: string
          occurred_at: string | null
          organization_id: string
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action?: string | null
          actor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at?: string | null
          organization_id: string
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string | null
          actor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at?: string | null
          organization_id?: string
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_history_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_material_views: {
        Row: {
          active_seconds: number
          assignment_id: string
          attachment_id: string
          first_opened_at: string
          id: string
          last_page: number | null
          last_seen_at: string
          opened_count: number
          organization_id: string
          pages: Json
          program_id: string
        }
        Insert: {
          active_seconds?: number
          assignment_id: string
          attachment_id: string
          first_opened_at?: string
          id?: string
          last_page?: number | null
          last_seen_at?: string
          opened_count?: number
          organization_id: string
          pages?: Json
          program_id: string
        }
        Update: {
          active_seconds?: number
          assignment_id?: string
          attachment_id?: string
          first_opened_at?: string
          id?: string
          last_page?: number | null
          last_seen_at?: string
          opened_count?: number
          organization_id?: string
          pages?: Json
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_material_views_assignment_id_organization_id_fkey"
            columns: ["assignment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_assignments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "training_material_views_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_material_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_program_effectiveness: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          criterion: string | null
          evaluated_at: string | null
          evaluated_by: string | null
          method: string | null
          notes: string | null
          organization_id: string
          planned_date: string | null
          program_id: string
          result: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          criterion?: string | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          method?: string | null
          notes?: string | null
          organization_id: string
          planned_date?: string | null
          program_id: string
          result?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          criterion?: string | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          method?: string | null
          notes?: string | null
          organization_id?: string
          planned_date?: string | null
          program_id?: string
          result?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_program_effectiveness_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_program_effectiveness_program_id_organization_id_fkey"
            columns: ["program_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      training_program_feedback_questions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label_el: string
          label_en: string | null
          organization_id: string
          position: number
          program_id: string
          question_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label_el?: string
          label_en?: string | null
          organization_id: string
          position?: number
          program_id: string
          question_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label_el?: string
          label_en?: string | null
          organization_id?: string
          position?: number
          program_id?: string
          question_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_program_feedback_quest_program_id_organization_id_fkey"
            columns: ["program_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "training_program_feedback_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_program_materials: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          material_key: string
          material_type: string | null
          organization_id: string
          position: number
          program_id: string
          title: string
          updated_at: string
          updated_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          material_key: string
          material_type?: string | null
          organization_id: string
          position?: number
          program_id: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          material_key?: string
          material_type?: string | null
          organization_id?: string
          position?: number
          program_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_program_materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_program_materials_program_id_organization_id_fkey"
            columns: ["program_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      training_programs: {
        Row: {
          audience: string | null
          category: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          delivery_kind: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          duration_hours: number | null
          feedback_template_key: string | null
          feedback_title_el: string | null
          feedback_title_en: string | null
          id: string
          location: string | null
          method: string | null
          organization_id: string
          owner: string | null
          owner_employee_id: string | null
          pass_score: number | null
          program_key: string
          requires_assessment: boolean
          start_date: string | null
          start_time: string | null
          status: string
          title: string
          title_en: string | null
          trainer: string | null
          trainer_employee_id: string | null
          updated_at: string
          updated_by: string | null
          valid_months: number | null
        }
        Insert: {
          audience?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          delivery_kind?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          duration_hours?: number | null
          feedback_template_key?: string | null
          feedback_title_el?: string | null
          feedback_title_en?: string | null
          id?: string
          location?: string | null
          method?: string | null
          organization_id: string
          owner?: string | null
          owner_employee_id?: string | null
          pass_score?: number | null
          program_key: string
          requires_assessment?: boolean
          start_date?: string | null
          start_time?: string | null
          status?: string
          title?: string
          title_en?: string | null
          trainer?: string | null
          trainer_employee_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_months?: number | null
        }
        Update: {
          audience?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          delivery_kind?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          duration_hours?: number | null
          feedback_template_key?: string | null
          feedback_title_el?: string | null
          feedback_title_en?: string | null
          id?: string
          location?: string | null
          method?: string | null
          organization_id?: string
          owner?: string | null
          owner_employee_id?: string | null
          pass_score?: number | null
          program_key?: string
          requires_assessment?: boolean
          start_date?: string | null
          start_time?: string | null
          status?: string
          title?: string
          title_en?: string | null
          trainer?: string | null
          trainer_employee_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_programs_owner_employee_id_fkey"
            columns: ["owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_programs_trainer_employee_id_fkey"
            columns: ["trainer_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      training_requirement_programs: {
        Row: {
          created_at: string
          created_by: string | null
          organization_id: string
          position: number
          program_id: string
          requirement_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          organization_id: string
          position?: number
          program_id: string
          requirement_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          organization_id?: string
          position?: number
          program_id?: string
          requirement_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_requirement_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_requirement_programs_program_id_organization_id_fkey"
            columns: ["program_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "training_requirement_programs_requirement_id_organization__fkey"
            columns: ["requirement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_requirements"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      training_requirement_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          position: number
          requirement_id: string
          target_kind: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          position?: number
          requirement_id: string
          target_kind: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          position?: number
          requirement_id?: string
          target_kind?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_requirement_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_requirement_targets_requirement_id_organization_i_fkey"
            columns: ["requirement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "training_requirements"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      training_requirements: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          renewal_months: number | null
          requirement_key: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          renewal_months?: number | null
          requirement_key: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          renewal_months?: number | null
          requirement_key?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_jobs: {
        Row: {
          attempts: number
          created_at: string
          entity: string
          entity_id: string
          field: string
          id: string
          last_error: string | null
          organization_id: string
          source_hash: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity: string
          entity_id: string
          field: string
          id?: string
          last_error?: string | null
          organization_id: string
          source_hash: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entity?: string
          entity_id?: string
          field?: string
          id?: string
          last_error?: string | null
          organization_id?: string
          source_hash?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_jobs_organization_id_fkey"
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
      user_view_preferences: {
        Row: {
          organization_id: string
          updated_at: string
          user_id: string
          value: Json
          view_key: string
        }
        Insert: {
          organization_id: string
          updated_at?: string
          user_id: string
          value?: Json
          view_key: string
        }
        Update: {
          organization_id?: string
          updated_at?: string
          user_id?: string
          value?: Json
          view_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_view_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      kitchen_stock: {
        Row: {
          batch_code: string | null
          expiry_on: string | null
          in_stock: boolean | null
          lot_label: string | null
          organization_id: string | null
          product_id: string | null
          product_name: string | null
          receipt_code: string | null
          receipt_id: string | null
          receipt_item_id: string | null
          received_on: string | null
          received_quantity: number | null
          remaining_quantity: number | null
          storage: string | null
          supplier_id: string | null
          supplier_name: string | null
          unit: string | null
          used_quantity: number | null
          uses: number | null
          written_off_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kitchen_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_receipt_items_receipt_id_organization_id_fkey"
            columns: ["receipt_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kitchen_receipts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kitchen_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "quality_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
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
      analysis_culture_metrics: {
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
      analysis_mdr_patients: {
        Args: {
          p_department_id?: string
          p_from?: string
          p_organization_id: string
          p_to?: string
        }
        Returns: number
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
      analysis_quality_food_metrics: {
        Args: {
          p_department_id?: string
          p_from?: string
          p_organization_id?: string
          p_to?: string
        }
        Returns: Json
      }
      analysis_training_metrics: {
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
          in_control_team: boolean
          is_external: boolean
          member_name: string
          member_roles: string[]
          member_type: string
          organization_id: string
          responsibilities: string | null
          specialty: string | null
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
      bin_delete: {
        Args: {
          p_detail?: string
          p_id: string
          p_label: string
          p_reason?: string
          p_table: string
        }
        Returns: string
      }
      bin_list_mine: {
        Args: { p_organization_id: string }
        Returns: {
          deleted_at: string
          deleted_by_name: string
          detail: string
          expires_at: string
          id: string
          kind: string
          label: string
          module: string
          payload: Json
          server: boolean
        }[]
      }
      bin_purge_mine: { Args: { p_entry: string }; Returns: undefined }
      bin_restore: { Args: { p_entry: string }; Returns: Json }
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
          composition: string
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
          admission_source: string | null
          case_number: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          discharge_date: string | null
          id: string
          mdr_on_admission: boolean
          mdr_on_admission_date: string | null
          mdr_on_admission_source: string | null
          notes: string | null
          organization_id: string
          patient_id: string
          source_facility: string | null
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
      committee_overview_counts: {
        Args: { p_organization_id: string }
        Returns: {
          committee_id: string
          decisions_open: number
          meetings_open: number
          meetings_total: number
        }[]
      }
      complete_password_change: { Args: never; Returns: boolean }
      control_adherence_counts: {
        Args: { p_from: string; p_organization_id: string; p_to: string }
        Returns: {
          assignment_id: string
          on_time: number
          performed: number
        }[]
      }
      control_assignment_summary: {
        Args: { p_organization_id: string; p_today_from?: string }
        Returns: {
          assignment_id: string
          executions: number
          findings: number
          last_performed_at: string
          today: number
        }[]
      }
      control_calendar_months: {
        Args: {
          p_organization_id: string
          p_time_zone?: string
          p_year: number
        }
        Returns: {
          assignment_id: string
          done: number
          late: number
          marks: Json
          month: number
        }[]
      }
      control_entry_day_times: {
        Args: {
          p_from: string
          p_organization_id: string
          p_to: string
          p_tz?: string
        }
        Returns: {
          assignment_id: string
          days: Json
        }[]
      }
      control_execution_times: {
        Args: {
          p_from: string
          p_organization_id: string
          p_to: string
          p_tz?: string
        }
        Returns: {
          assignment_id: string
          minutes: number[]
          slot: number
        }[]
      }
      control_period_progress: {
        Args: { p_organization_id: string }
        Returns: {
          assignment_id: string
          done: number
          extra: number
          period_end: string
          period_start: string
          required: number
        }[]
      }
      control_recent_executions: {
        Args: {
          p_assignment_ids: string[]
          p_limit?: number
          p_organization_id: string
        }
        Returns: {
          assignment_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          checked_points: string | null
          control_id: string
          created_at: string
          department_id: string
          edited_at: string | null
          edited_by: string | null
          extra_reason: string | null
          has_finding: boolean
          has_item_list: boolean | null
          id: string
          is_extra: boolean
          notes: string | null
          organization_id: string
          performed_at: string
          performed_by: string
          response_data: Json
          result_text: string | null
          status: string
          value_text: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "control_executions"
          isOneToOne: false
          isSetofReturn: true
        }
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
          admission_source: string | null
          case_number: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          discharge_date: string | null
          id: string
          mdr_on_admission: boolean
          mdr_on_admission_date: string | null
          mdr_on_admission_source: string | null
          notes: string | null
          organization_id: string
          patient_id: string
          source_facility: string | null
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
      create_patient_admission_numbered: {
        Args: {
          p_admission_date: string
          p_case_number: string
          p_department_id: string
          p_discharge_date?: string
          p_notes?: string
          p_organization_id: string
          p_patient_id: string
          p_status?: string
        }
        Returns: {
          admission_date: string
          admission_source: string | null
          case_number: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          discharge_date: string | null
          id: string
          mdr_on_admission: boolean
          mdr_on_admission_date: string | null
          mdr_on_admission_source: string | null
          notes: string | null
          organization_id: string
          patient_id: string
          source_facility: string | null
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
      create_surveillance_case: {
        Args: {
          p_admission_id?: string
          p_department_id?: string
          p_organization_id: string
          p_patient_id: string
          p_reason?: string
          p_reason_en?: string
          p_review_due?: string
          p_room?: string
          p_started_at?: string
          p_suspected_source?: string
        }
        Returns: {
          admission_id: string | null
          case_kind: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          final_diagnosis: string | null
          hospital_acquired: boolean | null
          id: string
          isolation_decided_at: string | null
          isolation_decided_by: string | null
          isolation_required: boolean | null
          organization_id: string
          patient_id: string
          reason: string | null
          reason_en: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          review_due_on: string | null
          room: string | null
          sepsis_severity: string | null
          started_at: string
          status: string
          suspected_source: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "surveillance_cases"
          isOneToOne: false
          isSetofReturn: true
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
      dashboard_metrics: {
        Args: { p_department_ids?: string[]; p_organization_id: string }
        Returns: Json
      }
      delete_lira_provider_secret: {
        Args: { p_secret_id: string }
        Returns: undefined
      }
      delete_patient_admission: {
        Args: {
          p_admission_id: string
          p_organization_id: string
          p_patient_id: string
          p_reason: string
        }
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
      demo_reset_my_organization: {
        Args: { p_organization_id: string }
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
      department_register_fast_reads: {
        Args: { p_register_id: string }
        Returns: undefined
      }
      department_register_sync: {
        Args: { p_register_id: string }
        Returns: string
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
      executive_governance_status: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      fm_stage_files_resolve_targets: { Args: never; Returns: number }
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
      get_translation_settings: {
        Args: { p_organization_id: string }
        Returns: {
          enabled: boolean
          monthly_char_limit: number
          provider_ready: boolean
          used_chars: number
        }[]
      }
      greek_to_latin: { Args: { input: string }; Returns: string }
      has_org_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          target_org: string
        }
        Returns: boolean
      }
      hr_application_link_cancel: {
        Args: { p_link_id: string }
        Returns: undefined
      }
      hr_application_link_create: {
        Args: { p_organization_id: string; p_position?: string }
        Returns: Json
      }
      hr_application_link_set: {
        Args: { p_category: string; p_employment: string; p_link_id: string }
        Returns: undefined
      }
      hr_application_public: { Args: { p_token: string }; Returns: Json }
      hr_application_submit: {
        Args: { p_payload: Json; p_token: string }
        Returns: Json
      }
      hr_candidate_opinions: { Args: { p_candidate_id: string }; Returns: Json }
      hr_division_candidates: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      hr_save_opinion: {
        Args: {
          p_candidate_id: string
          p_comment: string
          p_stance: string
          p_submit?: boolean
        }
        Returns: Json
      }
      is_org_admin: { Args: { target_org: string }; Returns: boolean }
      is_org_member: { Args: { target_org: string }; Returns: boolean }
      kitchen_batch_balances: {
        Args: { p_organization_id: string; p_since?: string }
        Returns: {
          in_stock: boolean
          receipt_id: string
          receipt_item_id: string
          used: number
          uses: number
          written_off: number
        }[]
      }
      laboratory_sample_list: {
        Args: { p_environmental?: boolean; p_organization_id: string }
        Returns: Json
      }
      laboratory_sample_list_lean: {
        Args: {
          p_environmental?: boolean
          p_organization_id: string
          p_since?: string
        }
        Returns: Json
      }
      legislation_check_now: { Args: never; Returns: boolean }
      legislation_publish: {
        Args: { p_change_note: string; p_text_id: string }
        Returns: number
      }
      lira_fold: { Args: { p_text: string }; Returns: string }
      normalize_person_name: { Args: { p_name: string }; Returns: string }
      organization_member_departments: {
        Args: { p_organization_id: string }
        Returns: {
          department_id: string
          department_name: string
          membership_id: string
        }[]
      }
      organization_member_names: {
        Args: { p_organization_id: string; p_user_ids: string[] }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      organization_users_list: {
        Args: { p_organization_id: string }
        Returns: {
          contact_email: string
          created_at: string
          full_name: string
          id: string
          job_title: string
          phone: string
          role: string
          screen_guides: boolean
          status: string
          user_id: string
          username: string
        }[]
      }
      patient_infection_flags: {
        Args: { p_organization_id: string }
        Returns: {
          classification: string
          isolated: boolean
          isolation_precautions: string[]
          isolation_since: string
          organism: string
          patient_id: string
          since: string
        }[]
      }
      platform_access_token_redeem: {
        Args: { p_invitation_id: string }
        Returns: boolean
      }
      platform_account_item_link: {
        Args: {
          p_item_id: string
          p_member_status: Database["public"]["Enums"]["member_status"]
          p_user_id: string
        }
        Returns: string
      }
      platform_accounts_dispatch_send: { Args: never; Returns: number }
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
      platform_employee_accounts: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      platform_end_login_sessions: {
        Args: { p_session_id?: string; p_user_id?: string }
        Returns: number
      }
      platform_extend_demo: {
        Args: { p_entitlement_id: string; p_valid_until: string }
        Returns: Json
      }
      platform_login_sessions_list: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          aal: string
          active: boolean
          email: string
          ended_at: string
          ended_reason: string
          full_name: string
          ip: string
          is_platform_owner: boolean
          last_ip: string
          last_seen_at: string
          online: boolean
          organizations: string
          session_id: string
          started_at: string
          user_agent: string
          user_id: string
          username: string
        }[]
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
      platform_release_login_lock: {
        Args: { p_lock_id: number }
        Returns: boolean
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
      protocol_suggestion_decide: {
        Args: {
          p_decision: string
          p_reason?: string
          p_revision_document_id?: string
          p_snooze_until?: string
          p_suggestion_id: string
        }
        Returns: Json
      }
      public_contact: {
        Args: never
        Returns: {
          email: string
          name: string
          phone: string
          website: string
        }[]
      }
      public_login_notice: { Args: never; Returns: Json }
      purge_recycle_bin: { Args: never; Returns: number }
      quality_fill_audit_programme: {
        Args: { p_organization_id: string }
        Returns: number
      }
      quality_plan_audit_round: {
        Args: { p_days?: number; p_organization_id: string; p_start: string }
        Returns: number
      }
      quality_schedule_next_audit: {
        Args: { p_audit_id: string }
        Returns: string
      }
      quality_self_assessment_save: {
        Args: { p_answers: Json; p_id: string; p_submit?: boolean }
        Returns: Json
      }
      quality_supplier_certificate_access: {
        Args: { p_token: string }
        Returns: Json
      }
      quality_supplier_certificate_request_action: {
        Args: {
          p_action: string
          p_comment?: string
          p_id: string
          p_resend?: boolean
        }
        Returns: Json
      }
      quality_supplier_certificate_request_item_action: {
        Args: {
          p_action: string
          p_comment?: string
          p_id: string
          p_resend?: boolean
        }
        Returns: Json
      }
      quality_supplier_certificate_requests_create: {
        Args: { p_items: Json; p_organization_id: string; p_send?: boolean }
        Returns: Json
      }
      quality_supplier_renewal_settings_set: {
        Args: {
          p_auto_enabled: boolean
          p_max_reminders?: number
          p_organization_id: string
          p_remind_after_days?: number
        }
        Returns: undefined
      }
      quality_survey_response_counts: {
        Args: { p_organization_id: string; p_since: string }
        Returns: {
          recent: number
          survey_id: string
          total: number
        }[]
      }
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
      regulation_approve: {
        Args: {
          p_approved_by_name: string
          p_change_note: string
          p_issued_on: string
          p_regulation_id: string
        }
        Returns: number
      }
      regulation_sign: {
        Args: {
          p_image: string
          p_name: string
          p_regulation_id: string
          p_role: string
          p_title: string
        }
        Returns: Json
      }
      regulation_template_publish: {
        Args: {
          p_change_note: string
          p_content: Json
          p_description: string
          p_key: string
          p_sources: string
          p_title: string
        }
        Returns: number
      }
      resolve_committee_member_user_id: {
        Args: { p_employee_id: string; p_organization_id: string }
        Returns: string
      }
      resolve_legacy_person: {
        Args: {
          p_employee_id: string
          p_label: string
          p_organization_id: string
          p_source_column: string
          p_source_table: string
        }
        Returns: number
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
      review_laboratory_sample: {
        Args: {
          p_case_id?: string
          p_note?: string
          p_organization_id: string
          p_reason?: string
          p_sample_id: string
          p_status: string
        }
        Returns: Json
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
      set_member_supplier_renewal_sender: {
        Args: {
          p_enabled: boolean
          p_organization_id: string
          p_user_id: string
        }
        Returns: Json
      }
      set_organization_branding: {
        Args: { p_branding: Json; p_organization_id: string }
        Returns: Json
      }
      set_organization_idle_lock: {
        Args: { p_minutes: number; p_organization_id: string }
        Returns: number
      }
      set_organization_lira_launcher: {
        Args: { p_enabled: boolean; p_organization_id: string }
        Returns: boolean
      }
      set_organization_screen_guides: {
        Args: { p_enabled: boolean; p_organization_id: string }
        Returns: boolean
      }
      set_translation_settings: {
        Args: {
          p_enabled: boolean
          p_monthly_char_limit: number
          p_organization_id: string
        }
        Returns: undefined
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
      submit_demo_request: {
        Args: {
          p_email: string
          p_full_name: string
          p_language?: string
          p_message?: string
          p_organization: string
          p_phone?: string
          p_privacy_accepted?: boolean
          p_role: string
          p_website?: string
        }
        Returns: Json
      }
      surveillance_case_exposure_count: {
        Args: { p_case_id: string }
        Returns: number
      }
      surveillance_case_summaries: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      survey_public: { Args: { p_token: string }; Returns: Json }
      survey_submit: {
        Args: { p_answers: Json; p_department_id: string; p_token: string }
        Returns: Json
      }
      sync_committee_member_addon: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      temp_get_deviation_library_context: {
        Args: { p_token: string }
        Returns: Json
      }
      touch_login_session: { Args: never; Returns: boolean }
      training_access_files: { Args: { p_token: string }; Returns: Json }
      training_delete_record: {
        Args: { p_organization_id: string; p_record_key: string }
        Returns: boolean
      }
      training_email_access: { Args: { p_token: string }; Returns: Json }
      training_finalize_review: {
        Args: {
          p_assignment_key: string
          p_competent?: boolean
          p_note?: string
          p_organization_id: string
          p_points?: Json
        }
        Returns: Json
      }
      training_save_assignment: {
        Args: { p_assignment: Json; p_organization_id: string }
        Returns: string
      }
      training_save_program: {
        Args: { p_organization_id: string; p_program: Json }
        Returns: string
      }
      training_save_requirement: {
        Args: { p_organization_id: string; p_requirement: Json }
        Returns: string
      }
      training_save_state: {
        Args: {
          p_assignments?: Json
          p_organization_id: string
          p_programs?: Json
        }
        Returns: Json
      }
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
      training_track_time: {
        Args: {
          p_attachment_id: string
          p_page?: number
          p_seconds: number
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
          admission_source: string | null
          case_number: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          discharge_date: string | null
          id: string
          mdr_on_admission: boolean
          mdr_on_admission_date: string | null
          mdr_on_admission_source: string | null
          notes: string | null
          organization_id: string
          patient_id: string
          source_facility: string | null
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
          controls_on_time_from: string | null
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
          lira_launcher_enabled: boolean | null
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
        | "hospital_director"
        | "division_director"
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
        "hospital_director",
        "division_director",
      ],
      member_status: ["invited", "active", "disabled"],
      organization_status: ["active", "suspended", "archived"],
      organization_type: ["group", "hospital", "clinic", "other"],
    },
  },
} as const
