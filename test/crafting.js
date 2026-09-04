// Phase 1 graph crafting: deterministic vehicle salvage, multi-stage material conversion,
// server-authoritative requirements, one logical mutation per action, and rollback parity.
import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import {
  grantStack,
  inventoryBoard,
  withItemTransaction,
} from '../src/items.js';
import {
  craft,
  recipeCatalog,
  recipeResourceBlockers,
  salvageCar,
} from '../src/crafting.js';
import { carMatchesGraphSelector } from '../src/economy.js';
import { AUTOMOTIVE_SALVAGE_PACKAGE } from '../src/content/automotive-salvage.js';

const pool = await makeDb();
const tx = (action) => withItemTransaction(pool, action);

const ACCOUNT = 'crafting-account';
const CHARACTER = 'crafting-character';
const OWNER = { scope: 'account', id: ACCOUNT };
const CAR = 'crafting-car';
const COLLISION_CAR = 'crafting-collision-car';
const BLOCKED_CARS = Object.freeze({
  listed: 'crafting-listed-car',
  pledged: 'crafting-pledged-car',
  minted: 'crafting-onchain-car',
  raceLimit: 'crafting-race-limit-car',
  pinkSlip: 'crafting-pink-slip-car',
});
const h = {
  accountId: ACCOUNT,
  owned: { cars: [{ id: CAR, model_id: 'junker', trim_id: 'stock' }] },
};

const ROLLBACK_ACCOUNT = 'crafting-rollback-account';
const ROLLBACK_CHARACTER = 'crafting-rollback-character';
const ROLLBACK_OWNER = { scope: 'account', id: ROLLBACK_ACCOUNT };
const ROLLBACK_CAR = 'crafting-rollback-car';
const rollbackH = {
  accountId: ROLLBACK_ACCOUNT,
  owned: { cars: [{ id: ROLLBACK_CAR, model_id: 'junker', trim_id: 'stock' }] },
};

const stackQty = (board, templateId) => (
  board.stacks.find((stack) => stack.templateId === templateId)?.qty || 0
);
const moneyOf = async (characterId, accountId) => ({
  cash: Number((await pool.query(
    'SELECT cash FROM characters WHERE id=$1', [characterId],
  )).rows[0].cash),
  omr: Number((await pool.query(
    'SELECT omr FROM account_persistent WHERE account_id=$1', [accountId],
  )).rows[0].omr),
  ledgerRows: Number((await pool.query(
    'SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [characterId],
  )).rows[0].n),
});

