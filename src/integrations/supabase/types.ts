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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          metadata: Json | null
          new_status: string | null
          old_status: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          code: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          created_by: string | null
          delivered_at: string | null
          do_number: string
          driver_name: string | null
          id: string
          notes: string | null
          planned_delivery_date: string | null
          planned_ship_date: string | null
          prepared_at: string | null
          received_by: string | null
          sales_order_id: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
          vehicle_number: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          do_number: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          planned_delivery_date?: string | null
          planned_ship_date?: string | null
          prepared_at?: string | null
          received_by?: string | null
          sales_order_id: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          vehicle_number?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          do_number?: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          planned_delivery_date?: string | null
          planned_ship_date?: string | null
          prepared_at?: string | null
          received_by?: string | null
          sales_order_id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_id: string
          id: string
          qc_inspection_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_id: string
          id?: string
          qc_inspection_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_id?: string
          id?: string
          qc_inspection_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_qc_inspection_id_fkey"
            columns: ["qc_inspection_id"]
            isOneToOne: false
            referencedRelation: "qc_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      engineering_job_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          engineering_job_id: string
          field_changed: string
          from_value: string | null
          id: string
          to_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          engineering_job_id: string
          field_changed: string
          from_value?: string | null
          id?: string
          to_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          engineering_job_id?: string
          field_changed?: string
          from_value?: string | null
          id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engineering_job_history_engineering_job_id_fkey"
            columns: ["engineering_job_id"]
            isOneToOne: false
            referencedRelation: "engineering_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      engineering_jobs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          created_at: string
          created_by: string | null
          drawing_url: string | null
          id: string
          job_number: string
          notes: string | null
          progress_percent: number
          sales_order_item_id: string
          status: Database["public"]["Enums"]["engineering_status"]
          target_completion_date: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          drawing_url?: string | null
          id?: string
          job_number: string
          notes?: string | null
          progress_percent?: number
          sales_order_item_id: string
          status?: Database["public"]["Enums"]["engineering_status"]
          target_completion_date?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          drawing_url?: string | null
          id?: string
          job_number?: string
          notes?: string | null
          progress_percent?: number
          sales_order_item_id?: string
          status?: Database["public"]["Enums"]["engineering_status"]
          target_completion_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineering_jobs_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: true
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      material_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          engineering_job_id: string
          from_status: Database["public"]["Enums"]["material_status"] | null
          id: string
          material_status_id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["material_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          engineering_job_id: string
          from_status?: Database["public"]["Enums"]["material_status"] | null
          id?: string
          material_status_id: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["material_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          engineering_job_id?: string
          from_status?: Database["public"]["Enums"]["material_status"] | null
          id?: string
          material_status_id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["material_status"]
        }
        Relationships: [
          {
            foreignKeyName: "material_status_history_engineering_job_id_fkey"
            columns: ["engineering_job_id"]
            isOneToOne: false
            referencedRelation: "engineering_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_status_history_material_status_id_fkey"
            columns: ["material_status_id"]
            isOneToOne: false
            referencedRelation: "material_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      material_statuses: {
        Row: {
          created_at: string
          engineering_job_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["material_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          engineering_job_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["material_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          engineering_job_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["material_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_statuses_engineering_job_id_fkey"
            columns: ["engineering_job_id"]
            isOneToOne: true
            referencedRelation: "engineering_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link_path: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link_path?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link_path?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      production_batch_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          operator_id: string | null
          paused_at: string | null
          process: Database["public"]["Enums"]["production_process"]
          production_batch_id: string
          qty_completed: number
          sequence_order: number
          started_at: string | null
          status: Database["public"]["Enums"]["production_step_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          paused_at?: string | null
          process: Database["public"]["Enums"]["production_process"]
          production_batch_id: string
          qty_completed?: number
          sequence_order: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["production_step_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          paused_at?: string | null
          process?: Database["public"]["Enums"]["production_process"]
          production_batch_id?: string
          qty_completed?: number
          sequence_order?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["production_step_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_steps_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          batch_number: string
          created_at: string
          created_by: string | null
          engineering_job_id: string
          estimated_delivery_date: string | null
          id: string
          notes: string | null
          planned_completion_date: string | null
          planned_start_date: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          created_by?: string | null
          engineering_job_id: string
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          planned_completion_date?: string | null
          planned_start_date?: string | null
          quantity: number
          updated_at?: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          created_by?: string | null
          engineering_job_id?: string
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          planned_completion_date?: string | null
          planned_start_date?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_engineering_job_id_fkey"
            columns: ["engineering_job_id"]
            isOneToOne: false
            referencedRelation: "engineering_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_inspections: {
        Row: {
          created_at: string
          created_by: string | null
          defect_notes: string | null
          id: string
          inspected_at: string | null
          inspector_id: string | null
          photo_urls: string[]
          production_batch_id: string
          qty_ok: number
          qty_reject: number
          qty_total: number
          status: Database["public"]["Enums"]["qc_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          defect_notes?: string | null
          id?: string
          inspected_at?: string | null
          inspector_id?: string | null
          photo_urls?: string[]
          production_batch_id: string
          qty_ok?: number
          qty_reject?: number
          qty_total?: number
          status?: Database["public"]["Enums"]["qc_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          defect_notes?: string | null
          id?: string
          inspected_at?: string | null
          inspector_id?: string | null
          photo_urls?: string[]
          production_batch_id?: string
          qty_ok?: number
          qty_reject?: number
          qty_total?: number
          status?: Database["public"]["Enums"]["qc_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_inspections_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          sales_order_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          sales_order_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          sales_order_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_assignments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          created_by: string | null
          drawing_number: string | null
          id: string
          item_name: string
          material_spec: string | null
          quantity: number
          sales_order_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          drawing_number?: string | null
          id?: string
          item_name: string
          material_spec?: string | null
          quantity: number
          sales_order_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          drawing_number?: string | null
          id?: string
          item_name?: string
          material_spec?: string | null
          quantity?: number
          sales_order_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["sales_order_status"] | null
          id: string
          sales_order_id: string
          to_status: Database["public"]["Enums"]["sales_order_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["sales_order_status"] | null
          id?: string
          sales_order_id: string
          to_status: Database["public"]["Enums"]["sales_order_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["sales_order_status"] | null
          id?: string
          sales_order_id?: string
          to_status?: Database["public"]["Enums"]["sales_order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_status_history_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          so_number: string
          status: Database["public"]["Enums"]["sales_order_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          so_number: string
          status?: Database["public"]["Enums"]["sales_order_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          so_number?: string
          status?: Database["public"]["Enums"]["sales_order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_dashboard_material_waiting: {
        Row: {
          count: number | null
        }
        Relationships: []
      }
      v_dashboard_production_running: {
        Row: {
          count: number | null
        }
        Relationships: []
      }
      v_dashboard_so_status: {
        Row: {
          count: number | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_first_admin: { Args: never; Returns: boolean }
      generate_do_number: { Args: never; Returns: string }
      generate_job_number: { Args: never; Returns: string }
      generate_so_number: { Args: never; Returns: string }
      get_actor_emails: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      get_engineer_emails: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      get_engineering_workload: {
        Args: never
        Returns: {
          approved_count: number
          assigned_to: string
          assignee_email: string
          avg_progress: number
          draft_count: number
          in_progress_count: number
          overdue_count: number
          review_count: number
          total_jobs: number
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "sales"
        | "engineering"
        | "material"
        | "production_planning"
        | "production"
        | "qc"
        | "delivery"
        | "viewer"
      delivery_status: "draft" | "prepared" | "shipped" | "delivered"
      engineering_status: "draft" | "in_progress" | "review" | "approved"
      material_status:
        | "waiting_material"
        | "partial_material"
        | "material_ready"
      notification_type: "so_status_changed"
      production_process:
        | "laser_cutting"
        | "bending"
        | "welding_grinding"
        | "powder_coating"
        | "assembly"
      production_step_status:
        | "waiting"
        | "running"
        | "paused"
        | "completed"
        | "skipped"
      qc_status: "waiting" | "inspection" | "pass" | "reject" | "rework"
      sales_order_status:
        | "draft"
        | "confirmed"
        | "engineering"
        | "production"
        | "quality_control"
        | "delivery"
        | "completed"
        | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
        "admin",
        "sales",
        "engineering",
        "material",
        "production_planning",
        "production",
        "qc",
        "delivery",
        "viewer",
      ],
      delivery_status: ["draft", "prepared", "shipped", "delivered"],
      engineering_status: ["draft", "in_progress", "review", "approved"],
      material_status: [
        "waiting_material",
        "partial_material",
        "material_ready",
      ],
      notification_type: ["so_status_changed"],
      production_process: [
        "laser_cutting",
        "bending",
        "welding_grinding",
        "powder_coating",
        "assembly",
      ],
      production_step_status: [
        "waiting",
        "running",
        "paused",
        "completed",
        "skipped",
      ],
      qc_status: ["waiting", "inspection", "pass", "reject", "rework"],
      sales_order_status: [
        "draft",
        "confirmed",
        "engineering",
        "production",
        "quality_control",
        "delivery",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
