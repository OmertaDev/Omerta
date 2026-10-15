// OFF-REPO insertion proposal inside canonical src/crafting.js; not a standalone mint API.
export async function recoverWorldGraphEquipment(client, h, termsValue, idempotencyKey) {
  const Recovery = await import('./equipmentrecovery.js');
  const terms = Recovery.equipmentRecoveryTerms(termsValue);
  const context = contextOf(DEFAULT_CRAFTING_CONTEXT);
  const accountId = canonicalString(h?.accountId, 'Authenticated account id');
  const owner = { scope: 'account', id: accountId };
  const recipe = recipeOf(context, 'recipe:recover_worn_precision_tool');
  assertNoUnsupportedEconomy(recipe);
  if (cashCostOf(recipe) !== 0
      || JSON.stringify(inputsOf(recipe).map(e => ({templateId:e.templateId,quantity:Number(e.quantity)}))) !== JSON.stringify([{templateId:'item:precision_lock_tool',quantity:1}])
      || JSON.stringify(outputsOf(recipe).map(e => ({templateId:e.templateId,quantity:Number(e.quantity),quality:e.quality||QUALITY}))) !== JSON.stringify([{templateId:'mat:salvage_parts',quantity:1,quality:'standard'}])) {
    fail('unsupported_recovery_recipe', 'The closed recovery recipe changed.');
  }
  return withItemMutation(client, owner, 'craft', idempotencyKey,
    { ...graphMutationAuthority(context, recipe), equipmentRecovery: terms },
    async mutation => {
      const actor = await actorContext(client, accountId);
      if (actor.character.id !== terms.originalCharacterId) fail('crafting_unavailable', 'Crafting is unavailable.');
      const asOf = Date.now();
      await resolveRecipeAuthority(client, context, [recipe], accountId, actor, asOf);
      if (!discovered(recipe, actor)) fail('recipe_unavailable', 'That recipe is unavailable.');
      assertRequirements(recipe, actor);
      const source = await Recovery.lockEquipmentRecoverySource(client, accountId, terms);
      await reserveRecipeScarcity(client, recipe, actor, asOf);
      const cash = await debitRecipeCash(client, actor, recipe);
      const inputs = [await consumeItem(client, owner, terms.itemId, `craft ${recipe.id} input`, mutation)];
      const outputs = await produceRecipeOutputs(client, context, owner, recipe, mutation, 'crafted');
      return { ok:true, kind:'equipment_recovery', recipe:graphIdentity(context, recipe), ...cash,
        itemId:terms.itemId, businessId:terms.businessId, originalCharacterId:terms.originalCharacterId,
        sourceHash:source.sourceHash, inputs, outputs };
    });
}