try {
  assert.equal(AUTOMOTIVE_SALVAGE_PACKAGE.id, 'automotive-salvage');
  assert.deepEqual(AUTOMOTIVE_SALVAGE_PACKAGE.nodes
    .filter((node) => node.type === 'recipe').map((node) => node.id), [
    'recipe:car_salvage_basic',
    'recipe:hardened_steel',
    'recipe:precision_lock_tool',
  ], 'the demo chain is graph content, not handler constants');
  const selectorCar = {
    id: 'selector-car', model_id: 'junker', trim_id: 'stock', rarity: 'common',
  };
  assert(carMatchesGraphSelector(selectorCar, { kind: 'carId', value: 'selector-car' }));
  assert(carMatchesGraphSelector(selectorCar, { kind: 'carType', value: 'junker' }));
  assert(carMatchesGraphSelector(selectorCar, { kind: 'value', value: 'stock' }),
    'the generic selector may name the authoritative trim');
  assert(carMatchesGraphSelector(selectorCar, { kind: 'vehicleClass', value: 'common' }),
    'the class selector reads the authoritative persisted classification');
  assert(carMatchesGraphSelector(selectorCar, { kind: 'assetType', value: 'car' }));
  assert.equal(carMatchesGraphSelector(selectorCar, { kind: 'carId', value: 'junker' }), false,
    'a carId alias cannot accidentally match the model');

  assert.deepEqual(recipeResourceBlockers({
    id: 'recipe:test-unique-input',
    consumes: [{ templateId: 'item:precision_lock_tool', quantity: 2 }],
  }, {
    inventory: {
      stacks: [],
      items: [
        { templateId: 'item:precision_lock_tool', state: 'active', escrowed: false },
        { templateId: 'item:precision_lock_tool', state: 'escrowed', escrowed: true },
      ],
    },
  }), [{
    adapter: 'item_ownership', templateId: 'item:precision_lock_tool', required: 2, current: 1,
  }], 'recipe discovery counts only active, unescrowed unique inputs');
  assert.deepEqual(recipeResourceBlockers({
    id: 'recipe:test-aggregate-materials',
    consumes: [
      { templateId: 'mat:scrap_steel', quantity: 4, quality: 'standard' },
      { templateId: 'mat:scrap_steel', quantity: 4, quality: 'standard' },
    ],
  }, {
    inventory: {
      stacks: [{ templateId: 'mat:scrap_steel', quality: 'standard', qty: 6 }],
      items: [],
    },
  }), [{
    adapter: 'material_quantity', templateId: 'mat:scrap_steel', quality: 'standard',
    required: 8, current: 6,
  }], 'recipe discovery aggregates repeated exact-quality material requirements');

  await pool.query(
    `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
     VALUES ($1,$2,'Crafting Carla',1,'docks',0,7777),
            ($3,$4,'Rollback Rita',1,'foundry',10000,8888)`,
    [CHARACTER, ACCOUNT, ROLLBACK_CHARACTER, ROLLBACK_ACCOUNT],
  );
  await pool.query(
    `INSERT INTO account_persistent (account_id,omr) VALUES ($1,4321),($2,5432)`,
    [ACCOUNT, ROLLBACK_ACCOUNT],
  );
  await pool.query(
    `INSERT INTO cars
       (id,character_id,model_id,trim_id,dmg,listed,pledged,minted_onchain,race_limit,pink_slip)
     VALUES ($1,$2,'junker','stock',60,false,false,false,null,false),
            ($3,$2,'falcone','base',10,false,false,false,null,false),
            ($4,$5,'junker','stock',80,false,false,false,null,false),
            ($6,$2,'junker','stock',20,true,false,false,null,false),
            ($7,$2,'junker','stock',20,false,true,false,null,false),
            ($8,$2,'junker','stock',20,false,false,true,null,false),
            ($9,$2,'junker','stock',20,false,false,false,250,false),
            ($10,$2,'junker','stock',20,false,false,false,null,true)`,
    [CAR, CHARACTER, COLLISION_CAR, ROLLBACK_CAR, ROLLBACK_CHARACTER,
      BLOCKED_CARS.listed, BLOCKED_CARS.pledged, BLOCKED_CARS.minted,
      BLOCKED_CARS.raceLimit, BLOCKED_CARS.pinkSlip],
  );

  // Discovery is a pure preview. It may explain requirements from supplied state, but mutations
  // re-read every authority row and never trust this projection.
  let catalog = recipeCatalog({
    character: { id: CHARACTER, loc: 'docks', level: 1 },
    skills: new Set(),
    cars: h.owned.cars,
  });
  assert.equal(catalog.length, 3);
  assert(catalog.find((entry) => entry.id === 'recipe:car_salvage_basic')
    .blockedBy.some((blocker) => blocker.adapter === 'location'));
  assert(catalog.find((entry) => entry.id === 'recipe:hardened_steel')
    .blockedBy.some((blocker) => blocker.adapter === 'level'));
  assert(catalog.find((entry) => entry.id === 'recipe:precision_lock_tool')
    .blockedBy.some((blocker) => blocker.adapter === 'skill'));
  assert.equal(catalog.find((entry) => entry.id === 'recipe:hardened_steel').cashCost, 300,
    'the preview publishes the validated graph cash cost');

  const salvagePreview = (car) => recipeCatalog({
    character: { id: CHARACTER, loc: 'foundry', level: 10 },
    skills: new Set(['fence_network']),
    cars: [car],
  }).find((entry) => entry.id === 'recipe:car_salvage_basic');
  assert.equal(salvagePreview({
    id: 'preview-junker', model_id: 'junker', trim_id: 'stock', rarity: 'common',
  }).available, true, 'a matching graph-selected model is eligible in the catalog');
  const mismatchedPreview = salvagePreview({
    id: 'preview-falcone', model_id: 'falcone', trim_id: 'base', rarity: 'rare',
  });
  assert.equal(mismatchedPreview.available, false,
    'a non-matching model cannot satisfy the graph selector in the catalog');
  assert(mismatchedPreview.blockedBy.some((blocker) => (
    blocker.adapter === 'owns_car' && blocker.required === 'junker'
  )), 'the catalog publishes the same selector enforced by mutation');

  const ineligiblePreviewCars = [
    { id: BLOCKED_CARS.listed, listed: true },
    { id: BLOCKED_CARS.pledged, pledged: true },
    { id: BLOCKED_CARS.minted, minted_onchain: true },
    { id: BLOCKED_CARS.raceLimit, race_limit: 250 },
    { id: BLOCKED_CARS.pinkSlip, pink_slip: true },
  ];
  for (const car of ineligiblePreviewCars) {
    const salvage = recipeCatalog({
      character: { id: CHARACTER, loc: 'foundry', level: 10 },
      skills: new Set(['fence_network']),
      cars: [car],
    }).find((entry) => entry.id === 'recipe:car_salvage_basic');
    assert.equal(salvage.available, false,
      `${car.id} cannot satisfy owns_car in the recipe preview`);
    assert(salvage.blockedBy.some((blocker) => blocker.adapter === 'owns_car'));
  }

  // The foundry is the graph-declared facility. Refusal leaves both the car and item ledger intact.
  await assert.rejects(
    tx((client) => salvageCar(
      client, h, CAR, 'recipe:car_salvage_basic', 'salvage-location-denied',
    )),
    (error) => error?.code === 'location' && error?.data?.district === 'foundry',
    'vehicle salvage is refused outside the graph-declared facility',
  );
  assert.equal(Number((await pool.query(
    'SELECT COUNT(*) AS n FROM cars WHERE id=$1 AND character_id=$2', [CAR, CHARACTER],
  )).rows[0].n), 1, 'a facility refusal does not consume the car');

  await pool.query("UPDATE characters SET loc='foundry' WHERE id=$1", [CHARACTER]);
  const moneyBefore = await moneyOf(CHARACTER, ACCOUNT);

  const deniedCars = [
    [BLOCKED_CARS.listed, 'listed'],
    [BLOCKED_CARS.pledged, 'pledged'],
    [BLOCKED_CARS.minted, 'no_car'],
    [BLOCKED_CARS.raceLimit, 'race_reserved'],
    [BLOCKED_CARS.pinkSlip, 'race_reserved'],
  ];
  for (const [carId, code] of deniedCars) {
    await assert.rejects(
      tx((client) => salvageCar(
        client, h, carId, 'recipe:car_salvage_basic', `salvage-denied-${carId}`,
      )),
      (error) => error?.code === code,
      `${carId} is rejected from the locked authoritative row`,
    );
  }
  for (const carId of Object.values(BLOCKED_CARS)) {
    assert.equal(Number((await pool.query(
      'SELECT COUNT(*) AS n FROM cars WHERE id=$1 AND character_id=$2',
      [carId, CHARACTER],
    )).rows[0].n), 1, `${carId} remains in the garage after refusal`);
  }
  assert.equal((await inventoryBoard(pool, OWNER)).stacks.length, 0,
    'excluded car states cannot create salvage output');

  const salvaged = await tx((client) => salvageCar(
    client, h, CAR, 'recipe:car_salvage_basic', 'salvage-car-1',
  ));
  assert.deepEqual(salvaged.outputs.map(({ templateId, delta }) => ({ templateId, delta })), [
    { templateId: 'mat:scrap_steel', delta: 6 },
    { templateId: 'mat:wire', delta: 2 },
    { templateId: 'mat:salvage_parts', delta: 2 },
  ], 'salvage yields only graph-defined bounded materials');
  assert.deepEqual(salvaged.car, {
    id: CAR, modelId: 'junker', trimId: 'stock', damage: 60,
  }, 'the consumed car identity came from the locked ownership row');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM cars WHERE id=$1', [CAR])).rows[0].n), 0);
  assert.equal(h.owned.cars.length, 0, 'the optional response cache mirrors authoritative disposal');

  const salvageReplay = await tx((client) => salvageCar(
    client, h, CAR, 'recipe:car_salvage_basic', 'salvage-car-1',
  ));
  assert.deepEqual(salvageReplay, salvaged,
    'the same salvage key replays the complete result even though the car is gone');
  await assert.rejects(
    tx((client) => salvageCar(
      client, h, COLLISION_CAR, 'recipe:car_salvage_basic', 'salvage-car-1',
    )),
    (error) => error?.code === 'idempotency_conflict',
    'a salvage key cannot be rebound to a different concrete car',
  );
  assert.equal(Number((await pool.query(
    'SELECT COUNT(*) AS n FROM cars WHERE id=$1 AND character_id=$2',
    [COLLISION_CAR, CHARACTER],
  )).rows[0].n), 1, 'the collision is rejected before consuming the other car');
  await assert.rejects(
    tx((client) => salvageCar(
      client, h, COLLISION_CAR, 'recipe:car_salvage_basic', 'salvage-selector-mismatch',
    )),
    (error) => error?.code === 'no_car',
    'direct mutation cannot bypass the graph-declared locked-car selector',
  );
  assert.equal(Number((await pool.query(
    'SELECT COUNT(*) AS n FROM cars WHERE id=$1 AND character_id=$2',
    [COLLISION_CAR, CHARACTER],
  )).rows[0].n), 1, 'a selector mismatch leaves the concrete car untouched');
  assert.equal(stackQty(await inventoryBoard(pool, OWNER), 'mat:scrap_steel'), 6,
    'a selector mismatch creates no graph output');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key='salvage-selector-mismatch'",
  )).rows[0].n), 0, 'a selector mismatch leaves no replay reservation');
  await assert.rejects(
    tx((client) => salvageCar(
      client, h, CAR, 'recipe:car_salvage_basic', 'salvage-car-2',
    )),
    (error) => error?.code === 'no_car',
    'a different logical request cannot salvage the same car twice',
  );
  await assert.rejects(
    tx((client) => salvageCar(
      client, rollbackH, CAR, 'recipe:car_salvage_basic', 'salvage-wrong-owner',
    )),
    (error) => error?.code === 'no_car',
    'car identity is not a client array index and ownership is checked server-side',
  );

  let board = await inventoryBoard(pool, OWNER);
  assert.equal(stackQty(board, 'mat:scrap_steel'), 6);
  assert.equal(stackQty(board, 'mat:wire'), 2);
  assert.equal(stackQty(board, 'mat:salvage_parts'), 2);
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key='salvage-car-1'",
  )).rows[0].n), 1, 'salvage owns one aggregate replay guard');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_events WHERE idempotency_key='salvage-car-1'",
  )).rows[0].n), 3, 'every salvage output is provenance under that one guard');

  // Progression is server-derived. A failed conversion spends no material and reserves no key.
  await assert.rejects(
    tx((client) => craft(client, h, 'recipe:hardened_steel', 'craft-hardened-low-level')),
    (error) => error?.code === 'level',
    'the material conversion is progression-gated by graph data',
  );
  assert.equal(stackQty(await inventoryBoard(pool, OWNER), 'mat:scrap_steel'), 6);
  await pool.query('UPDATE characters SET respect=10000 WHERE id=$1', [CHARACTER]);

  await pool.query('UPDATE characters SET cash=299 WHERE id=$1', [CHARACTER]);
  await assert.rejects(
    tx((client) => craft(client, h, 'recipe:hardened_steel', 'craft-hardened-no-cash')),
    (error) => error?.code === 'cash' && error?.data?.required === 300,
    'the locked cash row cannot be overdrawn for a recipe cost',
  );
  assert.equal(stackQty(await inventoryBoard(pool, OWNER), 'mat:scrap_steel'), 6,
    'a cash refusal spends no input material');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM transactions WHERE reason='craft:recipe:hardened_steel'",
  )).rows[0].n), 0, 'a cash refusal writes no ledger row');
  await pool.query('UPDATE characters SET cash=7777 WHERE id=$1', [CHARACTER]);

  const hardened = await tx((client) => craft(
    client, h, 'recipe:hardened_steel', 'craft-hardened-1',
  ));
  assert.equal(hardened.inputs[0].delta, -4);
  assert.equal(hardened.outputs[0].templateId, 'mat:hardened_steel');
  assert.equal(hardened.outputs[0].delta, 1);
  assert.equal(hardened.cashCost, 300);
  assert.equal(hardened.cashAfter, 7477);
  assert.equal(Number((await pool.query(
    'SELECT cash FROM characters WHERE id=$1', [CHARACTER],
  )).rows[0].cash), 7477, 'a successful craft debits its exact graph-defined cash cost');
  assert.deepEqual(await tx((client) => craft(
    client, h, 'recipe:hardened_steel', 'craft-hardened-1',
  )), hardened, 'a craft replay neither consumes nor produces again');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1 AND reason='craft:recipe:hardened_steel'",
    [CHARACTER],
  )).rows[0].n), 1, 'a same-key replay cannot debit or ledger the cash cost twice');
  await assert.rejects(
    tx((client) => craft(
      client, h, 'recipe:precision_lock_tool', 'craft-hardened-1',
    )),
    (error) => error?.code === 'idempotency_conflict',
    'the paid craft key cannot be rebound to a changed graph request',
  );
  assert.equal(Number((await pool.query(
    'SELECT cash FROM characters WHERE id=$1', [CHARACTER],
  )).rows[0].cash), 7477, 'a changed-request conflict cannot charge the character again');

  await assert.rejects(
    tx((client) => craft(client, h, 'recipe:hardened_steel', 'craft-hardened-2')),
    (error) => error?.code === 'materials',
    'a new craft cannot overdraw the remaining material stack',
  );
  assert.equal(Number((await pool.query(
    'SELECT cash FROM characters WHERE id=$1', [CHARACTER],
  )).rows[0].cash), 7477, 'a late materials refusal rolls the cash debit back');

  await assert.rejects(
    tx((client) => craft(client, h, 'recipe:precision_lock_tool', 'craft-tool-no-skill')),
    (error) => error?.code === 'skill',
    'the unique tool requires the graph-declared existing skill',
  );
  await pool.query(
    "INSERT INTO character_skills (character_id,skill_id) VALUES ($1,'fence_network')",
    [CHARACTER],
  );
  const toolCraft = await tx((client) => craft(
    client, h, 'recipe:precision_lock_tool', 'craft-tool-1',
  ));
  assert.equal(toolCraft.outputs.length, 1);
  assert.equal(toolCraft.outputs[0].templateId, 'item:precision_lock_tool');
  assert.match(toolCraft.outputs[0].id, /^[0-9a-f-]{36}$/i);
  const toolReplay = await tx((client) => craft(
    client, h, 'recipe:precision_lock_tool', 'craft-tool-1',
  ));
  assert.deepEqual(toolReplay, toolCraft, 'unique-output replay returns the original permanent item id');
  await assert.rejects(
    tx((client) => craft(client, h, 'recipe:hardened_steel', 'craft-tool-1')),
    (error) => error?.code === 'idempotency_conflict',
    'a craft key cannot be rebound to a different graph recipe',
  );
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_instances WHERE template_id='item:precision_lock_tool'",
  )).rows[0].n), 1, 'one logical tool craft creates exactly one unique instance');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key='craft-tool-1'",
  )).rows[0].n), 1, 'the tool craft uses one compound mutation guard');

  board = await inventoryBoard(pool, OWNER);
  assert.equal(stackQty(board, 'mat:scrap_steel'), 2);
  assert.equal(stackQty(board, 'mat:hardened_steel'), 0);
  assert.equal(stackQty(board, 'mat:salvage_parts'), 0);
  assert.equal(board.items.filter((item) => item.templateId === 'item:precision_lock_tool').length, 1);

  // A cash-bearing recipe that reaches a late output failure must restore the exact locked cash,
  // input stack, audit row, and mutation guard. This specifically exercises pg-mem compensation;
  // PostgreSQL performs the same rollback through its native transaction.
  await tx((client) => grantStack(
    client, ROLLBACK_OWNER, 'mat:scrap_steel', 4, 'standard',
    'cash rollback input', 'rollback-cash-input',
  ));
  await tx((client) => grantStack(
    client, ROLLBACK_OWNER, 'mat:hardened_steel', 2147483647, 'standard',
    'cash rollback output cap', 'rollback-cash-output-cap',
  ));
  await assert.rejects(
    tx((client) => craft(
      client, rollbackH, 'recipe:hardened_steel', 'craft-cash-rollback-1',
    )),
    (error) => error?.code === 'inventory_cap',
    'a failure after the cash debit and input spend rejects the complete craft',
  );
  const rollbackMoney = await moneyOf(ROLLBACK_CHARACTER, ROLLBACK_ACCOUNT);
  assert.equal(rollbackMoney.cash, 8888, 'late failure restores the exact pre-debit cash balance');
  assert.equal(stackQty(await inventoryBoard(pool, ROLLBACK_OWNER), 'mat:scrap_steel'), 4,
    'late failure restores the consumed recipe input');
  assert.equal(stackQty(await inventoryBoard(pool, ROLLBACK_OWNER), 'mat:hardened_steel'), 2147483647,
    'late failure leaves the capped output unchanged');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1 AND reason='craft:recipe:hardened_steel'",
    [ROLLBACK_CHARACTER],
  )).rows[0].n), 0, 'late failure deletes only its exact cash ledger row');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key='craft-cash-rollback-1'",
  )).rows[0].n), 0, 'late cash/output failure leaves no mutation guard');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_events WHERE idempotency_key='craft-cash-rollback-1'",
  )).rows[0].n), 0, 'late cash/output failure leaves no item event');

  // A late output failure proves car disposal and prior material grants are one logical action even
  // on pg-mem, whose SQL ROLLBACK itself is a no-op. The item transaction compensation seam restores
  // the locked car row as well as its earlier graph-defined output.
  await tx((client) => grantStack(
    client, ROLLBACK_OWNER, 'mat:wire', 2147483647, 'standard',
    'rollback fixture', 'rollback-wire-cap',
  ));
  await assert.rejects(
    tx((client) => salvageCar(
      client, rollbackH, ROLLBACK_CAR, 'recipe:car_salvage_basic', 'salvage-rollback-1',
    )),
    (error) => error?.code === 'inventory_cap',
    'a late output failure rejects the complete salvage action',
  );
  assert.equal(Number((await pool.query(
    'SELECT COUNT(*) AS n FROM cars WHERE id=$1 AND character_id=$2',
    [ROLLBACK_CAR, ROLLBACK_CHARACTER],
  )).rows[0].n), 1, 'failed salvage restores the exact authoritative car row');
  assert.equal(rollbackH.owned.cars.filter((car) => car.id === ROLLBACK_CAR).length, 1,
    'failed salvage restores the optional response cache without duplication');
  assert.equal(stackQty(await inventoryBoard(pool, ROLLBACK_OWNER), 'mat:scrap_steel'), 4,
    'a material granted before the later failure is rolled back to its prior stack');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_events WHERE idempotency_key='salvage-rollback-1'",
  )).rows[0].n), 0, 'failed salvage leaves no provenance fragment');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key='salvage-rollback-1'",
  )).rows[0].n), 0, 'failed salvage leaves no stranded replay reservation');

  const moneyAfter = await moneyOf(CHARACTER, ACCOUNT);
  assert.deepEqual(moneyAfter, {
    cash: moneyBefore.cash - 300,
    omr: moneyBefore.omr,
    ledgerRows: moneyBefore.ledgerRows + 1,
  }, 'the Phase 1 chain moves only the one explicit validated cash cost and never moves OMR');
  const recipeLedger = (await pool.query(
    `SELECT currency,amount,reason FROM transactions
      WHERE character_id=$1 AND reason LIKE 'craft:recipe:%'`, [CHARACTER],
  )).rows;
  assert.deepEqual(recipeLedger.map((row) => ({
    currency: row.currency, amount: Number(row.amount), reason: row.reason,
  })), [{
    currency: 'cash', amount: -300, reason: 'craft:recipe:hardened_steel',
  }], 'crafting can never emit positive cash or an undeclared currency movement');

  // The preview becomes executable once its supplied state matches the same four adapter rules.
  catalog = recipeCatalog({
    character: { id: CHARACTER, loc: 'foundry', level: 10 },
    skills: new Set(['fence_network']),
    cars: [{ id: 'preview-car', model_id: 'junker', trim_id: 'stock' }],
  });
  assert(catalog.every((entry) => entry.available),
    'location, level, skill, and owned-car are the only Phase 1 recipe adapters');

  // Replay authority is account-scoped and checked before mutable actor state. A completed logical
  // action therefore remains safely retrievable after death/replacement, while owner and request
  // collisions still fail before touching the replacement character.
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [CHARACTER]);
  await pool.query(
    `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
     VALUES ('crafting-heir',$1,'Crafting Heir',1,'docks',0,0)`,
    [ACCOUNT],
  );
  assert.deepEqual(await tx((client) => salvageCar(
    client, h, CAR, 'recipe:car_salvage_basic', 'salvage-car-1',
  )), salvaged, 'completed salvage replays after the original character dies and is replaced');
  assert.deepEqual(await tx((client) => craft(
    client, h, 'recipe:precision_lock_tool', 'craft-tool-1',
  )), toolCraft, 'completed craft replays before replacement progression and location checks');
  await assert.rejects(
    tx((client) => salvageCar(
      client, rollbackH, CAR, 'recipe:car_salvage_basic', 'salvage-car-1',
    )),
    (error) => error?.code === 'idempotency_conflict',
    'a completed key cannot replay for another account owner',
  );

  console.log('✓ graph crafting and atomic automotive salvage passed');
} finally {
  await pool.end();
}
