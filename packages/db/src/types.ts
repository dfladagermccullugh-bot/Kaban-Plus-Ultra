/**
 * Database types — placeholder until first migration is applied locally.
 *
 * Regenerated with: `supabase gen types typescript --local > packages/db/src/types.ts`
 *
 * See docs/DATA_MODEL.md for the canonical schema.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Role = 'viewer' | 'editor' | 'admin';
export type Visibility = 'private' | 'link' | 'shared';
export type Density = 'comfortable' | 'compact';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          accent_color: string;
          density: Density;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          accent_color?: string;
          density?: Density;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      boards: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          cover_color: string | null;
          visibility: Visibility;
          share_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['boards']['Row'],
          'id' | 'created_at' | 'updated_at'
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['boards']['Insert']>;
      };
      board_collaborators: {
        Row: {
          board_id: string;
          profile_id: string;
          role: Role;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['board_collaborators']['Row'], 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['board_collaborators']['Insert']>;
      };
      rows: {
        Row: {
          id: string;
          board_id: string;
          title: string;
          color: string | null;
          position: number;
          collapsed: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['rows']['Row'],
          'id' | 'collapsed' | 'created_at'
        > & {
          id?: string;
          collapsed?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rows']['Insert']>;
      };
      columns: {
        Row: {
          id: string;
          board_id: string;
          title: string;
          color: string | null;
          position: number;
          wip_limit: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['columns']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['columns']['Insert']>;
      };
      cards: {
        Row: {
          id: string;
          board_id: string;
          row_id: string;
          column_id: string;
          title: string;
          body_md: string;
          cover_image_id: string | null;
          position: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['cards']['Row'],
          'id' | 'body_md' | 'cover_image_id' | 'created_at' | 'updated_at'
        > & {
          id?: string;
          body_md?: string;
          cover_image_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cards']['Insert']>;
      };
      labels: {
        Row: {
          id: string;
          board_id: string;
          name: string;
          color: string;
        };
        Insert: Omit<Database['public']['Tables']['labels']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['labels']['Insert']>;
      };
      card_labels: {
        Row: {
          card_id: string;
          label_id: string;
        };
        Insert: Database['public']['Tables']['card_labels']['Row'];
        Update: Partial<Database['public']['Tables']['card_labels']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      role: Role;
      visibility: Visibility;
      density: Density;
    };
  };
}
