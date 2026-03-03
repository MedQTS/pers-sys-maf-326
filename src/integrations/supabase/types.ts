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
      artifacts: {
        Row: {
          artifact_id: string
          checksum: string | null
          created_at: string | null
          job_id: string
          type: string
          uri: string
        }
        Insert: {
          artifact_id?: string
          checksum?: string | null
          created_at?: string | null
          job_id: string
          type: string
          uri: string
        }
        Update: {
          artifact_id?: string
          checksum?: string | null
          created_at?: string | null
          job_id?: string
          type?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      data_deletion_requests: {
        Row: {
          customer_email: string
          id: string
          job_id: string
          notes: string | null
          processed_at: string | null
          request_source: string
          requested_at: string
          status: string
        }
        Insert: {
          customer_email: string
          id?: string
          job_id: string
          notes?: string | null
          processed_at?: string | null
          request_source?: string
          requested_at?: string
          status?: string
        }
        Update: {
          customer_email?: string
          id?: string
          job_id?: string
          notes?: string | null
          processed_at?: string | null
          request_source?: string
          requested_at?: string
          status?: string
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          actor: string
          created_at: string | null
          event_payload: Json
          event_type: string | null
          id: number
          job_id: string | null
          ms: number | null
          outcome: string | null
          stage: string
          user_id: string | null
        }
        Insert: {
          actor?: string
          created_at?: string | null
          event_payload?: Json
          event_type?: string | null
          id?: number
          job_id?: string | null
          ms?: number | null
          outcome?: string | null
          stage?: string
          user_id?: string | null
        }
        Update: {
          actor?: string
          created_at?: string | null
          event_payload?: Json
          event_type?: string | null
          id?: number
          job_id?: string | null
          ms?: number | null
          outcome?: string | null
          stage?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          invoice_id: string
          job_id: string
          status: string | null
          updated_at: string | null
          xero_draft_id: string | null
        }
        Insert: {
          created_at?: string | null
          invoice_id?: string
          job_id: string
          status?: string | null
          updated_at?: string | null
          xero_draft_id?: string | null
        }
        Update: {
          created_at?: string | null
          invoice_id?: string
          job_id?: string
          status?: string | null
          updated_at?: string | null
          xero_draft_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_artifacts: {
        Row: {
          artifact_id: string
          artifact_type: string
          blob_path: string
          created_at: string | null
          job_id: string
          size_bytes: number | null
          uploaded_at: string | null
        }
        Insert: {
          artifact_id?: string
          artifact_type: string
          blob_path: string
          created_at?: string | null
          job_id: string
          size_bytes?: number | null
          uploaded_at?: string | null
        }
        Update: {
          artifact_id?: string
          artifact_type?: string
          blob_path?: string
          created_at?: string | null
          job_id?: string
          size_bytes?: number | null
          uploaded_at?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          artifact_type_primary: string | null
          created_at: string | null
          doctor_id: string
          firm_id: string
          job_id: string
          sla: string
          status: string | null
          updated_at: string | null
          uploaded_at: string | null
          user_id: string | null
        }
        Insert: {
          artifact_type_primary?: string | null
          created_at?: string | null
          doctor_id: string
          firm_id: string
          job_id?: string
          sla: string
          status?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Update: {
          artifact_type_primary?: string | null
          created_at?: string | null
          doctor_id?: string
          firm_id?: string
          job_id?: string
          sla?: string
          status?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      opt_in_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      pers_sys_bets: {
        Row: {
          created_at: string
          game_id: string
          id: string
          leg_type: string
          line_at_bet: number | null
          notes: string | null
          placed_ts: string
          price: number
          profit_units: number | null
          result: string | null
          side: string
          system_code: string
          units: number
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          leg_type: string
          line_at_bet?: number | null
          notes?: string | null
          placed_ts: string
          price: number
          profit_units?: number | null
          result?: string | null
          side: string
          system_code: string
          units: number
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          leg_type?: string
          line_at_bet?: number | null
          notes?: string | null
          placed_ts?: string
          price?: number
          profit_units?: number | null
          result?: string | null
          side?: string
          system_code?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_bets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pers_sys_bets_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: false
            referencedRelation: "pers_sys_systems"
            referencedColumns: ["system_code"]
          },
        ]
      }
      pers_sys_games: {
        Row: {
          away_score: number | null
          away_team_id: string
          created_at: string
          game_key: string
          home_score: number | null
          home_team_id: string
          id: string
          is_draw: boolean
          loser_team_id: string | null
          margin_home: number | null
          oddsapi_event_id: string | null
          round: number | null
          season: number
          squiggle_game_id: string | null
          start_time_aet: string
          status: string
          updated_at: string
          venue: string | null
          winner_team_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          created_at?: string
          game_key: string
          home_score?: number | null
          home_team_id: string
          id?: string
          is_draw?: boolean
          loser_team_id?: string | null
          margin_home?: number | null
          oddsapi_event_id?: string | null
          round?: number | null
          season: number
          squiggle_game_id?: string | null
          start_time_aet: string
          status?: string
          updated_at?: string
          venue?: string | null
          winner_team_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          created_at?: string
          game_key?: string
          home_score?: number | null
          home_team_id?: string
          id?: string
          is_draw?: boolean
          loser_team_id?: string | null
          margin_home?: number | null
          oddsapi_event_id?: string | null
          round?: number | null
          season?: number
          squiggle_game_id?: string | null
          start_time_aet?: string
          status?: string
          updated_at?: string
          venue?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pers_sys_games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pers_sys_games_loser_team_id_fkey"
            columns: ["loser_team_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pers_sys_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pers_sys_market_snapshots: {
        Row: {
          agg_method: string
          away_line: number | null
          away_line_price: number | null
          away_price: number | null
          books_used: Json
          created_at: string
          game_id: string
          home_line: number | null
          home_line_price: number | null
          home_price: number | null
          id: string
          market_type: string
          snapshot_ts: string
          snapshot_type: string
        }
        Insert: {
          agg_method?: string
          away_line?: number | null
          away_line_price?: number | null
          away_price?: number | null
          books_used?: Json
          created_at?: string
          game_id: string
          home_line?: number | null
          home_line_price?: number | null
          home_price?: number | null
          id?: string
          market_type: string
          snapshot_ts: string
          snapshot_type: string
        }
        Update: {
          agg_method?: string
          away_line?: number | null
          away_line_price?: number | null
          away_price?: number | null
          books_used?: Json
          created_at?: string
          game_id?: string
          home_line?: number | null
          home_line_price?: number | null
          home_price?: number | null
          id?: string
          market_type?: string
          snapshot_ts?: string
          snapshot_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_market_snapshots_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_games"
            referencedColumns: ["id"]
          },
        ]
      }
      pers_sys_round_context: {
        Row: {
          asof_ts: string
          id: string
          percentage_8th: number
          points_8th: number
          round: number
          season: number
          updated_at: string
        }
        Insert: {
          asof_ts: string
          id?: string
          percentage_8th: number
          points_8th: number
          round: number
          season: number
          updated_at?: string
        }
        Update: {
          asof_ts?: string
          id?: string
          percentage_8th?: number
          points_8th?: number
          round?: number
          season?: number
          updated_at?: string
        }
        Relationships: []
      }
      pers_sys_season_meta: {
        Row: {
          created_at: string
          gf_winner_team_id: string
          season: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gf_winner_team_id: string
          season: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gf_winner_team_id?: string
          season?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_season_meta_gf_winner_team_id_fkey"
            columns: ["gf_winner_team_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pers_sys_signals: {
        Row: {
          created_at: string
          game_id: string
          id: string
          pass: boolean
          reason: Json
          snapshot_type: string
          system_code: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          pass: boolean
          reason?: Json
          snapshot_type: string
          system_code: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          pass?: boolean
          reason?: Json
          snapshot_type?: string
          system_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_signals_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pers_sys_signals_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: false
            referencedRelation: "pers_sys_systems"
            referencedColumns: ["system_code"]
          },
        ]
      }
      pers_sys_systems: {
        Row: {
          active: boolean
          created_at: string
          locked: boolean
          name: string
          params: Json
          staking_policy: string
          system_code: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          locked?: boolean
          name: string
          params?: Json
          staking_policy: string
          system_code: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          locked?: boolean
          name?: string
          params?: Json
          staking_policy?: string
          system_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      pers_sys_team_state: {
        Row: {
          asof_ts: string
          draws: number
          game_id: string
          id: string
          losses: number
          percentage: number
          played: number
          points_against: number
          points_for: number
          round: number | null
          season: number
          streak: number
          team_id: string
          updated_at: string
          wins: number
        }
        Insert: {
          asof_ts: string
          draws: number
          game_id: string
          id?: string
          losses: number
          percentage: number
          played: number
          points_against: number
          points_for: number
          round?: number | null
          season: number
          streak: number
          team_id: string
          updated_at?: string
          wins: number
        }
        Update: {
          asof_ts?: string
          draws?: number
          game_id?: string
          id?: string
          losses?: number
          percentage?: number
          played?: number
          points_against?: number
          points_for?: number
          round?: number | null
          season?: number
          streak?: number
          team_id?: string
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_team_state_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pers_sys_team_state_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pers_sys_teams: {
        Row: {
          active: boolean
          canonical_name: string
          created_at: string
          id: string
          oddsapi_name: string | null
          squiggle_name: string | null
          squiggle_team_id: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          canonical_name: string
          created_at?: string
          id?: string
          oddsapi_name?: string | null
          squiggle_name?: string | null
          squiggle_team_id?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          canonical_name?: string
          created_at?: string
          id?: string
          oddsapi_name?: string | null
          squiggle_name?: string | null
          squiggle_team_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      processing_queue: {
        Row: {
          enqueued_at: string
          id: string
          job_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          enqueued_at?: string
          id?: string
          job_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          enqueued_at?: string
          id?: string
          job_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      prod_prices_currency: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          product_code: string
          stripe_price_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency: string
          product_code: string
          stripe_price_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          product_code?: string
          stripe_price_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sidehustler_prod_prices_currency_product_fk"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["product_code"]
          },
        ]
      }
      product_catalog: {
        Row: {
          active: boolean
          created_at: string
          product_code: string
          stripe_price_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          product_code: string
          stripe_price_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          product_code?: string
          stripe_price_id?: string
        }
        Relationships: []
      }
      product_opt_ins: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          customer_email: string | null
          id: number
          job_id: string | null
          product_code: string
          status: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          customer_email?: string | null
          id?: number
          job_id?: string | null
          product_code: string
          status?: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          id?: number
          job_id?: string | null
          product_code?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          processed_at: string | null
          purchase_id: number | null
          refund_amount_cents: number | null
          refund_currency: string | null
          source: string
          status: string
          stripe_refund_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          processed_at?: string | null
          purchase_id?: number | null
          refund_amount_cents?: number | null
          refund_currency?: string | null
          source?: string
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          processed_at?: string | null
          purchase_id?: number | null
          refund_amount_cents?: number | null
          refund_currency?: string | null
          source?: string
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      report_outputs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          report_json: Json
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          report_json: Json
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          report_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "report_outputs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      sidehustler_credit_notes: {
        Row: {
          amount_cents: number
          created_at: string
          credit_note_number: string
          currency: string
          customer_email: string
          id: string
          invoice_id: string
          issued_at: string
          pdf_bucket: string
          pdf_path: string | null
          reason: string | null
          refund_request_id: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credit_note_number: string
          currency: string
          customer_email: string
          id?: string
          invoice_id: string
          issued_at?: string
          pdf_bucket?: string
          pdf_path?: string | null
          reason?: string | null
          refund_request_id?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credit_note_number?: string
          currency?: string
          customer_email?: string
          id?: string
          invoice_id?: string
          issued_at?: string
          pdf_bucket?: string
          pdf_path?: string | null
          reason?: string | null
          refund_request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sidehustler_credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sidehustler_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sidehustler_credit_notes_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sidehustler_doc_counters: {
        Row: {
          doc_type: string
          last_seq: number
          updated_at: string
          year: number
        }
        Insert: {
          doc_type: string
          last_seq?: number
          updated_at?: string
          year: number
        }
        Update: {
          doc_type?: string
          last_seq?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      sidehustler_event_logs: {
        Row: {
          client_network_hint: string | null
          client_platform: string | null
          client_user_agent: string | null
          created_at: string
          email: string | null
          error_code: string | null
          error_message: string | null
          event_name: string
          extra: Json
          http_status: number | null
          id: string
          job_id: string | null
          stage: string | null
          stripe_session_id: string | null
          success: boolean | null
          trace_id: string | null
          user_id: string | null
        }
        Insert: {
          client_network_hint?: string | null
          client_platform?: string | null
          client_user_agent?: string | null
          created_at?: string
          email?: string | null
          error_code?: string | null
          error_message?: string | null
          event_name: string
          extra?: Json
          http_status?: number | null
          id?: string
          job_id?: string | null
          stage?: string | null
          stripe_session_id?: string | null
          success?: boolean | null
          trace_id?: string | null
          user_id?: string | null
        }
        Update: {
          client_network_hint?: string | null
          client_platform?: string | null
          client_user_agent?: string | null
          created_at?: string
          email?: string | null
          error_code?: string | null
          error_message?: string | null
          event_name?: string
          extra?: Json
          http_status?: number | null
          id?: string
          job_id?: string | null
          stage?: string | null
          stripe_session_id?: string | null
          success?: boolean | null
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sidehustler_invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          customer_email: string
          gst_registered: boolean
          id: string
          invoice_number: string
          issued_at: string
          non_gst_statement: string
          pdf_bucket: string
          pdf_path: string | null
          purchase_id: number
          purchased_product_code: string | null
          status: string
          supplier_abn: string
          supplier_address: string
          supplier_legal_name: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          customer_email: string
          gst_registered?: boolean
          id?: string
          invoice_number: string
          issued_at?: string
          non_gst_statement?: string
          pdf_bucket?: string
          pdf_path?: string | null
          purchase_id: number
          purchased_product_code?: string | null
          status?: string
          supplier_abn: string
          supplier_address: string
          supplier_legal_name: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string
          gst_registered?: boolean
          id?: string
          invoice_number?: string
          issued_at?: string
          non_gst_statement?: string
          pdf_bucket?: string
          pdf_path?: string | null
          purchase_id?: number
          purchased_product_code?: string | null
          status?: string
          supplier_abn?: string
          supplier_address?: string
          supplier_legal_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sidehustler_invoices_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      sidehustler_job_entitlements: {
        Row: {
          created_at: string
          effective_tier: number
          entitlement_status: string
          id: string
          job_id: string
          refine_allowance: number
          refines_used: number
          source_product_code: string | null
          source_purchase_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          effective_tier?: number
          entitlement_status?: string
          id?: string
          job_id: string
          refine_allowance?: number
          refines_used?: number
          source_product_code?: string | null
          source_purchase_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          effective_tier?: number
          entitlement_status?: string
          id?: string
          job_id?: string
          refine_allowance?: number
          refines_used?: number
          source_product_code?: string | null
          source_purchase_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sidehustler_jobs: {
        Row: {
          age: number | null
          avoid_domains: string | null
          avoid_people: string | null
          background: string | null
          best_environment: string | null
          boredom_tolerance: string | null
          country: string | null
          created_at: string | null
          demotivators: string | null
          desired_tone: string | null
          draining_environment: string | null
          dream_job: string | null
          email: string
          energy_peak: string | null
          flow_tasks: string | null
          focus_duration: string | null
          id: string
          interests: string | null
          interruption_tolerance: number | null
          job_completed_at: string | null
          job_started_at: string | null
          lose_time_tasks: string | null
          management_tolerance: number | null
          monthly_income_target: string | null
          motivators: string | null
          name: string | null
          negotiation_tolerance: number | null
          orientation_1: string | null
          orientation_2: string | null
          orientation_3: string | null
          physical_constraints: string | null
          postcode: string | null
          process_style: string | null
          reality_checker_included: boolean | null
          reality_checker_purchased: boolean | null
          reality_checker_runs: number | null
          reality_checker_slots: number | null
          refine_allowance: number | null
          refinement_allowance: number
          refinement_notes: string | null
          refinement_used: number
          refines_used: number | null
          report_content: string | null
          report_ready_email_sent_at: string | null
          report_url: string | null
          risk_tolerance: string | null
          skills: string | null
          social_tolerance: number | null
          status: string | null
          stress_reaction: string | null
          stress_triggers: string | null
          task_preference: string | null
          tier: number | null
          time_available: string | null
          updated_at: string | null
          uploads: Json
          wants_full_business: boolean | null
          work_intent: string | null
          work_poison: string | null
        }
        Insert: {
          age?: number | null
          avoid_domains?: string | null
          avoid_people?: string | null
          background?: string | null
          best_environment?: string | null
          boredom_tolerance?: string | null
          country?: string | null
          created_at?: string | null
          demotivators?: string | null
          desired_tone?: string | null
          draining_environment?: string | null
          dream_job?: string | null
          email: string
          energy_peak?: string | null
          flow_tasks?: string | null
          focus_duration?: string | null
          id?: string
          interests?: string | null
          interruption_tolerance?: number | null
          job_completed_at?: string | null
          job_started_at?: string | null
          lose_time_tasks?: string | null
          management_tolerance?: number | null
          monthly_income_target?: string | null
          motivators?: string | null
          name?: string | null
          negotiation_tolerance?: number | null
          orientation_1?: string | null
          orientation_2?: string | null
          orientation_3?: string | null
          physical_constraints?: string | null
          postcode?: string | null
          process_style?: string | null
          reality_checker_included?: boolean | null
          reality_checker_purchased?: boolean | null
          reality_checker_runs?: number | null
          reality_checker_slots?: number | null
          refine_allowance?: number | null
          refinement_allowance?: number
          refinement_notes?: string | null
          refinement_used?: number
          refines_used?: number | null
          report_content?: string | null
          report_ready_email_sent_at?: string | null
          report_url?: string | null
          risk_tolerance?: string | null
          skills?: string | null
          social_tolerance?: number | null
          status?: string | null
          stress_reaction?: string | null
          stress_triggers?: string | null
          task_preference?: string | null
          tier?: number | null
          time_available?: string | null
          updated_at?: string | null
          uploads?: Json
          wants_full_business?: boolean | null
          work_intent?: string | null
          work_poison?: string | null
        }
        Update: {
          age?: number | null
          avoid_domains?: string | null
          avoid_people?: string | null
          background?: string | null
          best_environment?: string | null
          boredom_tolerance?: string | null
          country?: string | null
          created_at?: string | null
          demotivators?: string | null
          desired_tone?: string | null
          draining_environment?: string | null
          dream_job?: string | null
          email?: string
          energy_peak?: string | null
          flow_tasks?: string | null
          focus_duration?: string | null
          id?: string
          interests?: string | null
          interruption_tolerance?: number | null
          job_completed_at?: string | null
          job_started_at?: string | null
          lose_time_tasks?: string | null
          management_tolerance?: number | null
          monthly_income_target?: string | null
          motivators?: string | null
          name?: string | null
          negotiation_tolerance?: number | null
          orientation_1?: string | null
          orientation_2?: string | null
          orientation_3?: string | null
          physical_constraints?: string | null
          postcode?: string | null
          process_style?: string | null
          reality_checker_included?: boolean | null
          reality_checker_purchased?: boolean | null
          reality_checker_runs?: number | null
          reality_checker_slots?: number | null
          refine_allowance?: number | null
          refinement_allowance?: number
          refinement_notes?: string | null
          refinement_used?: number
          refines_used?: number | null
          report_content?: string | null
          report_ready_email_sent_at?: string | null
          report_url?: string | null
          risk_tolerance?: string | null
          skills?: string | null
          social_tolerance?: number | null
          status?: string | null
          stress_reaction?: string | null
          stress_triggers?: string | null
          task_preference?: string | null
          tier?: number | null
          time_available?: string | null
          updated_at?: string | null
          uploads?: Json
          wants_full_business?: boolean | null
          work_intent?: string | null
          work_poison?: string | null
        }
        Relationships: []
      }
      sidehustler_report_versions: {
        Row: {
          created_at: string
          id: string
          job_id: string
          refinement_notes: string | null
          report_content: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          refinement_notes?: string | null
          report_content: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          refinement_notes?: string | null
          report_content?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sidehustler_report_versions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "sidehustler_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          id: number
          payload: Json | null
          processed_at: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          id?: number
          payload?: Json | null
          processed_at?: string | null
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          id?: number
          payload?: Json | null
          processed_at?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_sidehustler_doc_number: {
        Args: { p_doc_type: string; p_year: number }
        Returns: string
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
