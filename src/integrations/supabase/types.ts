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
      crowd_reports: {
        Row: {
          counters_open: number | null
          counters_open_raw: string | null
          created_at: string
          crowd_level: string
          estimated_wait_mins: number
          id: string
          people_ahead: number | null
          people_ahead_raw: string | null
          place_id: string
          predicted_wait_mins: number | null
          prediction_accuracy: number | null
          service_type: string | null
          trust_weight: number
          user_id: string
        }
        Insert: {
          counters_open?: number | null
          counters_open_raw?: string | null
          created_at?: string
          crowd_level: string
          estimated_wait_mins?: number
          id?: string
          people_ahead?: number | null
          people_ahead_raw?: string | null
          place_id: string
          predicted_wait_mins?: number | null
          prediction_accuracy?: number | null
          service_type?: string | null
          trust_weight?: number
          user_id: string
        }
        Update: {
          counters_open?: number | null
          counters_open_raw?: string | null
          created_at?: string
          crowd_level?: string
          estimated_wait_mins?: number
          id?: string
          people_ahead?: number | null
          people_ahead_raw?: string | null
          place_id?: string
          predicted_wait_mins?: number | null
          prediction_accuracy?: number | null
          service_type?: string | null
          trust_weight?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crowd_reports_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      model_artifacts: {
        Row: {
          algorithm: string
          created_at: string
          eligible_place_ids: string[]
          feature_names: Json
          heuristic_mae: number | null
          id: string
          intercept: number
          is_active: boolean
          lambda: number
          ml_mae: number | null
          mode: string
          sample_count: number
          trained_at: string
          version: number
          weights: Json
        }
        Insert: {
          algorithm?: string
          created_at?: string
          eligible_place_ids?: string[]
          feature_names: Json
          heuristic_mae?: number | null
          id?: string
          intercept?: number
          is_active?: boolean
          lambda?: number
          ml_mae?: number | null
          mode?: string
          sample_count: number
          trained_at?: string
          version: number
          weights: Json
        }
        Update: {
          algorithm?: string
          created_at?: string
          eligible_place_ids?: string[]
          feature_names?: Json
          heuristic_mae?: number | null
          id?: string
          intercept?: number
          is_active?: boolean
          lambda?: number
          ml_mae?: number | null
          mode?: string
          sample_count?: number
          trained_at?: string
          version?: number
          weights?: Json
        }
        Relationships: []
      }
      place_hourly_stats: {
        Row: {
          avg_wait_mins: number
          day_of_week: number
          hour_of_day: number
          id: string
          place_id: string
          sample_count: number
          updated_at: string
        }
        Insert: {
          avg_wait_mins: number
          day_of_week: number
          hour_of_day: number
          id?: string
          place_id: string
          sample_count?: number
          updated_at?: string
        }
        Update: {
          avg_wait_mins?: number
          day_of_week?: number
          hour_of_day?: number
          id?: string
          place_id?: string
          sample_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_hourly_stats_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          category: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          source_id: string | null
          total_counters: number | null
        }
        Insert: {
          address?: string | null
          category?: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          source_id?: string | null
          total_counters?: number | null
        }
        Update: {
          address?: string | null
          category?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          source_id?: string | null
          total_counters?: number | null
        }
        Relationships: []
      }
      prediction_shadow_log: {
        Row: {
          created_at: string
          heuristic_wait: number
          id: string
          ml_wait: number | null
          mode: string
          model_version: number | null
          place_id: string
          served_wait: number
        }
        Insert: {
          created_at?: string
          heuristic_wait: number
          id?: string
          ml_wait?: number | null
          mode: string
          model_version?: number | null
          place_id: string
          served_wait: number
        }
        Update: {
          created_at?: string
          heuristic_wait?: number
          id?: string
          ml_wait?: number | null
          mode?: string
          model_version?: number | null
          place_id?: string
          served_wait?: number
        }
        Relationships: [
          {
            foreignKeyName: "prediction_shadow_log_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      saved_places: {
        Row: {
          created_at: string
          id: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalize_count: { Args: { raw: string }; Returns: number }
      qp_build_features: {
        Args: {
          p_at: string
          p_baseline: number
          p_counters_open: number
          p_recent_avg: number
          p_recent_count: number
          p_service_type: string
          p_total_counters: number
        }
        Returns: number[]
      }
      qp_eligible_places: { Args: { min_reports?: number }; Returns: string[] }
      qp_feature_names: { Args: never; Returns: string[] }
      qp_predict_wait: {
        Args: { p_at?: string; p_place_id: string }
        Returns: Json
      }
      qp_train_ridge: { Args: { p_lambda?: number }; Returns: Json }
      refresh_place_hourly_stats: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
