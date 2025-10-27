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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          condition: string
          created_at: string
          crypto_name: string
          id: string
          is_active: boolean
          price: number
          symbol: string
          triggered_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          condition: string
          created_at?: string
          crypto_name: string
          id?: string
          is_active?: boolean
          price: number
          symbol: string
          triggered_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          crypto_name?: string
          id?: string
          is_active?: boolean
          price?: number
          symbol?: string
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analysis_params: {
        Row: {
          atr_multiplier_sl: number
          atr_multiplier_tp: number
          confidence_threshold: number
          created_at: string
          id: string
          max_leverage: number
          min_bullish_score: number
          preferred_signal: string
          rsi_overbought_threshold: number
          rsi_oversold_threshold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          atr_multiplier_sl?: number
          atr_multiplier_tp?: number
          confidence_threshold?: number
          created_at?: string
          id?: string
          max_leverage?: number
          min_bullish_score?: number
          preferred_signal?: string
          rsi_overbought_threshold?: number
          rsi_oversold_threshold?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          atr_multiplier_sl?: number
          atr_multiplier_tp?: number
          confidence_threshold?: number
          created_at?: string
          id?: string
          max_leverage?: number
          min_bullish_score?: number
          preferred_signal?: string
          rsi_overbought_threshold?: number
          rsi_oversold_threshold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          telegram_chat_id: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          telegram_chat_id?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          telegram_chat_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          analysis_data: Json | null
          closed_at: string | null
          created_at: string
          crypto_name: string
          duration_minutes: number | null
          entry_price: number
          exit_price: number | null
          id: string
          leverage: number
          result_amount: number | null
          result_percent: number | null
          signal: string
          status: string
          stop_loss: number
          symbol: string
          take_profit: number
          user_id: string
        }
        Insert: {
          analysis_data?: Json | null
          closed_at?: string | null
          created_at?: string
          crypto_name: string
          duration_minutes?: number | null
          entry_price: number
          exit_price?: number | null
          id?: string
          leverage: number
          result_amount?: number | null
          result_percent?: number | null
          signal: string
          status?: string
          stop_loss: number
          symbol: string
          take_profit: number
          user_id: string
        }
        Update: {
          analysis_data?: Json | null
          closed_at?: string | null
          created_at?: string
          crypto_name?: string
          duration_minutes?: number | null
          entry_price?: number
          exit_price?: number | null
          id?: string
          leverage?: number
          result_amount?: number | null
          result_percent?: number | null
          signal?: string
          status?: string
          stop_loss?: number
          symbol?: string
          take_profit?: number
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          capital: number
          created_at: string
          current_loss_today: number
          exit_strategy: string
          id: string
          last_loss_reset: string
          max_loss_per_day: number
          preferred_trade_style: string
          risk_percent_per_trade: number
          target_win_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          capital?: number
          created_at?: string
          current_loss_today?: number
          exit_strategy?: string
          id?: string
          last_loss_reset?: string
          max_loss_per_day?: number
          preferred_trade_style?: string
          risk_percent_per_trade?: number
          target_win_rate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          capital?: number
          created_at?: string
          current_loss_today?: number
          exit_strategy?: string
          id?: string
          last_loss_reset?: string
          max_loss_per_day?: number
          preferred_trade_style?: string
          risk_percent_per_trade?: number
          target_win_rate?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_daily_loss: { Args: never; Returns: undefined }
      run_learning_engine: { Args: never; Returns: undefined }
      trigger_learning_engine: { Args: never; Returns: undefined }
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
