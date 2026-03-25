export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          department: string | null;
          gender_identity: string | null;
          status: string | null;
          avatar_url: string | null;
          email_domain: string | null;
          birth_date: string | null;
          gpa: number | null;
          is_suspended: boolean;
          suspend_reason: string | null;
          suspended_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          department?: string | null;
          gender_identity?: string | null;
          status?: string | null;
          avatar_url?: string | null;
          email_domain?: string | null;
          birth_date?: string | null;
          gpa?: number | null;
          is_suspended?: boolean;
          suspend_reason?: string | null;
          suspended_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          department?: string | null;
          gender_identity?: string | null;
          status?: string | null;
          avatar_url?: string | null;
          email_domain?: string | null;
          birth_date?: string | null;
          gpa?: number | null;
          is_suspended?: boolean;
          suspend_reason?: string | null;
          suspended_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          user_1: string | null;
          user_2: string | null;
          course_id: string;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_1?: string | null;
          user_2?: string | null;
          course_id: string;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_1?: string | null;
          user_2?: string | null;
          course_id?: string;
          status?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          match_id: string | null;
          sender_id: string | null;
          content: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          match_id?: string | null;
          sender_id?: string | null;
          content: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          match_id?: string | null;
          sender_id?: string | null;
          content?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      queues: {
        Row: {
          id: string;
          user_id: string | null;
          course_id: string;
          gender_identity: string;
          email_domain: string;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          course_id: string;
          gender_identity: string;
          email_domain: string;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          course_id?: string;
          gender_identity?: string;
          email_domain?: string;
          status?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          id: string;
          match_id: string | null;
          rater_user_id: string | null;
          rated_user_id: string | null;
          grade_point: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          match_id?: string | null;
          rater_user_id?: string | null;
          rated_user_id?: string | null;
          grade_point: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          match_id?: string | null;
          rater_user_id?: string | null;
          rated_user_id?: string | null;
          grade_point?: number;
          created_at?: string | null;
        };
        Relationships: [];
      };
      university: {
        Row: {
          email_domain: string;
          name: string | null;
          is_unlocked: boolean | null;
          unlock_threshold: number | null;
          user_count: number | null;
          min_age: number | null;
          created_at: string | null;
        };
        Insert: {
          email_domain: string;
          name?: string | null;
          is_unlocked?: boolean | null;
          unlock_threshold?: number | null;
          user_count?: number | null;
          min_age?: number | null;
          created_at?: string | null;
        };
        Update: {
          email_domain?: string;
          name?: string | null;
          is_unlocked?: boolean | null;
          unlock_threshold?: number | null;
          user_count?: number | null;
          min_age?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_profile_setup: {
        Args: {
          p_display_name: string;
          p_department: string;
          p_gender_identity: string;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      enrol_course: {
        Args: {
          p_course_id: string;
          p_gender_identity: string;
          p_email_domain: string;
        };
        Returns: { match_id: string | null }[];
      };
      get_domain_min_age: {
        Args: {
          p_email_domain: string;
        };
        Returns: { is_known: boolean; min_age: number }[];
      };
      get_partner_profile: {
        Args: {
          target_profile_id: string;
        };
        Returns: {
          display_name: string | null;
          avatar_url: string | null;
          department: string | null;
        }[];
      };
      is_match_domain_consistent: {
        Args: {
          target_match_id: string;
        };
        Returns: boolean;
      };
      set_profile_idle: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      report_match: {
        Args: {
          p_match_id: string;
        };
        Returns: undefined;
      };
      submit_grade: {
        Args: {
          p_match_id: string;
          p_rated_user_id: string;
          p_grade_point: number;
        };
        Returns: undefined;
      };
      update_profile_avatar: {
        Args: {
          p_avatar_url: string;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      update_profile_basics: {
        Args: {
          p_display_name: string;
          p_department: string;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
