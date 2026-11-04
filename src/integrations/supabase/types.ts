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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          group_id: string
          id: string
          metadata: Json
          subject_message_id: string | null
          subject_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          metadata?: Json
          subject_message_id?: string | null
          subject_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          metadata?: Json
          subject_message_id?: string | null
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          decided_at: string | null
          group_id: string
          invited_by: string | null
          last_read_at: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          group_id: string
          invited_by?: string | null
          last_read_at?: string | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          group_id?: string
          invited_by?: string | null
          last_read_at?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          created_at: string
          created_by: string
          group_id: string
          id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          author_id: string | null
          body: string
          created_at: string
          deleted_by: string | null
          edited_at: string | null
          group_id: string
          id: string
          kind: string
          pinned_at: string | null
          pinned_by: string | null
          quote: Json | null
          thread_root_id: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          author_id?: string | null
          body?: string
          created_at?: string
          deleted_by?: string | null
          edited_at?: string | null
          group_id: string
          id?: string
          kind?: string
          pinned_at?: string | null
          pinned_by?: string | null
          quote?: Json | null
          thread_root_id?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          author_id?: string | null
          body?: string
          created_at?: string
          deleted_by?: string | null
          edited_at?: string | null
          group_id?: string
          id?: string
          kind?: string
          pinned_at?: string | null
          pinned_by?: string | null
          quote?: Json | null
          thread_root_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_root_id_fkey"
            columns: ["thread_root_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          group_id: string
          id: string
          message_id: string
          read_at: string | null
          thread_root_id: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          message_id: string
          read_at?: string | null
          thread_root_id: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          message_id?: string
          read_at?: string | null
          thread_root_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_thread_root_id_fkey"
            columns: ["thread_root_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          last_seen_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id: string
          last_seen_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          group_id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          group_id: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          group_id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          group_id: string
          id: string
          message_id: string
          reason: string
          reporter_id: string
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          message_id: string
          reason?: string
          reporter_id: string
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          message_id?: string
          reason?: string
          reporter_id?: string
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _audit: {
        Args: {
          _action: string
          _g: string
          _meta?: Json
          _msg: string
          _subj: string
        }
        Returns: undefined
      }
      _name: { Args: { _u: string }; Returns: string }
      _sys: { Args: { _body: string; _g: string }; Returns: undefined }
      create_group: {
        Args: { _description?: string; _name: string }
        Returns: string
      }
      decide_request: {
        Args: { _approve: boolean; _g: string; _u: string }
        Returns: undefined
      }
      delete_message: { Args: { _m: string }; Returns: string }
      edit_message: { Args: { _body: string; _m: string }; Returns: undefined }
      has_any_membership: { Args: { _g: string }; Returns: boolean }
      is_active_member: { Args: { _g: string }; Returns: boolean }
      is_group_admin: { Args: { _g: string }; Returns: boolean }
      leave_group: { Args: { _g: string }; Returns: undefined }
      mark_read: { Args: { _g: string }; Returns: undefined }
      promote_member: { Args: { _g: string; _u: string }; Returns: undefined }
      remove_member: { Args: { _g: string; _u: string }; Returns: undefined }
      request_join: { Args: { _token: string }; Returns: string }
      resolve_report: {
        Args: { _action: string; _r: string }
        Returns: undefined
      }
      shares_group: { Args: { _u: string }; Returns: boolean }
      toggle_pin: { Args: { _m: string }; Returns: undefined }
      update_group: {
        Args: { _description: string; _g: string; _name: string }
        Returns: undefined
      }
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
    Enums: {},
  },
} as const
