// Closed original Commerce histories; monetary reserves retain real ledger checks.
export const COMMERCE_STRUCTURAL_CHECKS=Object.freeze([
  {
    "check": "sale attribution completed sale and consent bindings",
    "file": "src/saleattribution.js",
    "fn": "collectSaleAttributionIssues",
    "why": "original sale/publisher/commission receipt provenance; dedicated merchant reserve cash reconciles separately",
    "push": "push('sale attribution completed sale and consent bindings', saleAttributionIssues.length, 0, 0, {issues:saleAttributionIssues});",
    "sha256": "6fe23fcc2ab1413eac75bf69776a0df1b7a6c7c27213f9758eadbb51839ccd13",
    "revision": "4f5fde87c29453a71f027fae5f694f44e8677b3d",
    "blob": "a03e71ca3fd8780fc7d9e863c2c508419a7a7a18"
  },
  {
    "check": "merchant loyalty original purchase bindings",
    "file": "src/merchantloyalty.js",
    "fn": "collectMerchantLoyaltyIssues",
    "why": "original paid sale, customer/merchant consent and fulfillment history; no separate cash bucket",
    "push": "push('merchant loyalty original purchase bindings', loyaltyIssues.length, 0, 0, {issues:loyaltyIssues});",
    "sha256": "8cf4b3e14f7f5f2ef0a798cd1e435bac4fdf50ea96c25a546b30032faf4bf700",
    "revision": "4f5fde87c29453a71f027fae5f694f44e8677b3d",
    "blob": "38f6d537d81e71b1c7ee55dfb53962a2b534dd41"
  },
  {
    "check": "shopping basket canonical sale bindings",
    "file": "src/shoppingbasket.js",
    "fn": "collectShoppingBasketIssues",
    "why": "original item quote and canonical multi-sale receipt history; canonical consignment cash reconciles separately",
    "push": "push('shopping basket canonical sale bindings', basketIssues.length, 0, 0, {issues:basketIssues});",
    "sha256": "40a57a58f485354e31d5108252893aa122af6d97c73f3ae688f66f2bd0f903d6",
    "revision": "4f5fde87c29453a71f027fae5f694f44e8677b3d",
    "blob": "6084e7af4f63e5328543ad86d046466a98129ec1"
  },
  {
    "check": "player funded event history",
    "file": "src/eventmarkets.js",
    "fn": "collectEventMarketIssues",
    "why": "original funded rules, eligibility and reward/refund receipts; dedicated event reserve cash reconciles separately",
    "push": "push('player funded event history', eventIssues.length, 0, 0, {issues:eventIssues});",
    "sha256": "c154f5fc04bb20adf223b7201d66282a37b5580b05d841ecb244de633eeefe9a",
    "revision": "4f5fde87c29453a71f027fae5f694f44e8677b3d",
    "blob": "0c04bd5df7fbde44cab4a18c37f25c59ce02fb02"
  }
].map(Object.freeze));
