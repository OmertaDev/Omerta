// Closed read-only owner-account history contracts; no mutation or execution authority.
export const DECISION_DEPENDENCY_CONTRACTS = {
  "GET /v1/agent/decision-replay": {
    "operationId": "listDecisionReplayCandidates",
    "requestParameters": [
      {
        "name": "kind",
        "in": "query",
        "required": true,
        "schema": {
          "enum": [
            "intelligence_purchase",
            "forecast_memory"
          ]
        }
      },
      {
        "name": "after",
        "in": "query",
        "required": false,
        "schema": {
          "type": "string",
          "pattern": "^[!-~]{1,128}$"
        }
      }
    ],
    "responseSchema": {
      "$ref": "#/components/schemas/DecisionReplayBoard"
    }
  },
  "GET /v1/agent/decision-replay/:kind/:id": {
    "operationId": "readVerifiedDecisionReplay",
    "pathSchemas": {
      "kind": {
        "enum": [
          "intelligence_purchase",
          "forecast_memory"
        ]
      },
      "id": {
        "type": "string",
        "pattern": "^[!-~]{1,128}$"
      }
    },
    "responseSchema": {
      "$ref": "#/components/schemas/DecisionReplay"
    }
  },
  "GET /v1/company/dependency-map/:depotId": {
    "operationId": "readVerifiedEconomicDependencyMap",
    "pathSchemas": {
      "depotId": {
        "type": "string",
        "pattern": "^[!-~]{1,128}$"
      }
    },
    "requestParameters": [],
    "responseSchema": {
      "$ref": "#/components/schemas/EconomicDependencyMap"
    }
  }
};
export const DECISION_DEPENDENCY_SCHEMAS = {
  "DecisionReplay": {
    "oneOf": [
      {
        "type": "object",
        "properties": {
          "kind": {
            "const": "intelligence_purchase"
          },
          "id": {
            "type": "string",
            "pattern": "^[!-~]{1,128}$"
          },
          "occurredAt": {
            "type": "string",
            "format": "date-time"
          },
          "originalCharacter": {
            "type": "string",
            "pattern": "^[!-~]{1,128}$"
          },
          "readOnly": {
            "const": true
          },
          "historicalAccountOnly": {
            "const": true
          },
          "executionAuthority": {
            "const": false
          },
          "causality": {
            "const": "not_established"
          },
          "performanceClaim": {
            "const": "none"
          },
          "action": {
            "type": "object",
            "properties": {
              "kind": {
                "const": "purchase_economic_intelligence"
              },
              "publicationId": {
                "type": "string",
                "pattern": "^[!-~]{1,128}$"
              },
              "requestBody": {
                "const": "not_retained"
              }
            },
            "required": [
              "kind",
              "publicationId",
              "requestBody"
            ],
            "additionalProperties": false
          },
          "cost": {
            "type": "object",
            "properties": {
              "gameCashDebited": {
                "type": "integer",
                "minimum": 1
              },
              "basis": {
                "const": "exact_canonical_paired_journals"
              }
            },
            "required": [
              "gameCashDebited",
              "basis"
            ],
            "additionalProperties": false
          },
          "receipt": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "pattern": "^[!-~]{1,128}$"
              },
              "reportHash": {
                "type": "string",
                "pattern": "^[a-f0-9]{64}$"
              },
              "payJournal": {
                "type": "string",
                "pattern": "^[!-~]{1,128}$"
              },
              "receiveJournal": {
                "type": "string",
                "pattern": "^[!-~]{1,128}$"
              }
            },
            "required": [
              "id",
              "reportHash",
              "payJournal",
              "receiveJournal"
            ],
            "additionalProperties": false
          },
          "outcome": {
            "type": "object",
            "properties": {
              "status": {
                "const": "report_delivered"
              },
              "evaluatedAt": {
                "type": "string",
                "format": "date-time"
              },
              "samples": {
                "type": "integer",
                "minimum": 5
              },
              "observedUnits": {
                "type": "integer",
                "minimum": 1
              },
              "projectedUnits": {
                "type": "integer",
                "minimum": 0
              },
              "projectionIsNotOutcome": {
                "const": true
              }
            },
            "required": [
              "status",
              "evaluatedAt",
              "samples",
              "observedUnits",
              "projectedUnits",
              "projectionIsNotOutcome"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "kind",
          "id",
          "occurredAt",
          "originalCharacter",
          "readOnly",
          "historicalAccountOnly",
          "executionAuthority",
          "causality",
          "performanceClaim",
          "action",
          "cost",
          "receipt",
          "outcome"
        ],
        "additionalProperties": false
      },
      {
        "type": "object",
        "properties": {
          "kind": {
            "const": "forecast_memory"
          },
          "id": {
            "type": "string",
            "pattern": "^[!-~]{1,128}$"
          },
          "occurredAt": {
            "type": "string",
            "format": "date-time"
          },
          "originalCharacter": {
            "type": "string",
            "pattern": "^[!-~]{1,128}$"
          },
          "readOnly": {
            "const": true
          },
          "historicalAccountOnly": {
            "const": true
          },
          "executionAuthority": {
            "const": false
          },
          "causality": {
            "const": "not_established"
          },
          "performanceClaim": {
            "const": "none"
          },
          "action": {
            "type": "object",
            "properties": {
              "kind": {
                "const": "apply_observed_inventory_forecast"
              },
              "businessId": {
                "type": "string",
                "pattern": "^[!-~]{1,128}$"
              },
              "applied": {
                "type": "object",
                "properties": {
                  "salePrice": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "bidPrice": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "targetStock": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "reorderAt": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "restockBudget": {
                    "type": "integer",
                    "minimum": 0
                  }
                },
                "required": [
                  "salePrice",
                  "bidPrice",
                  "targetStock",
                  "reorderAt",
                  "restockBudget"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "kind",
              "businessId",
              "applied"
            ],
            "additionalProperties": false
          },
          "cost": {
            "type": "object",
            "properties": {
              "gameCashDebited": {
                "const": 0
              },
              "basis": {
                "const": "canonical_apply_receipt"
              }
            },
            "required": [
              "gameCashDebited",
              "basis"
            ],
            "additionalProperties": false
          },
          "receipt": {
            "type": "object",
            "properties": {
              "factId": {
                "type": "string",
                "pattern": "^[!-~]{1,128}$"
              },
              "sourceProofHash": {
                "type": "string",
                "pattern": "^[a-f0-9]{64}$"
              }
            },
            "required": [
              "factId",
              "sourceProofHash"
            ],
            "additionalProperties": false
          },
          "outcome": {
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "status": {
                    "const": "unknown"
                  },
                  "reason": {
                    "const": "no_recorded_observation"
                  },
                  "attribution": {
                    "const": "not_established"
                  }
                },
                "required": [
                  "status",
                  "reason",
                  "attribution"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "status": {
                    "const": "observed"
                  },
                  "observedAt": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "samples": {
                    "type": "integer",
                    "minimum": 5
                  },
                  "operatingResult": {
                    "type": "integer"
                  },
                  "unitsSold": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "expenses": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "attribution": {
                    "const": "not_established"
                  }
                },
                "required": [
                  "status",
                  "observedAt",
                  "samples",
                  "operatingResult",
                  "unitsSold",
                  "expenses",
                  "attribution"
                ],
                "additionalProperties": false
              }
            ]
          }
        },
        "required": [
          "kind",
          "id",
          "occurredAt",
          "originalCharacter",
          "readOnly",
          "historicalAccountOnly",
          "executionAuthority",
          "causality",
          "performanceClaim",
          "action",
          "cost",
          "receipt",
          "outcome"
        ],
        "additionalProperties": false
      }
    ]
  },
  "DecisionReplayBoard": {
    "type": "object",
    "properties": {
      "kind": {
        "enum": [
          "intelligence_purchase",
          "forecast_memory"
        ]
      },
      "kindName": {
        "enum": [
          "Intelligence purchases",
          "Forecast memory"
        ]
      },
      "candidates": {
        "type": "array",
        "maxItems": 20,
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "pattern": "^[!-~]{1,128}$"
            },
            "occurredAt": {
              "type": "string",
              "format": "date-time"
            },
            "verification": {
              "const": "detail_required"
            }
          },
          "required": [
            "id",
            "occurredAt",
            "verification"
          ],
          "additionalProperties": false
        }
      },
      "next": {
        "anyOf": [
          {
            "type": "string",
            "pattern": "^[!-~]{1,128}$"
          },
          {
            "type": "null"
          }
        ]
      },
      "windowDays": {
        "const": 30
      },
      "readOnly": {
        "const": true
      },
      "unsupportedKinds": {
        "type": "array",
        "minItems": 1,
        "maxItems": 1,
        "items": {
          "const": "production"
        }
      },
      "performanceClaim": {
        "const": "none"
      }
    },
    "required": [
      "kind",
      "kindName",
      "candidates",
      "next",
      "windowDays",
      "readOnly",
      "unsupportedKinds",
      "performanceClaim"
    ],
    "additionalProperties": false
  },
  "EconomicDependencyMap": {
    "oneOf": [
      {
        "type": "object",
        "properties": {
          "status": {
            "const": "unavailable"
          },
          "businessId": {
            "type": "string",
            "pattern": "^[!-~]{1,128}$"
          },
          "reason": {
            "enum": [
              "complete_depot_book_exceeds_200",
              "order_history_exceeds_20",
              "commitment_history_exceeds_40",
              "canonical_order_history_removed_at_estate"
            ]
          },
          "historyOnly": {
            "type": "boolean"
          },
          "readOnly": {
            "const": true
          },
          "executionAuthority": {
            "const": false
          }
        },
        "required": [
          "status",
          "businessId",
          "reason",
          "historyOnly",
          "readOnly",
          "executionAuthority"
        ],
        "additionalProperties": false
      },
      {
        "type": "object",
        "properties": {
          "status": {
            "const": "verified"
          },
          "businessId": {
            "type": "string",
            "pattern": "^[!-~]{1,128}$"
          },
          "originalOwnerCharacter": {
            "type": "string",
            "pattern": "^[!-~]{1,128}$"
          },
          "historyOnly": {
            "type": "boolean"
          },
          "observedAt": {
            "type": "string",
            "format": "date-time"
          },
          "deadlinesCheckedAt": {
            "type": "string",
            "format": "date-time"
          },
          "source": {
            "const": "bounded_canonical_gin_procurement_snapshot"
          },
          "authority": {
            "const": false
          },
          "readOnly": {
            "const": true
          },
          "historyDays": {
            "const": 30
          },
          "orders": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "orderId": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "good": {
                  "const": "gin"
                },
                "district": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "status": {
                  "enum": [
                    "live",
                    "sold",
                    "cancelled",
                    "expired"
                  ]
                },
                "unitPrice": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 1000000
                },
                "initialFundedUnits": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                },
                "remainingUnits": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                },
                "awaitingReceiveUnits": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                },
                "receivedUnits": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                },
                "refundedUnits": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                },
                "escrowJournalId": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "feeJournalId": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "initialEscrowCash": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "expiresAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "recordedEscrowCash": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "currentFundedUnits": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                },
                "currentFundedCash": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "reservedUnits": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                },
                "unassignedFundedUnits": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                },
                "unattributedDeliveredUnits": {
                  "anyOf": [
                    {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 40
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "obligations": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "commitmentId": {
                        "type": "string",
                        "pattern": "^[!-~]{1,128}$"
                      },
                      "supplierCharacter": {
                        "type": "string",
                        "pattern": "^[!-~]{1,128}$"
                      },
                      "remainingUnits": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 40
                      },
                      "unitPrice": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 1000000
                      },
                      "fundedCash": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 9007199254740991
                      },
                      "deadline": {
                        "type": "string",
                        "format": "date-time"
                      },
                      "state": {
                        "enum": [
                          "current_funded",
                          "deadline_or_order_unavailable"
                        ]
                      }
                    },
                    "required": [
                      "commitmentId",
                      "supplierCharacter",
                      "remainingUnits",
                      "unitPrice",
                      "fundedCash",
                      "deadline",
                      "state"
                    ],
                    "additionalProperties": false
                  },
                  "maxItems": 40
                }
              },
              "required": [
                "orderId",
                "good",
                "district",
                "status",
                "unitPrice",
                "initialFundedUnits",
                "remainingUnits",
                "awaitingReceiveUnits",
                "receivedUnits",
                "refundedUnits",
                "escrowJournalId",
                "feeJournalId",
                "initialEscrowCash",
                "expiresAt",
                "recordedEscrowCash",
                "currentFundedUnits",
                "currentFundedCash",
                "reservedUnits",
                "unassignedFundedUnits",
                "unattributedDeliveredUnits",
                "obligations"
              ],
              "additionalProperties": false
            },
            "maxItems": 20
          },
          "suppliers": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "characterId": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "scope": {
                  "const": "explicit_original_supplier_only"
                }
              },
              "required": [
                "characterId",
                "scope"
              ],
              "additionalProperties": false
            },
            "maxItems": 40
          },
          "relationships": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "commitmentId": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "orderId": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "supplierCharacter": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "originalBuyerCharacter": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "acceptedAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "recordedDeliveredUnits": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                },
                "status": {
                  "enum": [
                    "accepted",
                    "delivered",
                    "expired",
                    "buyer_dead",
                    "supplier_dead"
                  ]
                },
                "deliveryTimestamp": {
                  "const": "not_recorded"
                },
                "paymentAttribution": {
                  "const": "not_uniquely_recorded"
                }
              },
              "required": [
                "commitmentId",
                "orderId",
                "supplierCharacter",
                "originalBuyerCharacter",
                "acceptedAt",
                "recordedDeliveredUnits",
                "status",
                "deliveryTimestamp",
                "paymentAttribution"
              ],
              "additionalProperties": false
            },
            "maxItems": 40
          },
          "bottlenecks": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "kind": {
                  "enum": [
                    "expired_commitment_requires_canonical_recovery",
                    "funded_units_without_current_supplier",
                    "delivered_goods_await_canonical_receive",
                    "expired_order_requires_canonical_recovery"
                  ]
                },
                "orderId": {
                  "type": "string",
                  "pattern": "^[!-~]{1,128}$"
                },
                "units": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 40
                }
              },
              "required": [
                "kind",
                "orderId",
                "units"
              ],
              "additionalProperties": false
            },
            "maxItems": 100
          },
          "limits": {
            "type": "object",
            "properties": {
              "orders": {
                "const": 20
              },
              "commitments": {
                "const": 40
              },
              "journals": {
                "const": 200
              }
            },
            "required": [
              "orders",
              "commitments",
              "journals"
            ],
            "additionalProperties": false
          },
          "scope": {
            "type": "object",
            "properties": {
              "demand": {
                "const": "actual_funded_orders_only"
              },
              "openMarketSuppliers": {
                "const": "unattributed"
              },
              "supplierCashAndLocations": {
                "const": "private_not_queried"
              },
              "profits": {
                "const": "not_estimated"
              },
              "nonGinInputs": {
                "const": "unsupported"
              },
              "funding": {
                "const": "gross_buyer_escrow_not_supplier_net"
              },
              "executionRestrictions": {
                "const": "not_evaluated_use_canonical_actions"
              }
            },
            "required": [
              "demand",
              "openMarketSuppliers",
              "supplierCashAndLocations",
              "profits",
              "nonGinInputs",
              "funding",
              "executionRestrictions"
            ],
            "additionalProperties": false
          },
          "consistentSnapshotNotExecutionQuote": {
            "const": true
          }
        },
        "required": [
          "status",
          "businessId",
          "originalOwnerCharacter",
          "historyOnly",
          "observedAt",
          "deadlinesCheckedAt",
          "source",
          "authority",
          "readOnly",
          "historyDays",
          "orders",
          "suppliers",
          "relationships",
          "bottlenecks",
          "limits",
          "scope",
          "consistentSnapshotNotExecutionQuote"
        ],
        "additionalProperties": false
      }
    ]
  }
};
