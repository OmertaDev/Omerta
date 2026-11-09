// Open optional reference through the same controls available to a player.
export async function revealOptional(locator) {
  await locator.waitFor({ state: 'attached' });
  const classes = ['noir-foldable', 'ux-world-panel', 'ux-identity', 'ux-community', 'investigation-reading-desk'];
  const match = classes.map(name => `contains(concat(" ", normalize-space(@class), " "), " ${name} ")`).join(' or ');
  const optional = locator.locator(`xpath=ancestor-or-self::*[${match} or @data-ux-progression or @data-ux-story or @id="ux-coordination"][1]`);
  if (!await optional.count()) return;
  const toggle = optional.locator(':scope > .noir-panel-toggle');
  await toggle.waitFor();
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}
