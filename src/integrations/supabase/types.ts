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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          page: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          page?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      circle_meetup_requests: {
        Row: {
          created_at: string
          id: string
          post_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_meetup_requests_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "circle_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_memberships: {
        Row: {
          circle_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_memberships_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_posts: {
        Row: {
          author_id: string
          circle_id: string
          created_at: string
          date_time: string | null
          id: string
          location: string | null
          max_people: number | null
          post_type: string
          text: string
          updated_at: string
        }
        Insert: {
          author_id: string
          circle_id: string
          created_at?: string
          date_time?: string | null
          id?: string
          location?: string | null
          max_people?: number | null
          post_type?: string
          text: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          circle_id?: string
          created_at?: string
          date_time?: string | null
          id?: string
          location?: string | null
          max_people?: number | null
          post_type?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_posts_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          city: string | null
          cover_image: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          cover_image?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          accepted: boolean | null
          created_at: string
          declined_at: string | null
          id: string
          participant1_id: string
          participant2_id: string
          updated_at: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string
          declined_at?: string | null
          id?: string
          participant1_id: string
          participant2_id: string
          updated_at?: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string
          declined_at?: string | null
          id?: string
          participant1_id?: string
          participant2_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      experience_join_requests: {
        Row: {
          created_at: string
          experience_id: string
          id: string
          message: string | null
          status: string
          traveller_id: string
        }
        Insert: {
          created_at?: string
          experience_id: string
          id?: string
          message?: string | null
          status?: string
          traveller_id: string
        }
        Update: {
          created_at?: string
          experience_id?: string
          id?: string
          message?: string | null
          status?: string
          traveller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_join_requests_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          city: string | null
          created_at: string
          description: string | null
          duration: string | null
          host_id: string
          id: string
          itinerary: string[] | null
          language: string | null
          max_people: number | null
          meeting_point: string | null
          price: string | null
          safety_guidelines: string | null
          schedule: string | null
          tags: string[] | null
          title: string
          updated_at: string
          what_to_bring: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          host_id: string
          id?: string
          itinerary?: string[] | null
          language?: string | null
          max_people?: number | null
          meeting_point?: string | null
          price?: string | null
          safety_guidelines?: string | null
          schedule?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          what_to_bring?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          host_id?: string
          id?: string
          itinerary?: string[] | null
          language?: string | null
          max_people?: number | null
          meeting_point?: string | null
          price?: string | null
          safety_guidelines?: string | null
          schedule?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          what_to_bring?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      itinerary_items: {
        Row: {
          category: string | null
          created_at: string
          day_date: string
          description: string | null
          id: string
          location: string | null
          order_index: number | null
          time: string | null
          title: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          day_date: string
          description?: string | null
          id?: string
          location?: string | null
          order_index?: number | null
          time?: string | null
          title: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          day_date?: string
          description?: string | null
          id?: string
          location?: string | null
          order_index?: number | null
          time?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          action: string
          created_at: string
          id: string
          target_user_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          target_user_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          target_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mutual_matches: {
        Row: {
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      post_bookmarks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          image_urls: string[] | null
          location_tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          location_tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          location_tag?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_photos: {
        Row: {
          created_at: string
          display_order: number
          id: string
          photo_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          photo_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          photo_url?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_prompts: {
        Row: {
          answer: string
          created_at: string
          display_order: number
          id: string
          question: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          display_order?: number
          id?: string
          question: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          display_order?: number
          id?: string
          question?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_of_birth: string | null
          destination: string | null
          display_name: string | null
          email: string
          id: string
          interests: string[] | null
          is_local: boolean | null
          is_restricted: boolean
          is_verified: boolean | null
          languages: string[] | null
          location: string | null
          max_age_preference: number | null
          min_age_preference: number | null
          restriction_reason: string | null
          subscription_tier: Database["public"]["Enums"]["user_subscription_tier"]
          theme: Database["public"]["Enums"]["user_theme"]
          travel_end_date: string | null
          travel_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          destination?: string | null
          display_name?: string | null
          email: string
          id?: string
          interests?: string[] | null
          is_local?: boolean | null
          is_restricted?: boolean
          is_verified?: boolean | null
          languages?: string[] | null
          location?: string | null
          max_age_preference?: number | null
          min_age_preference?: number | null
          restriction_reason?: string | null
          subscription_tier?: Database["public"]["Enums"]["user_subscription_tier"]
          theme?: Database["public"]["Enums"]["user_theme"]
          travel_end_date?: string | null
          travel_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          destination?: string | null
          display_name?: string | null
          email?: string
          id?: string
          interests?: string[] | null
          is_local?: boolean | null
          is_restricted?: boolean
          is_verified?: boolean | null
          languages?: string[] | null
          location?: string | null
          max_age_preference?: number | null
          min_age_preference?: number | null
          restriction_reason?: string | null
          subscription_tier?: Database["public"]["Enums"]["user_subscription_tier"]
          theme?: Database["public"]["Enums"]["user_theme"]
          travel_end_date?: string | null
          travel_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_count: number
          action_type: string
          created_at: string
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          action_count?: number
          action_type: string
          created_at?: string
          id?: string
          user_id: string
          window_start?: string
        }
        Update: {
          action_count?: number
          action_type?: string
          created_at?: string
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      store_images: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          store_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          store_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_images_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          ordering_tip: string | null
          price: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          ordering_tip?: string | null
          price?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          ordering_tip?: string | null
          price?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_visits: {
        Row: {
          id: string
          page_viewed: string | null
          store_id: string
          visited_at: string
          visitor_country: string | null
          visitor_user_id: string | null
        }
        Insert: {
          id?: string
          page_viewed?: string | null
          store_id: string
          visited_at?: string
          visitor_country?: string | null
          visitor_user_id?: string | null
        }
        Update: {
          id?: string
          page_viewed?: string | null
          store_id?: string
          visited_at?: string
          visitor_country?: string | null
          visitor_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          country: string | null
          created_at: string
          description: string | null
          dietary_options: string[] | null
          id: string
          latitude: number | null
          longitude: number | null
          phone: string | null
          store_name: string
          store_type: Database["public"]["Enums"]["store_type"]
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          dietary_options?: string[] | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          store_name: string
          store_type?: Database["public"]["Enums"]["store_type"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          dietary_options?: string[] | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          store_name?: string
          store_type?: Database["public"]["Enums"]["store_type"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          country: string
          created_at: string
          end_date: string | null
          id: string
          interests: string[] | null
          name: string
          notes: string | null
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country: string
          created_at?: string
          end_date?: string | null
          id?: string
          interests?: string[] | null
          name: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          end_date?: string | null
          id?: string
          interests?: string[] | null
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          _action_type: string
          _max_requests: number
          _user_id: string
          _window_minutes: number
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
      app_role: "user" | "merchant" | "admin"
      store_type: "attractions" | "food" | "entertainment"
      subscription_tier: "tier_0" | "tier_1" | "tier_2"
      user_subscription_tier: "tier_0" | "tier_1" | "tier_2"
      user_theme: "minimalist" | "cutesy" | "anime"
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
      app_role: ["user", "merchant", "admin"],
      store_type: ["attractions", "food", "entertainment"],
      subscription_tier: ["tier_0", "tier_1", "tier_2"],
      user_subscription_tier: ["tier_0", "tier_1", "tier_2"],
      user_theme: ["minimalist", "cutesy", "anime"],
    },
  },
} as const
