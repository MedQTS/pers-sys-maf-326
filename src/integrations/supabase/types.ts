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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      pers_sys_bets: {
        Row: {
          bankroll_snapshot: number | null
          book: string | null
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
          stake_amount: number
          status: string
          system_code: string
          units: number
        }
        Insert: {
          bankroll_snapshot?: number | null
          book?: string | null
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
          stake_amount?: number
          status?: string
          system_code: string
          units: number
        }
        Update: {
          bankroll_snapshot?: number | null
          book?: string | null
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
          stake_amount?: number
          status?: string
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
            referencedRelation: "pers_sys_systems_v2"
            referencedColumns: ["system_code"]
          },
        ]
      }
      pers_sys_email_alert_items: {
        Row: {
          bet_fingerprint: string
          book: string | null
          change_hash: string
          created_at: string
          game_id: string
          id: string
          leg_type: string
          line_at_bet: number | null
          price: number | null
          side: string
          snapshot_type: string
          stake_amount: number | null
          status_label: string
          system_code: string
        }
        Insert: {
          bet_fingerprint: string
          book?: string | null
          change_hash: string
          created_at?: string
          game_id: string
          id?: string
          leg_type: string
          line_at_bet?: number | null
          price?: number | null
          side: string
          snapshot_type: string
          stake_amount?: number | null
          status_label?: string
          system_code: string
        }
        Update: {
          bet_fingerprint?: string
          book?: string | null
          change_hash?: string
          created_at?: string
          game_id?: string
          id?: string
          leg_type?: string
          line_at_bet?: number | null
          price?: number | null
          side?: string
          snapshot_type?: string
          stake_amount?: number | null
          status_label?: string
          system_code?: string
        }
        Relationships: []
      }
      pers_sys_email_alert_runs: {
        Row: {
          alert_hash: string
          created_at: string
          game_id: string
          id: string
          snapshot_type: string
        }
        Insert: {
          alert_hash: string
          created_at?: string
          game_id: string
          id?: string
          snapshot_type: string
        }
        Update: {
          alert_hash?: string
          created_at?: string
          game_id?: string
          id?: string
          snapshot_type?: string
        }
        Relationships: []
      }
      pers_sys_execution_failures: {
        Row: {
          caused_by_run_id: string | null
          created_at: string
          expected_action_at: string | null
          failure_type: string
          game_id: string
          id: string
          leg_type: string | null
          line_at_bet: number | null
          market_snapshot_type: string | null
          note_short: string | null
          resolved: boolean
          resolved_at: string | null
          side: string | null
          system_code: string | null
        }
        Insert: {
          caused_by_run_id?: string | null
          created_at?: string
          expected_action_at?: string | null
          failure_type: string
          game_id: string
          id?: string
          leg_type?: string | null
          line_at_bet?: number | null
          market_snapshot_type?: string | null
          note_short?: string | null
          resolved?: boolean
          resolved_at?: string | null
          side?: string | null
          system_code?: string | null
        }
        Update: {
          caused_by_run_id?: string | null
          created_at?: string
          expected_action_at?: string | null
          failure_type?: string
          game_id?: string
          id?: string
          leg_type?: string | null
          line_at_bet?: number | null
          market_snapshot_type?: string | null
          note_short?: string | null
          resolved?: boolean
          resolved_at?: string | null
          side?: string | null
          system_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_execution_failures_caused_by_run_id_fkey"
            columns: ["caused_by_run_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_watcher_runs"
            referencedColumns: ["id"]
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
      pers_sys_ledger: {
        Row: {
          amount: number
          created_at: string
          event_type: string
          id: string
          note: string | null
          ref_id: string | null
          season_id: number
        }
        Insert: {
          amount: number
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
          ref_id?: string | null
          season_id: number
        }
        Update: {
          amount?: number
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          ref_id?: string | null
          season_id?: number
        }
        Relationships: []
      }
      pers_sys_market_snapshots: {
        Row: {
          agg_method: string
          away_line: number | null
          away_line_price: number | null
          away_price: number | null
          books_used: Json
          created_at: string
          exec_best_away_book: string | null
          exec_best_away_line: number | null
          exec_best_away_line_book: string | null
          exec_best_away_line_price: number | null
          exec_best_away_price: number | null
          exec_best_home_book: string | null
          exec_best_home_line: number | null
          exec_best_home_line_book: string | null
          exec_best_home_line_price: number | null
          exec_best_home_price: number | null
          exec_best_over_book: string | null
          exec_best_over_price: number | null
          exec_best_total_line: number | null
          exec_best_under_book: string | null
          exec_best_under_price: number | null
          exec_books_observed: Json
          game_id: string
          home_line: number | null
          home_line_price: number | null
          home_price: number | null
          id: string
          market_type: string
          over_price: number | null
          ref_books_observed: Json
          snapshot_ts: string
          snapshot_type: string
          total_line: number | null
          under_price: number | null
        }
        Insert: {
          agg_method?: string
          away_line?: number | null
          away_line_price?: number | null
          away_price?: number | null
          books_used?: Json
          created_at?: string
          exec_best_away_book?: string | null
          exec_best_away_line?: number | null
          exec_best_away_line_book?: string | null
          exec_best_away_line_price?: number | null
          exec_best_away_price?: number | null
          exec_best_home_book?: string | null
          exec_best_home_line?: number | null
          exec_best_home_line_book?: string | null
          exec_best_home_line_price?: number | null
          exec_best_home_price?: number | null
          exec_best_over_book?: string | null
          exec_best_over_price?: number | null
          exec_best_total_line?: number | null
          exec_best_under_book?: string | null
          exec_best_under_price?: number | null
          exec_books_observed?: Json
          game_id: string
          home_line?: number | null
          home_line_price?: number | null
          home_price?: number | null
          id?: string
          market_type: string
          over_price?: number | null
          ref_books_observed?: Json
          snapshot_ts: string
          snapshot_type: string
          total_line?: number | null
          under_price?: number | null
        }
        Update: {
          agg_method?: string
          away_line?: number | null
          away_line_price?: number | null
          away_price?: number | null
          books_used?: Json
          created_at?: string
          exec_best_away_book?: string | null
          exec_best_away_line?: number | null
          exec_best_away_line_book?: string | null
          exec_best_away_line_price?: number | null
          exec_best_away_price?: number | null
          exec_best_home_book?: string | null
          exec_best_home_line?: number | null
          exec_best_home_line_book?: string | null
          exec_best_home_line_price?: number | null
          exec_best_home_price?: number | null
          exec_best_over_book?: string | null
          exec_best_over_price?: number | null
          exec_best_total_line?: number | null
          exec_best_under_book?: string | null
          exec_best_under_price?: number | null
          exec_books_observed?: Json
          game_id?: string
          home_line?: number | null
          home_line_price?: number | null
          home_price?: number | null
          id?: string
          market_type?: string
          over_price?: number | null
          ref_books_observed?: Json
          snapshot_ts?: string
          snapshot_type?: string
          total_line?: number | null
          under_price?: number | null
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
      pers_sys_season_config: {
        Row: {
          computed_at: string
          season: number
          source: string
          total_rounds: number
          updated_at: string
        }
        Insert: {
          computed_at?: string
          season: number
          source?: string
          total_rounds: number
          updated_at?: string
        }
        Update: {
          computed_at?: string
          season?: number
          source?: string
          total_rounds?: number
          updated_at?: string
        }
        Relationships: []
      }
      pers_sys_season_meta: {
        Row: {
          created_at: string
          gf_runner_up_team_id: string | null
          gf_winner_team_id: string
          season: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gf_runner_up_team_id?: string | null
          gf_winner_team_id: string
          season: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gf_runner_up_team_id?: string | null
          gf_winner_team_id?: string
          season?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_season_meta_gf_runner_up_team_id_fkey"
            columns: ["gf_runner_up_team_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pers_sys_season_meta_gf_winner_team_id_fkey"
            columns: ["gf_winner_team_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pers_sys_signal_audit_v2: {
        Row: {
          audit_key: string
          audit_status: Database["public"]["Enums"]["sys_signal_status"]
          created_at: string
          evaluated_at: string
          exec_best_book: string | null
          exec_best_price: number | null
          execution_market: Database["public"]["Enums"]["sys_market"]
          execution_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          fail_code: string | null
          fail_stage: Database["public"]["Enums"]["sys_fail_stage"] | null
          game_id: string
          id: string
          leg_type: Database["public"]["Enums"]["sys_leg_type"] | null
          line_at_bet: number | null
          model_market: Database["public"]["Enums"]["sys_market"]
          model_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          reason_json: Json
          recommended_bankroll_pct: number | null
          recommended_units: number | null
          ref_price: number | null
          round: number | null
          season: number
          side: Database["public"]["Enums"]["sys_side"] | null
          staking_contract_version: string
          system_code: string
          updated_at: string
        }
        Insert: {
          audit_key: string
          audit_status: Database["public"]["Enums"]["sys_signal_status"]
          created_at?: string
          evaluated_at?: string
          exec_best_book?: string | null
          exec_best_price?: number | null
          execution_market: Database["public"]["Enums"]["sys_market"]
          execution_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          fail_code?: string | null
          fail_stage?: Database["public"]["Enums"]["sys_fail_stage"] | null
          game_id: string
          id?: string
          leg_type?: Database["public"]["Enums"]["sys_leg_type"] | null
          line_at_bet?: number | null
          model_market: Database["public"]["Enums"]["sys_market"]
          model_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          reason_json?: Json
          recommended_bankroll_pct?: number | null
          recommended_units?: number | null
          ref_price?: number | null
          round?: number | null
          season: number
          side?: Database["public"]["Enums"]["sys_side"] | null
          staking_contract_version?: string
          system_code: string
          updated_at?: string
        }
        Update: {
          audit_key?: string
          audit_status?: Database["public"]["Enums"]["sys_signal_status"]
          created_at?: string
          evaluated_at?: string
          exec_best_book?: string | null
          exec_best_price?: number | null
          execution_market?: Database["public"]["Enums"]["sys_market"]
          execution_snapshot?: Database["public"]["Enums"]["sys_snapshot"]
          fail_code?: string | null
          fail_stage?: Database["public"]["Enums"]["sys_fail_stage"] | null
          game_id?: string
          id?: string
          leg_type?: Database["public"]["Enums"]["sys_leg_type"] | null
          line_at_bet?: number | null
          model_market?: Database["public"]["Enums"]["sys_market"]
          model_snapshot?: Database["public"]["Enums"]["sys_snapshot"]
          reason_json?: Json
          recommended_bankroll_pct?: number | null
          recommended_units?: number | null
          ref_price?: number | null
          round?: number | null
          season?: number
          side?: Database["public"]["Enums"]["sys_side"] | null
          staking_contract_version?: string
          system_code?: string
          updated_at?: string
        }
        Relationships: []
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
      pers_sys_signals_v2: {
        Row: {
          created_at: string
          evaluated_at: string
          exec_best_book: string | null
          exec_best_price: number | null
          execution_market: Database["public"]["Enums"]["sys_market"]
          execution_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          game_id: string
          id: string
          leg_type: Database["public"]["Enums"]["sys_leg_type"]
          line_at_bet: number | null
          model_market: Database["public"]["Enums"]["sys_market"]
          model_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          parent_signal_id: string | null
          pass: boolean
          reason_json: Json
          recommended_bankroll_pct: number | null
          recommended_units: number | null
          ref_price: number | null
          side: Database["public"]["Enums"]["sys_side"]
          signal_status: Database["public"]["Enums"]["sys_signal_status"]
          staking_contract_version: string
          system_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evaluated_at?: string
          exec_best_book?: string | null
          exec_best_price?: number | null
          execution_market: Database["public"]["Enums"]["sys_market"]
          execution_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          game_id: string
          id?: string
          leg_type: Database["public"]["Enums"]["sys_leg_type"]
          line_at_bet?: number | null
          model_market: Database["public"]["Enums"]["sys_market"]
          model_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          parent_signal_id?: string | null
          pass?: boolean
          reason_json?: Json
          recommended_bankroll_pct?: number | null
          recommended_units?: number | null
          ref_price?: number | null
          side: Database["public"]["Enums"]["sys_side"]
          signal_status?: Database["public"]["Enums"]["sys_signal_status"]
          staking_contract_version?: string
          system_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evaluated_at?: string
          exec_best_book?: string | null
          exec_best_price?: number | null
          execution_market?: Database["public"]["Enums"]["sys_market"]
          execution_snapshot?: Database["public"]["Enums"]["sys_snapshot"]
          game_id?: string
          id?: string
          leg_type?: Database["public"]["Enums"]["sys_leg_type"]
          line_at_bet?: number | null
          model_market?: Database["public"]["Enums"]["sys_market"]
          model_snapshot?: Database["public"]["Enums"]["sys_snapshot"]
          parent_signal_id?: string | null
          pass?: boolean
          reason_json?: Json
          recommended_bankroll_pct?: number | null
          recommended_units?: number | null
          ref_price?: number | null
          side?: Database["public"]["Enums"]["sys_side"]
          signal_status?: Database["public"]["Enums"]["sys_signal_status"]
          staking_contract_version?: string
          system_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_signals_v2_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pers_sys_signals_v2_parent_signal_id_fkey"
            columns: ["parent_signal_id"]
            isOneToOne: false
            referencedRelation: "pers_sys_signals_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pers_sys_signals_v2_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: false
            referencedRelation: "pers_sys_systems_v2"
            referencedColumns: ["system_code"]
          },
        ]
      }
      pers_sys_system_priority: {
        Row: {
          allow_stack: boolean
          collision_rank: number | null
          created_at: string
          dominates_match: boolean
          id: string
          max_exposure_pct: number | null
          rank: number
          system_code: string
          tie_break: Json
          updated_at: string
        }
        Insert: {
          allow_stack?: boolean
          collision_rank?: number | null
          created_at?: string
          dominates_match?: boolean
          id?: string
          max_exposure_pct?: number | null
          rank: number
          system_code: string
          tie_break?: Json
          updated_at?: string
        }
        Update: {
          allow_stack?: boolean
          collision_rank?: number | null
          created_at?: string
          dominates_match?: boolean
          id?: string
          max_exposure_pct?: number | null
          rank?: number
          system_code?: string
          tie_break?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pers_sys_system_priority_system_code_fk"
            columns: ["system_code"]
            isOneToOne: true
            referencedRelation: "pers_sys_systems_v2"
            referencedColumns: ["system_code"]
          },
          {
            foreignKeyName: "pers_sys_system_priority_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: true
            referencedRelation: "pers_sys_systems_v2"
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
      pers_sys_systems_v2: {
        Row: {
          active: boolean | null
          allow_candidate: boolean | null
          amplifier_config: Json | null
          close_odds_max: number | null
          close_odds_min: number | null
          clv_min: number | null
          clv_required: boolean | null
          created_at: string | null
          date_end_mmdd: string | null
          date_start_mmdd: string | null
          dead_team_points_behind_8th_min: number | null
          dog_close_odds_max: number | null
          dog_close_odds_min: number | null
          draw_counts_as_loss: boolean | null
          evaluation_version: number | null
          exclude_gf_replay: boolean | null
          exclude_seasons: number[] | null
          exclude_states: string[] | null
          execution_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          fav_close_odds_max: number | null
          fav_close_odds_min: number | null
          fav_streak_min: number | null
          gf_winner_must_be_favourite_open: boolean | null
          gf_winner_required: boolean | null
          interstate_required: boolean | null
          line_clv_positive_required: boolean | null
          line_clv_required: boolean | null
          loss_streak_required: boolean | null
          model_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          open_odds_max: number | null
          open_odds_min: number | null
          opponent_must_be_top8: boolean | null
          opponent_wins_max: number | null
          overlay_config: Json | null
          overlay_market: Database["public"]["Enums"]["sys_market"] | null
          primary_market: Database["public"]["Enums"]["sys_market"]
          require_away_dog: boolean | null
          require_close_line_gt_zero: boolean | null
          require_home_dog: boolean | null
          require_home_favourite: boolean | null
          round_max: number | null
          round_min: number | null
          rounds_remaining_max: number | null
          rounds_remaining_min: number | null
          season_progress_round_min: number | null
          staking_config: Json | null
          system_code: string
          system_group: string | null
          system_name: string
          system_priority: number | null
          updated_at: string | null
          venue_states_allowed: string[] | null
        }
        Insert: {
          active?: boolean | null
          allow_candidate?: boolean | null
          amplifier_config?: Json | null
          close_odds_max?: number | null
          close_odds_min?: number | null
          clv_min?: number | null
          clv_required?: boolean | null
          created_at?: string | null
          date_end_mmdd?: string | null
          date_start_mmdd?: string | null
          dead_team_points_behind_8th_min?: number | null
          dog_close_odds_max?: number | null
          dog_close_odds_min?: number | null
          draw_counts_as_loss?: boolean | null
          evaluation_version?: number | null
          exclude_gf_replay?: boolean | null
          exclude_seasons?: number[] | null
          exclude_states?: string[] | null
          execution_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          fav_close_odds_max?: number | null
          fav_close_odds_min?: number | null
          fav_streak_min?: number | null
          gf_winner_must_be_favourite_open?: boolean | null
          gf_winner_required?: boolean | null
          interstate_required?: boolean | null
          line_clv_positive_required?: boolean | null
          line_clv_required?: boolean | null
          loss_streak_required?: boolean | null
          model_snapshot: Database["public"]["Enums"]["sys_snapshot"]
          open_odds_max?: number | null
          open_odds_min?: number | null
          opponent_must_be_top8?: boolean | null
          opponent_wins_max?: number | null
          overlay_config?: Json | null
          overlay_market?: Database["public"]["Enums"]["sys_market"] | null
          primary_market: Database["public"]["Enums"]["sys_market"]
          require_away_dog?: boolean | null
          require_close_line_gt_zero?: boolean | null
          require_home_dog?: boolean | null
          require_home_favourite?: boolean | null
          round_max?: number | null
          round_min?: number | null
          rounds_remaining_max?: number | null
          rounds_remaining_min?: number | null
          season_progress_round_min?: number | null
          staking_config?: Json | null
          system_code: string
          system_group?: string | null
          system_name: string
          system_priority?: number | null
          updated_at?: string | null
          venue_states_allowed?: string[] | null
        }
        Update: {
          active?: boolean | null
          allow_candidate?: boolean | null
          amplifier_config?: Json | null
          close_odds_max?: number | null
          close_odds_min?: number | null
          clv_min?: number | null
          clv_required?: boolean | null
          created_at?: string | null
          date_end_mmdd?: string | null
          date_start_mmdd?: string | null
          dead_team_points_behind_8th_min?: number | null
          dog_close_odds_max?: number | null
          dog_close_odds_min?: number | null
          draw_counts_as_loss?: boolean | null
          evaluation_version?: number | null
          exclude_gf_replay?: boolean | null
          exclude_seasons?: number[] | null
          exclude_states?: string[] | null
          execution_snapshot?: Database["public"]["Enums"]["sys_snapshot"]
          fav_close_odds_max?: number | null
          fav_close_odds_min?: number | null
          fav_streak_min?: number | null
          gf_winner_must_be_favourite_open?: boolean | null
          gf_winner_required?: boolean | null
          interstate_required?: boolean | null
          line_clv_positive_required?: boolean | null
          line_clv_required?: boolean | null
          loss_streak_required?: boolean | null
          model_snapshot?: Database["public"]["Enums"]["sys_snapshot"]
          open_odds_max?: number | null
          open_odds_min?: number | null
          opponent_must_be_top8?: boolean | null
          opponent_wins_max?: number | null
          overlay_config?: Json | null
          overlay_market?: Database["public"]["Enums"]["sys_market"] | null
          primary_market?: Database["public"]["Enums"]["sys_market"]
          require_away_dog?: boolean | null
          require_close_line_gt_zero?: boolean | null
          require_home_dog?: boolean | null
          require_home_favourite?: boolean | null
          round_max?: number | null
          round_min?: number | null
          rounds_remaining_max?: number | null
          rounds_remaining_min?: number | null
          season_progress_round_min?: number | null
          staking_config?: Json | null
          system_code?: string
          system_group?: string | null
          system_name?: string
          system_priority?: number | null
          updated_at?: string | null
          venue_states_allowed?: string[] | null
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
          home_state: string | null
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
          home_state?: string | null
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
          home_state?: string | null
          id?: string
          oddsapi_name?: string | null
          squiggle_name?: string | null
          squiggle_team_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pers_sys_venue_state: {
        Row: {
          state: string
          venue_key: string
          venue_name: string
        }
        Insert: {
          state: string
          venue_key: string
          venue_name: string
        }
        Update: {
          state?: string
          venue_key?: string
          venue_name?: string
        }
        Relationships: []
      }
      pers_sys_watcher_runs: {
        Row: {
          created_at: string
          dedupe_key: string
          finished_at: string | null
          game_id: string | null
          id: string
          note: string | null
          run_status: string
          started_at: string
          trigger_source: string
          watch_type: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          finished_at?: string | null
          game_id?: string | null
          id?: string
          note?: string | null
          run_status?: string
          started_at?: string
          trigger_source?: string
          watch_type: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          finished_at?: string | null
          game_id?: string | null
          id?: string
          note?: string | null
          run_status?: string
          started_at?: string
          trigger_source?: string
          watch_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      pers_sys_bankroll_summary: {
        Row: {
          available_balance: number | null
          open_exposure: number | null
          season_id: number | null
          total_equity: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _round_to_5: { Args: { p_value: number }; Returns: number }
      _round_to_quarter: { Args: { p_value: number }; Returns: number }
      accept_leg_create_bet:
        | {
            Args: {
              p_exec_best_book: string
              p_exec_best_price: number
              p_game_id: string
              p_leg_type: string
              p_line_at_bet: number
              p_ref_price: number
              p_side: string
              p_snapshot_type: string
              p_system_code: string
              p_units: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_exec_best_book: string
              p_exec_best_price: number
              p_game_id: string
              p_leg_type: string
              p_line_at_bet: number
              p_recommended_bankroll_pct?: number
              p_ref_price: number
              p_side: string
              p_snapshot_type: string
              p_system_code: string
              p_units: number
            }
            Returns: Json
          }
      pers_sys_normalize_venue: { Args: { v: string }; Returns: string }
      preview_leg_stake:
        | {
            Args: {
              p_exec_best_book?: string
              p_exec_best_price?: number
              p_game_id: string
              p_leg_type: string
              p_line_at_bet?: number
              p_ref_price?: number
              p_side: string
              p_snapshot_type?: string
              p_system_code: string
              p_units?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_exec_best_book?: string
              p_exec_best_price?: number
              p_game_id: string
              p_leg_type: string
              p_line_at_bet?: number
              p_recommended_bankroll_pct?: number
              p_ref_price?: number
              p_side: string
              p_snapshot_type?: string
              p_system_code: string
              p_units?: number
            }
            Returns: Json
          }
    }
    Enums: {
      sys_fail_stage: "GATE" | "DATA" | "MODEL" | "EXEC" | "OVERLAY" | "SYSTEM"
      sys_leg_type: "H2H" | "LINE" | "TOTALS"
      sys_market: "H2H" | "LINE" | "TOTALS"
      sys_side: "HOME" | "AWAY" | "OVER" | "UNDER"
      sys_signal_status: "READY" | "PENDING"
      sys_snapshot: "OPEN" | "T30" | "T10"
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
      sys_fail_stage: ["GATE", "DATA", "MODEL", "EXEC", "OVERLAY", "SYSTEM"],
      sys_leg_type: ["H2H", "LINE", "TOTALS"],
      sys_market: ["H2H", "LINE", "TOTALS"],
      sys_side: ["HOME", "AWAY", "OVER", "UNDER"],
      sys_signal_status: ["READY", "PENDING"],
      sys_snapshot: ["OPEN", "T30", "T10"],
    },
  },
} as const
