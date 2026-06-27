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
      audit_events: {
        Row: {
          actor: string | null
          created_at: string
          detail: string | null
          id: string
          pallet_id: string
          type: Database["public"]["Enums"]["audit_type"]
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          pallet_id: string
          type: Database["public"]["Enums"]["audit_type"]
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          pallet_id?: string
          type?: Database["public"]["Enums"]["audit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "pallets"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          klantnummer: string
          naam: string
          plaats: string
        }
        Insert: {
          created_at?: string
          id?: string
          klantnummer: string
          naam: string
          plaats: string
        }
        Update: {
          created_at?: string
          id?: string
          klantnummer?: string
          naam?: string
          plaats?: string
        }
        Relationships: []
      }
      pallet_photos: {
        Row: {
          created_at: string
          id: string
          pallet_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          pallet_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          pallet_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "pallet_photos_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "pallets"
            referencedColumns: ["id"]
          },
        ]
      }
      pallet_types: {
        Row: {
          created_at: string
          id: string
          naam: string
        }
        Insert: {
          created_at?: string
          id?: string
          naam: string
        }
        Update: {
          created_at?: string
          id?: string
          naam?: string
        }
        Relationships: []
      }
      pallets: {
        Row: {
          created_at: string
          id: string
          inhoud: string | null
          ontvangen_at: string | null
          pallet_type_id: string | null
          palletnummer: string
          positie: number
          product_id: string | null
          qr_payload: string | null
          retour_id: string
          soort: Database["public"]["Enums"]["pallet_soort"]
          status: Database["public"]["Enums"]["pallet_status"]
          totaal: number
        }
        Insert: {
          created_at?: string
          id?: string
          inhoud?: string | null
          ontvangen_at?: string | null
          pallet_type_id?: string | null
          palletnummer: string
          positie?: number
          product_id?: string | null
          qr_payload?: string | null
          retour_id: string
          soort?: Database["public"]["Enums"]["pallet_soort"]
          status?: Database["public"]["Enums"]["pallet_status"]
          totaal?: number
        }
        Update: {
          created_at?: string
          id?: string
          inhoud?: string | null
          ontvangen_at?: string | null
          pallet_type_id?: string | null
          palletnummer?: string
          positie?: number
          product_id?: string | null
          qr_payload?: string | null
          retour_id?: string
          soort?: Database["public"]["Enums"]["pallet_soort"]
          status?: Database["public"]["Enums"]["pallet_status"]
          totaal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pallets_pallet_type_id_fkey"
            columns: ["pallet_type_id"]
            isOneToOne: false
            referencedRelation: "pallet_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallets_retour_id_fkey"
            columns: ["retour_id"]
            isOneToOne: false
            referencedRelation: "retours"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          categorie: string
          created_at: string
          id: string
          leeggoedwaarde_per_bak: number
          naam: string
        }
        Insert: {
          categorie: string
          created_at?: string
          id?: string
          leeggoedwaarde_per_bak?: number
          naam: string
        }
        Update: {
          categorie?: string
          created_at?: string
          id?: string
          leeggoedwaarde_per_bak?: number
          naam?: string
        }
        Relationships: []
      }
      retours: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          retournummer: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          retournummer: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          retournummer?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "retours_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      audit_type:
        | "aangemaakt"
        | "ontvangen"
        | "foto_toegevoegd"
        | "product_gewijzigd"
        | "pallettype_gewijzigd"
      pallet_soort: "vol" | "mixed"
      pallet_status: "aangemaakt" | "klaar_voor_retour" | "ontvangen"
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
      audit_type: [
        "aangemaakt",
        "ontvangen",
        "foto_toegevoegd",
        "product_gewijzigd",
        "pallettype_gewijzigd",
      ],
      pallet_soort: ["vol", "mixed"],
      pallet_status: ["aangemaakt", "klaar_voor_retour", "ontvangen"],
    },
  },
} as const
