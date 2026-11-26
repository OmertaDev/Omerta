// Generated from exact repository DDL by source-catalog.mjs; no default-state synthesis.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const SOURCE_CATALOG = freeze({
  "formatVersion": 1,
  "source": {
    "path": "schema.sql",
    "sha256": "a5254f7d73310b465778a8353b5f6559ad7074eb30676d1f7aa6a278fb16cd7b"
  },
  "characters": {
    "name": "characters",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "sqlType": "TEXT",
        "nullable": false,
        "declaration": "id TEXT PRIMARY KEY"
      },
      {
        "name": "account_id",
        "sqlType": "TEXT",
        "nullable": false,
        "declaration": "account_id TEXT NOT NULL"
      },
      {
        "name": "name",
        "sqlType": "TEXT",
        "nullable": false,
        "declaration": "name TEXT NOT NULL"
      },
      {
        "name": "generation",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "generation INT NOT NULL DEFAULT 1"
      },
      {
        "name": "alive",
        "sqlType": "BOOLEAN",
        "nullable": false,
        "declaration": "alive BOOLEAN NOT NULL DEFAULT true"
      },
      {
        "name": "respect",
        "sqlType": "BIGINT",
        "nullable": false,
        "declaration": "respect BIGINT NOT NULL DEFAULT 0"
      },
      {
        "name": "energy",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "energy NUMERIC NOT NULL DEFAULT 50"
      },
      {
        "name": "nerve",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "nerve NUMERIC NOT NULL DEFAULT 10"
      },
      {
        "name": "health",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "health NUMERIC NOT NULL DEFAULT 100"
      },
      {
        "name": "cash",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "cash NUMERIC NOT NULL DEFAULT 500"
      },
      {
        "name": "bank",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "bank NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "muscle",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "muscle INT NOT NULL DEFAULT 5"
      },
      {
        "name": "cunning",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "cunning INT NOT NULL DEFAULT 5"
      },
      {
        "name": "speed",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "speed INT NOT NULL DEFAULT 5"
      },
      {
        "name": "jail_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "jail_until TIMESTAMPTZ"
      },
      {
        "name": "hosp_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "hosp_until TIMESTAMPTZ"
      },
      {
        "name": "loc",
        "sqlType": "TEXT",
        "nullable": false,
        "declaration": "loc TEXT NOT NULL DEFAULT 'docks'"
      },
      {
        "name": "path",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "path TEXT"
      },
      {
        "name": "title",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "title TEXT"
      },
      {
        "name": "streak",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "streak INT NOT NULL DEFAULT 0"
      },
      {
        "name": "checkin_day",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "checkin_day INT NOT NULL DEFAULT 0"
      },
      {
        "name": "lc_crime",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "lc_crime INT NOT NULL DEFAULT 0"
      },
      {
        "name": "ammo",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "ammo INT NOT NULL DEFAULT 25"
      },
      {
        "name": "cb",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "cb INT NOT NULL DEFAULT 0"
      },
      {
        "name": "heat",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "heat NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "trade_rep",
        "sqlType": "BIGINT",
        "nullable": false,
        "declaration": "trade_rep BIGINT NOT NULL DEFAULT 0"
      },
      {
        "name": "gta_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "gta_at TIMESTAMPTZ"
      },
      {
        "name": "gun",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "gun TEXT"
      },
      {
        "name": "vest",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "vest TEXT"
      },
      {
        "name": "shoot_cd_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "shoot_cd_until TIMESTAMPTZ"
      },
      {
        "name": "busts",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "busts INT NOT NULL DEFAULT 0"
      },
      {
        "name": "lab",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "lab TEXT"
      },
      {
        "name": "crew",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "crew INT NOT NULL DEFAULT 0"
      },
      {
        "name": "crew_paid_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "crew_paid_at TIMESTAMPTZ"
      },
      {
        "name": "heist_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "heist_at TIMESTAMPTZ"
      },
      {
        "name": "season",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "season INT NOT NULL"
      },
      {
        "name": "minted",
        "sqlType": "BOOLEAN",
        "nullable": false,
        "declaration": "minted BOOLEAN NOT NULL DEFAULT false"
      },
      {
        "name": "season_kills",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "season_kills INT NOT NULL DEFAULT 0"
      },
      {
        "name": "honor",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "honor NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "npchit_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "npchit_at TIMESTAMPTZ"
      },
      {
        "name": "safe_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "safe_until TIMESTAMPTZ"
      },
      {
        "name": "guard_price",
        "sqlType": "NUMERIC",
        "nullable": true,
        "declaration": "guard_price NUMERIC"
      },
      {
        "name": "fade_limit",
        "sqlType": "NUMERIC",
        "nullable": true,
        "declaration": "fade_limit NUMERIC"
      },
      {
        "name": "poker_limit",
        "sqlType": "NUMERIC",
        "nullable": true,
        "declaration": "poker_limit NUMERIC"
      },
      {
        "name": "wash_used",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "wash_used NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "wash_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "wash_at TIMESTAMPTZ"
      },
      {
        "name": "safehouse_used",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "safehouse_used NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "safehouse_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "safehouse_at TIMESTAMPTZ"
      },
      {
        "name": "bust_used",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "bust_used NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "bust_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "bust_at TIMESTAMPTZ"
      },
      {
        "name": "refill_used",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "refill_used NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "refill_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "refill_at TIMESTAMPTZ"
      },
      {
        "name": "rwa_used",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "rwa_used NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "rwa_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "rwa_at TIMESTAMPTZ"
      },
      {
        "name": "respec_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "respec_at TIMESTAMPTZ"
      },
      {
        "name": "guarded_by",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "guarded_by TEXT"
      },
      {
        "name": "guarded_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "guarded_until TIMESTAMPTZ"
      },
      {
        "name": "racket_credit_ms",
        "sqlType": "BIGINT",
        "nullable": false,
        "declaration": "racket_credit_ms BIGINT NOT NULL DEFAULT 28800000"
      },
      {
        "name": "bank_credit_ms",
        "sqlType": "BIGINT",
        "nullable": false,
        "declaration": "bank_credit_ms BIGINT NOT NULL DEFAULT 28800000"
      },
      {
        "name": "bank_intransit",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "bank_intransit NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "bank_intransit_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "bank_intransit_at TIMESTAMPTZ"
      },
      {
        "name": "heat_exposure",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "heat_exposure NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "indicted_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "indicted_at TIMESTAMPTZ"
      },
      {
        "name": "retainer_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "retainer_until TIMESTAMPTZ"
      },
      {
        "name": "jury_bought",
        "sqlType": "BOOLEAN",
        "nullable": false,
        "declaration": "jury_bought BOOLEAN NOT NULL DEFAULT false"
      },
      {
        "name": "witpro_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "witpro_until TIMESTAMPTZ"
      },
      {
        "name": "world_raid_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "world_raid_at TIMESTAMPTZ"
      },
      {
        "name": "pen_safe_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "pen_safe_until TIMESTAMPTZ"
      },
      {
        "name": "hole_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "hole_until TIMESTAMPTZ"
      },
      {
        "name": "pen_faction",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "pen_faction TEXT"
      },
      {
        "name": "shank_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "shank_at TIMESTAMPTZ"
      },
      {
        "name": "train_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "train_at TIMESTAMPTZ"
      },
      {
        "name": "mission_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "mission_at TIMESTAMPTZ"
      },
      {
        "name": "street_action_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "street_action_at TIMESTAMPTZ"
      },
      {
        "name": "crew_sale_credit_ms",
        "sqlType": "BIGINT",
        "nullable": false,
        "declaration": "crew_sale_credit_ms BIGINT NOT NULL DEFAULT 0"
      },
      {
        "name": "welsher",
        "sqlType": "BOOLEAN",
        "nullable": false,
        "declaration": "welsher BOOLEAN NOT NULL DEFAULT false"
      },
      {
        "name": "wanted_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "wanted_until TIMESTAMPTZ"
      },
      {
        "name": "envelope_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "envelope_until TIMESTAMPTZ"
      },
      {
        "name": "wire_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "wire_until TIMESTAMPTZ"
      },
      {
        "name": "wire_tier",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "wire_tier INT NOT NULL DEFAULT 0"
      },
      {
        "name": "disinfo_until",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "disinfo_until TIMESTAMPTZ"
      },
      {
        "name": "active_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "active_at TIMESTAMPTZ"
      },
      {
        "name": "race_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "race_at TIMESTAMPTZ"
      },
      {
        "name": "port_used",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "port_used NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "port_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "port_at TIMESTAMPTZ"
      },
      {
        "name": "contraband",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "contraband NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "berths",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "berths INT NOT NULL DEFAULT 0"
      },
      {
        "name": "is_npc",
        "sqlType": "BOOLEAN",
        "nullable": false,
        "declaration": "is_npc BOOLEAN NOT NULL DEFAULT false"
      },
      {
        "name": "npc_seed",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "npc_seed NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "last_accrued_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": false,
        "declaration": "last_accrued_at TIMESTAMPTZ NOT NULL DEFAULT now()"
      },
      {
        "name": "created_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": false,
        "declaration": "created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
      },
      {
        "name": "shipment",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS shipment INT NOT NULL DEFAULT 0"
      },
      {
        "name": "duel_elo",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS duel_elo INT NOT NULL DEFAULT 1000"
      },
      {
        "name": "duel_limit",
        "sqlType": "INT",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS duel_limit INT"
      },
      {
        "name": "duel_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS duel_at TIMESTAMPTZ"
      },
      {
        "name": "clue_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS clue_at TIMESTAMPTZ"
      },
      {
        "name": "duel_style",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS duel_style TEXT"
      },
      {
        "name": "family_raid_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS family_raid_at TIMESTAMPTZ"
      },
      {
        "name": "heist_loot",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS heist_loot NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "lab_purity",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS lab_purity INT NOT NULL DEFAULT 0"
      },
      {
        "name": "lab_yield",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS lab_yield INT NOT NULL DEFAULT 0"
      },
      {
        "name": "lab_stealth",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS lab_stealth INT NOT NULL DEFAULT 0"
      },
      {
        "name": "path_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS path_at TIMESTAMPTZ"
      },
      {
        "name": "statuse_used",
        "sqlType": "NUMERIC",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS statuse_used NUMERIC NOT NULL DEFAULT 0"
      },
      {
        "name": "statuse_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS statuse_at TIMESTAMPTZ"
      },
      {
        "name": "car_stolen_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS car_stolen_at TIMESTAMPTZ"
      },
      {
        "name": "trunk_robbed_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS trunk_robbed_at TIMESTAMPTZ"
      },
      {
        "name": "sabotaged_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS sabotaged_at TIMESTAMPTZ"
      },
      {
        "name": "paper_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS paper_at TIMESTAMPTZ"
      },
      {
        "name": "lfg",
        "sqlType": "BOOLEAN",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS lfg BOOLEAN NOT NULL DEFAULT false"
      },
      {
        "name": "lfg_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS lfg_at TIMESTAMPTZ"
      },
      {
        "name": "seeking_mentor",
        "sqlType": "BOOLEAN",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS seeking_mentor BOOLEAN NOT NULL DEFAULT false"
      },
      {
        "name": "seeking_mentor_at",
        "sqlType": "TIMESTAMPTZ",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS seeking_mentor_at TIMESTAMPTZ"
      },
      {
        "name": "bio",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS bio TEXT"
      },
      {
        "name": "aha_stage",
        "sqlType": "INT",
        "nullable": false,
        "declaration": "ADD COLUMN IF NOT EXISTS aha_stage INT NOT NULL DEFAULT 0"
      },
      {
        "name": "aha_rival",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS aha_rival TEXT"
      },
      {
        "name": "aha_rival_name",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS aha_rival_name TEXT"
      },
      {
        "name": "forged",
        "sqlType": "TEXT",
        "nullable": true,
        "declaration": "ADD COLUMN IF NOT EXISTS forged TEXT"
      }
    ]
  },
  "relations": [
    {
      "name": "character_skills",
      "primaryKey": [
        "character_id",
        "skill_id"
      ],
      "columns": [
        {
          "name": "character_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "character_id TEXT NOT NULL"
        },
        {
          "name": "skill_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "skill_id TEXT NOT NULL"
        },
        {
          "name": "learned_at",
          "sqlType": "TIMESTAMPTZ",
          "nullable": false,
          "declaration": "learned_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        }
      ]
    },
    {
      "name": "masteries",
      "primaryKey": [
        "character_id",
        "track_id"
      ],
      "columns": [
        {
          "name": "character_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "character_id TEXT NOT NULL"
        },
        {
          "name": "track_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "track_id TEXT NOT NULL"
        },
        {
          "name": "xp",
          "sqlType": "NUMERIC",
          "nullable": false,
          "declaration": "xp NUMERIC NOT NULL DEFAULT 0"
        }
      ]
    },
    {
      "name": "character_traits",
      "primaryKey": [
        "character_id",
        "track_id"
      ],
      "columns": [
        {
          "name": "character_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "character_id TEXT NOT NULL"
        },
        {
          "name": "track_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "track_id TEXT NOT NULL"
        },
        {
          "name": "trait_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "trait_id TEXT NOT NULL"
        }
      ]
    },
    {
      "name": "character_disciplines",
      "primaryKey": [
        "character_id",
        "discipline"
      ],
      "columns": [
        {
          "name": "character_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "character_id TEXT NOT NULL"
        },
        {
          "name": "discipline",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "discipline TEXT NOT NULL"
        },
        {
          "name": "xp",
          "sqlType": "INT",
          "nullable": false,
          "declaration": "xp INT NOT NULL DEFAULT 0"
        }
      ]
    },
    {
      "name": "missions_done",
      "primaryKey": [
        "character_id",
        "mission_id"
      ],
      "columns": [
        {
          "name": "character_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "character_id TEXT NOT NULL"
        },
        {
          "name": "mission_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "mission_id TEXT NOT NULL"
        }
      ]
    },
    {
      "name": "campaign_progress",
      "primaryKey": [
        "character_id",
        "campaign_id"
      ],
      "columns": [
        {
          "name": "character_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "character_id TEXT NOT NULL"
        },
        {
          "name": "campaign_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "campaign_id TEXT NOT NULL"
        },
        {
          "name": "step",
          "sqlType": "INT",
          "nullable": false,
          "declaration": "step INT NOT NULL DEFAULT 0"
        },
        {
          "name": "done",
          "sqlType": "INT",
          "nullable": false,
          "declaration": "done INT NOT NULL DEFAULT 0"
        },
        {
          "name": "branch",
          "sqlType": "TEXT",
          "nullable": true,
          "declaration": "branch TEXT"
        },
        {
          "name": "completed",
          "sqlType": "BOOLEAN",
          "nullable": false,
          "declaration": "completed BOOLEAN NOT NULL DEFAULT false"
        },
        {
          "name": "claimed",
          "sqlType": "BOOLEAN",
          "nullable": false,
          "declaration": "claimed BOOLEAN NOT NULL DEFAULT false"
        },
        {
          "name": "started_at",
          "sqlType": "TIMESTAMPTZ",
          "nullable": false,
          "declaration": "started_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        }
      ]
    },
    {
      "name": "daily_progress",
      "primaryKey": [
        "character_id",
        "day"
      ],
      "columns": [
        {
          "name": "character_id",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "character_id TEXT NOT NULL"
        },
        {
          "name": "day",
          "sqlType": "INT",
          "nullable": false,
          "declaration": "day INT NOT NULL"
        },
        {
          "name": "counters",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "counters TEXT NOT NULL DEFAULT '{}'"
        },
        {
          "name": "claimed",
          "sqlType": "TEXT",
          "nullable": false,
          "declaration": "claimed TEXT NOT NULL DEFAULT '[]'"
        }
      ]
    }
  ],
  "persisted": [
    "respect",
    "energy",
    "nerve",
    "health",
    "cash",
    "bank",
    "muscle",
    "cunning",
    "speed",
    "jail_until",
    "loc",
    "streak",
    "checkin_day",
    "lc_crime",
    "ammo",
    "cb",
    "heat",
    "trade_rep",
    "gta_at",
    "path",
    "gun",
    "vest",
    "shoot_cd_until",
    "busts",
    "hosp_until",
    "lab",
    "crew",
    "heist_at",
    "title",
    "racket_credit_ms",
    "season_kills",
    "npchit_at",
    "safe_until",
    "guard_price",
    "guarded_by",
    "guarded_until",
    "bank_credit_ms",
    "last_accrued_at",
    "bank_intransit",
    "bank_intransit_at",
    "fade_limit",
    "wash_used",
    "wash_at",
    "respec_at",
    "crew_paid_at",
    "heat_exposure",
    "indicted_at",
    "retainer_until",
    "jury_bought",
    "witpro_until",
    "world_raid_at",
    "pen_safe_until",
    "hole_until",
    "welsher",
    "wanted_until",
    "rwa_used",
    "rwa_at",
    "envelope_until",
    "wire_until",
    "poker_limit",
    "safehouse_used",
    "safehouse_at",
    "refill_used",
    "refill_at",
    "family_raid_at",
    "shipment",
    "crew_sale_credit_ms"
  ],
  "policy": {
    "recipeId": "recipe:precision_lock_tool",
    "recipeCommitment": "0xb38cc29647ef4b66e4421e1f6de790e2542cae2050f109688e1f2e77e47750e1",
    "location": "foundry",
    "minimumLevel": 8,
    "skill": "fence_network",
    "levelDivisor": 10,
    "minimumRespect": "490",
    "levelFunction": "(respect)=>Math.floor(Math.sqrt(Math.max(0,respect)/PACING.LEVEL_DIVISOR))+1",
    "knownSkillIds": [
      "bruiser",
      "doctors_friend",
      "executioner",
      "fast_talker",
      "fence_network",
      "broker",
      "pack_mule",
      "getaway",
      "road_captain",
      "made_man",
      "kingpin",
      "road_boss"
    ],
    "exactPredicate": "alive && loc===foundry && signed BIGINT respect>=490 && learned skill_id===fence_network",
    "notGates": [
      "is_npc",
      "jail_until",
      "hosp_until",
      "current skill-point budget",
      "prerequisite skill presence"
    ]
  }
});
