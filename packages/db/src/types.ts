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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          accent_color: string;
          density: 'comfortable' | 'compact';
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          accent_color?: string;
          density?: 'comfortable' | 'compact';
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
          row_order: string[];
          col_order: string[];
          visibility: Visibility;
          share_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['boards']['Row'],
          'id' | 'created_at' | 'updated_at' | 'row_order' | 'col_order'
        > & {
          id?: string;
          row_order?: string[];
          col_order?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['boards']['Insert']>;
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
          'id' | 'created_at' | 'updated_at'
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cards']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      role: Role;
      visibility: Visibility;
    };
  };
}
