// OFFREPO closed public-contract proposal.
export const BUSINESS_RELOCATION_SCHEMAS={
  "BusinessRelocationBoard": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "available",
      "effect",
      "plans",
      "scope"
    ],
    "properties": {
      "available": {
        "type": "boolean"
      },
      "effect": {
        "const": "same_depot_settled_stock_paid_travel"
      },
      "plans": {
        "type": "array",
        "maxItems": 20,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "planId",
            "businessId",
            "originalCharacterId",
            "destination",
            "sourceHash",
            "expiresAt",
            "state",
            "revision"
          ],
          "properties": {
            "planId": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{1,128}$",
              "minLength": 1,
              "maxLength": 128
            },
            "businessId": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{1,128}$",
              "minLength": 1,
              "maxLength": 128
            },
            "originalCharacterId": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{1,128}$",
              "minLength": 1,
              "maxLength": 128
            },
            "destination": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_-]{1,128}$",
              "minLength": 1,
              "maxLength": 128
            },
            "sourceHash": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "expiresAt": {
              "type": "string",
              "format": "date-time"
            },
            "state": {
              "enum": [
                "ready",
                "executed",
                "cancelled",
                "expired",
                "owner_dead"
              ]
            },
            "revision": {
              "type": "integer",
              "minimum": 1,
              "maximum": 2
            }
          }
        }
      },
      "scope": {
        "const": "private_original_account_history"
      }
    }
  },
  "BusinessRelocationQuote": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ok",
      "businessId",
      "origin",
      "destination",
      "stock",
      "stockCost",
      "travelCost",
      "sourceHash",
      "minimumSeconds",
      "maximumSeconds",
      "effect"
    ],
    "properties": {
      "ok": {
        "const": true
      },
      "businessId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "origin": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "destination": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "stock": {
        "type": "integer",
        "minimum": 0,
        "maximum": 40
      },
      "stockCost": {
        "type": "integer",
        "minimum": 0,
        "maximum": 2147483647
      },
      "travelCost": {
        "type": "integer",
        "minimum": 0,
        "maximum": 2147483647
      },
      "sourceHash": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "minimumSeconds": {
        "const": 60
      },
      "maximumSeconds": {
        "const": 600
      },
      "effect": {
        "const": "same_depot_settled_stock_paid_travel"
      }
    }
  },
  "BusinessRelocationCreated": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ok",
      "planId",
      "businessId",
      "originalCharacterId",
      "destination",
      "sourceHash",
      "expiresAt",
      "state",
      "revision"
    ],
    "properties": {
      "ok": {
        "const": true
      },
      "planId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "businessId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "originalCharacterId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "destination": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "sourceHash": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "expiresAt": {
        "type": "string",
        "format": "date-time"
      },
      "state": {
        "const": "ready"
      },
      "revision": {
        "const": 1
      }
    }
  },
  "BusinessRelocationCancelled": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ok",
      "planId",
      "businessId",
      "originalCharacterId",
      "destination",
      "sourceHash",
      "expiresAt",
      "state",
      "revision"
    ],
    "properties": {
      "ok": {
        "const": true
      },
      "planId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "businessId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "originalCharacterId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "destination": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "sourceHash": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "expiresAt": {
        "type": "string",
        "format": "date-time"
      },
      "state": {
        "const": "cancelled"
      },
      "revision": {
        "const": 2
      }
    }
  },
  "BusinessRelocationExecuted": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ok",
      "planId",
      "businessId",
      "originalCharacterId",
      "destination",
      "sourceHash",
      "expiresAt",
      "state",
      "revision",
      "outcome"
    ],
    "properties": {
      "ok": {
        "const": true
      },
      "planId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "businessId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "originalCharacterId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "destination": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,128}$",
        "minLength": 1,
        "maxLength": 128
      },
      "sourceHash": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "expiresAt": {
        "type": "string",
        "format": "date-time"
      },
      "state": {
        "const": "executed"
      },
      "revision": {
        "const": 2
      },
      "outcome": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "businessId",
          "origin",
          "destination",
          "stockMoved",
          "stockCostPreserved",
          "travelCost",
          "travelJournal",
          "withdrawalJournal",
          "returnJournal"
        ],
        "properties": {
          "businessId": {
            "type": "string",
            "pattern": "^[A-Za-z0-9_-]{1,128}$",
            "minLength": 1,
            "maxLength": 128
          },
          "origin": {
            "type": "string",
            "pattern": "^[A-Za-z0-9_-]{1,128}$",
            "minLength": 1,
            "maxLength": 128
          },
          "destination": {
            "type": "string",
            "pattern": "^[A-Za-z0-9_-]{1,128}$",
            "minLength": 1,
            "maxLength": 128
          },
          "stockMoved": {
            "type": "integer",
            "minimum": 0,
            "maximum": 40
          },
          "stockCostPreserved": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2147483647
          },
          "travelCost": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2147483647
          },
          "travelJournal": {
            "type": "string",
            "pattern": "^[A-Za-z0-9_-]{1,128}$",
            "minLength": 1,
            "maxLength": 128
          },
          "withdrawalJournal": {
            "anyOf": [
              {
                "type": "string",
                "pattern": "^[A-Za-z0-9_-]{1,128}$",
                "minLength": 1,
                "maxLength": 128
              },
              {
                "type": "null"
              }
            ]
          },
          "returnJournal": {
            "anyOf": [
              {
                "type": "string",
                "pattern": "^[A-Za-z0-9_-]{1,128}$",
                "minLength": 1,
                "maxLength": 128
              },
              {
                "type": "null"
              }
            ]
          }
        }
      }
    }
  }
};
export const BUSINESS_RELOCATION_CONTRACTS={
  "GET /v1/business/relocations": {
    "operationId": "readOwnBusinessRelocations",
    "responseSchema": {
      "$ref": "#/components/schemas/BusinessRelocationBoard"
    }
  },
  "POST /v1/business/relocations/quote": {
    "operationId": "quoteBusinessRelocation",
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "businessId",
        "destination"
      ],
      "properties": {
        "businessId": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,128}$",
          "minLength": 1,
          "maxLength": 128
        },
        "destination": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,128}$",
          "minLength": 1,
          "maxLength": 128
        }
      }
    },
    "responseSchema": {
      "$ref": "#/components/schemas/BusinessRelocationQuote"
    }
  },
  "POST /v1/business/relocations/create": {
    "operationId": "createBusinessRelocation",
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "businessId",
        "destination",
        "sourceHash",
        "durationSeconds"
      ],
      "properties": {
        "businessId": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,128}$",
          "minLength": 1,
          "maxLength": 128
        },
        "destination": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,128}$",
          "minLength": 1,
          "maxLength": 128
        },
        "sourceHash": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "durationSeconds": {
          "type": "integer",
          "minimum": 60,
          "maximum": 600
        }
      }
    },
    "requestParameters": [
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[!-~]{1,128}$",
          "minLength": 1,
          "maxLength": 128
        }
      }
    ],
    "responseSchema": {
      "$ref": "#/components/schemas/BusinessRelocationCreated"
    }
  },
  "POST /v1/business/relocations/execute": {
    "operationId": "executeBusinessRelocation",
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "planId",
        "sourceHash"
      ],
      "properties": {
        "planId": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,128}$",
          "minLength": 1,
          "maxLength": 128
        },
        "sourceHash": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      }
    },
    "requestParameters": [
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[!-~]{1,128}$",
          "minLength": 1,
          "maxLength": 128
        }
      }
    ],
    "responseSchema": {
      "$ref": "#/components/schemas/BusinessRelocationExecuted"
    }
  },
  "POST /v1/business/relocations/cancel": {
    "operationId": "cancelBusinessRelocation",
    "requestSchema": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "planId",
        "sourceHash"
      ],
      "properties": {
        "planId": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,128}$",
          "minLength": 1,
          "maxLength": 128
        },
        "sourceHash": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      }
    },
    "requestParameters": [
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[!-~]{1,128}$",
          "minLength": 1,
          "maxLength": 128
        }
      }
    ],
    "responseSchema": {
      "$ref": "#/components/schemas/BusinessRelocationCancelled"
    }
  }
};
