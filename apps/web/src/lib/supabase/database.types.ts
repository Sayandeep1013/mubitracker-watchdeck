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
      analytics_events: {
        Row: {
          created_at: string
          event: string
          id: string
          platform: string
          properties: Json
          request_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          platform: string
          properties?: Json
          request_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          platform?: string
          properties?: Json
          request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_buckets: {
        Row: {
          created_at: string
          filter_hash: string
          id: string
          items: Json
          partial: boolean
          reason: string | null
          served_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_hash: string
          id?: string
          items: Json
          partial?: boolean
          reason?: string | null
          served_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_hash?: string
          id?: string
          items?: Json
          partial?: boolean
          reason?: string | null
          served_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_buckets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_build_locks: {
        Row: {
          acquired_at: string
          filter_hash: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          filter_hash: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          filter_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_build_locks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_impressions: {
        Row: {
          media_id: string
          shown_at: string
          user_id: string
        }
        Insert: {
          media_id: string
          shown_at?: string
          user_id: string
        }
        Update: {
          media_id?: string
          shown_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_impressions_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_sessions: {
        Row: {
          created_at: string
          filter_config: Json
          id: string
          shown_media_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_config?: Json
          id?: string
          shown_media_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_config?: Json
          id?: string
          shown_media_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_presets: {
        Row: {
          created_at: string
          filter_config: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_config?: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_config?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filter_presets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          receiver_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          receiver_id: string
          requester_id: string
          status: string
          updated_at?: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          receiver_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          adult: boolean
          backdrop_path: string | null
          classification: Database["public"]["Enums"]["media_classification"]
          created_at: string
          format: Database["public"]["Enums"]["media_format"]
          id: string
          original_language: string
          original_title: string
          overview: string
          popularity: number
          poster_path: string | null
          release_date: string | null
          runtime: number | null
          title: string
          updated_at: string
          vote_count: number
          year: number | null
        }
        Insert: {
          adult?: boolean
          backdrop_path?: string | null
          classification?: Database["public"]["Enums"]["media_classification"]
          created_at?: string
          format: Database["public"]["Enums"]["media_format"]
          id?: string
          original_language?: string
          original_title?: string
          overview?: string
          popularity?: number
          poster_path?: string | null
          release_date?: string | null
          runtime?: number | null
          title: string
          updated_at?: string
          vote_count?: number
          year?: number | null
        }
        Update: {
          adult?: boolean
          backdrop_path?: string | null
          classification?: Database["public"]["Enums"]["media_classification"]
          created_at?: string
          format?: Database["public"]["Enums"]["media_format"]
          id?: string
          original_language?: string
          original_title?: string
          overview?: string
          popularity?: number
          poster_path?: string | null
          release_date?: string | null
          runtime?: number | null
          title?: string
          updated_at?: string
          vote_count?: number
          year?: number | null
        }
        Relationships: []
      }
      media_external_ids: {
        Row: {
          external_id: string
          id: string
          media_id: string
          provider: string
        }
        Insert: {
          external_id: string
          id?: string
          media_id: string
          provider: string
        }
        Update: {
          external_id?: string
          id?: string
          media_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_external_ids_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media_genres: {
        Row: {
          genre_id: number
          media_id: string
        }
        Insert: {
          genre_id: number
          media_id: string
        }
        Update: {
          genre_id?: number
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_genres_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media_rejected: {
        Row: {
          external_id: string
          provider: string
          reason: string
          rejected_at: string
        }
        Insert: {
          external_id: string
          provider: string
          reason: string
          rejected_at?: string
        }
        Update: {
          external_id?: string
          provider?: string
          reason?: string
          rejected_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          friendship_id: string | null
          id: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          friendship_id?: string | null
          id?: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          friendship_id?: string | null
          id?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_friendship_id_fkey"
            columns: ["friendship_id"]
            isOneToOne: false
            referencedRelation: "friendships"
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
          collection_visibility: Database["public"]["Enums"]["privacy_level"]
          created_at: string
          id: string
          profile_visibility: Database["public"]["Enums"]["privacy_level"]
          reviews_visibility: Database["public"]["Enums"]["privacy_level"]
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          collection_visibility?: Database["public"]["Enums"]["privacy_level"]
          created_at?: string
          id: string
          profile_visibility?: Database["public"]["Enums"]["privacy_level"]
          reviews_visibility?: Database["public"]["Enums"]["privacy_level"]
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          collection_visibility?: Database["public"]["Enums"]["privacy_level"]
          created_at?: string
          id?: string
          profile_visibility?: Database["public"]["Enums"]["privacy_level"]
          reviews_visibility?: Database["public"]["Enums"]["privacy_level"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string
          id: string
          media_id: string
          message: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          message?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          is_spoiler: boolean
          media_id: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["privacy_level"]
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_spoiler?: boolean
          media_id: string
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["privacy_level"]
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_spoiler?: boolean
          media_id?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["privacy_level"]
        }
        Relationships: [
          {
            foreignKeyName: "reviews_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media: {
        Row: {
          created_at: string
          hidden_until: string | null
          id: string
          media_id: string
          reject_count: number
          review_status: string
          status: string
          updated_at: string
          user_id: string
          watched_at: string | null
        }
        Insert: {
          created_at?: string
          hidden_until?: string | null
          id?: string
          media_id: string
          reject_count?: number
          review_status?: string
          status: string
          updated_at?: string
          user_id: string
          watched_at?: string | null
        }
        Update: {
          created_at?: string
          hidden_until?: string | null
          id?: string
          media_id?: string
          reject_count?: number
          review_status?: string
          status?: string
          updated_at?: string
          user_id?: string
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_taste: {
        Row: {
          computed_at: string
          decision_count: number
          user_id: string
          vector: Json
        }
        Insert: {
          computed_at?: string
          decision_count: number
          user_id: string
          vector: Json
        }
        Update: {
          computed_at?: string
          decision_count?: number
          user_id?: string
          vector?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_taste_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analytics_classification_latency_percentiles: {
        Args: { p_since?: string }
        Returns: {
          p50_ms: number
          p90_ms: number
          platform: string
          samples: number
        }[]
      }
      compute_user_taste: { Args: { p_user_id: string }; Returns: Json }
      get_eligible_media: {
        Args: {
          p_classifications?: string[]
          p_formats?: string[]
          p_genre_ids?: number[]
          p_languages?: string[]
          p_limit?: number
          p_user_id: string
          p_year_from?: number
          p_year_to?: number
        }
        Returns: {
          backdrop_path: string
          classification: string
          format: string
          genre_ids: number[]
          id: string
          original_language: string
          original_title: string
          overview: string
          popularity: number
          poster_path: string
          runtime: number
          title: string
          year: number
        }[]
      }
    }
    Enums: {
      media_classification:
        | "live_action"
        | "anime"
        | "documentary"
        | "animation"
      media_format: "movie" | "series"
      privacy_level: "public" | "friends" | "private"
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
      media_classification: [
        "live_action",
        "anime",
        "documentary",
        "animation",
      ],
      media_format: ["movie", "series"],
      privacy_level: ["public", "friends", "private"],
    },
  },
} as const
