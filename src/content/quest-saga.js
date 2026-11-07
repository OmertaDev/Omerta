// Authored source for the questing expansion. Only compiled JSON packs reach the runtime.
// Narrative unlocks and mementos confer no currency, combat stats or export authority.
const namespaceOf = id => `omerta.quest.${id}`;
export const sagaFlag = (id, key, value) => ({ kind: 'story_flag_is', key: `${namespaceOf(id)}.${key}`, value });
const item = (id, label, description) => ({ id, label, ...(description ? { description } : {}) });

function quest(id, title, summary, { minutes = 25, difficulty = 'Experienced', gates = [], roles = ['investigator'], group = 'Solo', commitments = [] } = {}) {
  const nodes = [], edges = [];
  const add = (nodeId, type, payload) => { nodes.push({ id: nodeId, type, payload }); return nodeId; };
  const link = (from, to, type = 'UNLOCKS') => { edges.push({ from, type, to }); };
  add(id, 'mystery', { title, summary, gates, expectations: {
    durationMinutes: minutes, difficulty, summary, reasoning: 'Evidence, interpretation and consequences',
    combat: 'None', group, commitments,
  } });
  add('party-policy', 'party_policy', { organizationScopes: roles.length === 1 ? ['personal'] : ['crew', 'extended_family'], uniqueParticipants: true, roleLockOnStart: true, recheckConsent: true,
    ...(roles.length === 1 ? { accountLegacyContinuity: true } : {}) });
  add('party-quorum', 'quorum', { minimumParticipants: roles.length, uniqueParticipants: true, minimumOrganizations: 1 });
  link(id, 'party-policy', 'REQUIRES'); link('party-policy', 'party-quorum', 'REQUIRES');
  for (const role of roles) {
    add(role, 'role', { title: role.replaceAll('-', ' '), participantKinds: ['agent', 'human_eligible_non_agent'] });
    link('party-policy', role, 'PERFORMED_BY_ROLE');
  }
  add('opening', 'chapter', { title, summary }); link(id, 'opening');
  add('case-reward', 'reward_bundle', { claimOnce: true, cash: 0, tradeableItems: 0 });
  add(`saga-${id}-memento`, 'collectible_def', { title: `${title}: Case Memento`, rarity: 'story', gameplayPower: 'none' });
  add('case-closed', 'terminal', { title: `${title} — Filed`, summary: 'Your evidence and decisions remain in the account case file.', effects: [
    { kind: 'award_collectible', collectibleId: `saga-${id}-memento`, recipientPolicy: 'all_participants', claimPolicy: 'self' },
  ] });
  link('case-reward', 'case-closed');
  const roleGates = role => [{ kind: 'party_role', role: role || roles[0] }];
  function puzzle(nodeId, titleText, kind, prompt, items, solution, options = {}) {
    const mode = options.mode || (Array.isArray(solution) ? 'ordered_ids' : 'mapping');
    const answerId = `${nodeId}-answer`;
    const payload = { title: titleText, prompt, summary: options.summary || prompt,
      gates: [...roleGates(options.role), ...(options.gates || [])],
      answerMode: 'server_owned_canonical', answerSpecId: answerId,
      interaction: { kind, items, ...(options.slots ? { slots: options.slots } : {}) },
      hints: options.hints || ['Separate each witness claim from the evidence that can check it.', 'Compare the stated constraints before choosing an arrangement.'],
      ...(options.extra || {}),
    };
    add(nodeId, 'puzzle', payload);
    add(answerId, 'answer_spec', { verifier: mode, solution });
    return nodeId;
  }
  function choice(nodeId, titleText, prompt, options, { flagKey, flagKind = 'future_scene_variant', role, extra = {} } = {}) {
    const choices = options.map(option => {
      const { value, ...publicOption } = option;
      if (!flagKey) return publicOption;
      const flagId = `${nodeId}-${option.id}-memory`;
      add(flagId, 'story_flag', { key: `${namespaceOf(id)}.${flagKey}`, kind: flagKind, value: value || option.id,
        title: `${titleText}: ${option.label}`, gameplayPower: 'none' });
      return { ...publicOption, storyFlagIds: [flagId] };
    });
    add(nodeId, 'choice', { title: titleText, prompt, gates: roleGates(role), options: choices, ...extra });
    return nodeId;
  }
  function evidence(nodeId, titleText, summary, from, kind = 'fact') {
    add(nodeId, 'evidence', { title: titleText, summary, evidenceKind: kind, shareScope: 'party_summary_only' });
    link(from, nodeId, 'REVEALS'); return nodeId;
  }
  function chain(...ids) { for (let index = 1; index < ids.length; index++) link(ids[index - 1], ids[index]); }
  function converge(nodeId, ...from) {
    nodes.find(node => node.id === nodeId).payload.unlockMode = 'any';
    for (const source of from) link(source, nodeId);
  }
  function finish(from) {
    const action = nodes.find(node => node.id === from);
    if (action?.type === 'choice' && roles.length === 1) {
      const memoryId = `${from}-filed-memory`;
      add(memoryId, 'story_flag', { key: `${namespaceOf(id)}.complete`, kind: 'case_evidence', value: 'filed',
        title: `${title}: case filed`, gameplayPower: 'none' });
      for (const option of action.payload.options) option.storyFlagIds = [...(option.storyFlagIds || []), memoryId];
    }
    link(from, 'case-reward');
  }
  return { id, nodes, edges, add, link, puzzle, choice, evidence, chain, converge, finish,
    pack() { return { schemaVersion: 1, namespace: namespaceOf(id), version: 1,
      growth: { role: 'internal_only', exemptReason: 'Authored investigations with no external acquisition action or economic reward' },
      runtime: { experienceId: id, entryNodeId: id, partyPolicyId: 'party-policy', quorumId: 'party-quorum', terminalNodeId: 'case-closed',
        nodeIds: nodes.map(node => node.id), actionNodeIds: nodes.filter(node => ['puzzle', 'choice'].includes(node.type)).map(node => node.id) },
      nodes, edges };
    },
  };
}

function obituary() {
  const q = quest('early-obituary', 'The Obituary Arrives Early',
    'Ada Vale brings tomorrow\'s newspaper. It reports the death of living printer Tomas Bell at 23:00 tonight. Ada wants her brother safe; exposing the forged notice could identify the witness who warned her.',
    { minutes: 35, commitments: ['Your final protection decision is remembered in later cases.'] });
  q.puzzle('notice', 'A Death Before Its Time', 'deduction',
    'The paper bears tomorrow\'s date. Tomas answers you in person at 18:00. The edition register says tomorrow\'s press run starts at 04:00. Which two records prove this notice was planted before the legitimate edition?',
    [item('tomas', 'Tomas is alive at 18:00', 'You spoke to Tomas yourself.'), item('press', 'Press register: 04:00 tomorrow', 'The legitimate edition has not been printed.'), item('rain', 'Rain is forecast', 'Weather says nothing about authorship.')],
    ['tomas', 'press'], { mode: 'unordered_ids', hints: ['A future date alone does not prove a forgery.', 'Compare something observed now with the legitimate production schedule.', 'Use Tomas\'s appearance and the press register together.'] });
  q.evidence('notice-fact', 'Confirmed: An Unauthorized Printing', 'Tomas is alive, and the real edition has not run. Someone printed the death notice separately.', 'notice');
  q.choice('approach', 'Which Lead First?', 'Ada can take you to the compositor, or you can examine the distribution ledger. These approaches expose different evidence.', [
    { id: 'witness', label: 'Interview the compositor', nextNodeIds: ['compositor'] },
    { id: 'records', label: 'Reconstruct the delivery route', nextNodeIds: ['delivery'] },
  ], { flagKey: 'method' });
  q.puzzle('compositor', 'The Ink on His Sleeve', 'interrogation',
    'Nico says he never touched the notice. His sleeve has violet ink; the job ticket calls for black; a locked violet press was opened with his signed key receipt. Present the receipt that checks his claim.',
    [item('key', 'Signed violet-press key receipt'), item('ticket', 'Black-ink job ticket'), item('gossip', 'Rumor Nico dislikes Tomas')], ['key'],
    { mode: 'unordered_ids', summary: 'Nico admits taking a print order from Inspector Orsini, but says the threatened witness was Ada.' });
  q.puzzle('delivery', 'The Parcel That Came Back', 'timeline',
    'The ledger timestamps are explicit: a plate left the press at 16:00, the false notice arrived at Tomas\'s shop at 17:00, and its courier returned a signed receipt at 17:20. Arrange those events.',
    [item('receipt', '17:20 — courier returns'), item('plate', '16:00 — plate leaves'), item('notice', '17:00 — notice arrives')], ['plate', 'notice', 'receipt'],
    { summary: 'The returning receipt bears Inspector Orsini\'s office stamp; the delivery was a warning intended to provoke Ada.' });
  q.evidence('witness-account', 'Nico\'s Account', 'Nico names Orsini and believes Ada is the intended target. His belief is testimony, not yet a confirmed motive.', 'compositor', 'testimony');
  q.evidence('courier-proof', 'Stamped Return Receipt', 'The return receipt links the forged delivery to Orsini\'s office.', 'delivery');
  q.puzzle('alibi', 'The Impossible Alibi', 'timeline',
    'Tomas\'s watch is twenty minutes fast. It reads 18:10 when the harbor bell rings at real 17:50. The shop photograph is stamped real 18:00; the last ferry leaves at 18:05. Arrange the corrected events.',
    [item('ferry', 'Last ferry — real 18:05'), item('watch', 'Watch reading 18:10 — correct by minus twenty'), item('photo', 'Shop photograph — real 18:00')], ['watch', 'photo', 'ferry']);
  q.converge('alibi', 'compositor', 'delivery');
  q.puzzle('safe-route', 'Leave the Notice Where It Is', 'planning',
    'The front door is watched. Ada\'s bakery opens onto an unobserved service court; its cart goes to the harbor after closing. Choose the observed safe route, rather than guessing from street gossip.',
    [item('front', 'Walk Tomas through the watched front door'), item('bakery', 'Use the bakery service court and its scheduled cart'), item('roof', 'Climb an uninspected roof')], ['bakery'],
    { mode: 'unordered_ids', extra: { successNextNodeIds: ['protection'], failForward: { afterAttempts: 2, nextNodeId: 'negotiated-exit', summary: 'The watchers notice the probing. Ada secures a conversation at the bakery instead.' } } });
  q.puzzle('negotiated-exit', 'A Conversation Instead of a Chase', 'interrogation',
    'The watcher will stand down if shown that Tomas was photographed alive after the supposed death notice was printed. Which evidence can verify that?',
    [item('photo', 'Dated shop photograph'), item('rumor', 'Unattributed street rumor')], ['photo'], { mode: 'unordered_ids' });
  q.choice('protection', 'Whose Safety Carries the Cost?',
    'Publishing the office stamp protects Tomas publicly but identifies Ada as the source. Keeping the proof private lets Ada leave safely, while Tomas must close his shop until the threat is resolved. Both have asked you to hear their wishes.', [
      { id: 'public', label: 'Publish the stamp with Tomas\'s consent; Ada accepts relocation', value: 'public' },
      { id: 'quiet', label: 'Keep Ada anonymous; arrange Tomas\'s temporary closure', value: 'quiet' },
    ], { flagKey: 'protection', flagKind: 'witness_spared', extra: { unlockMode: 'any' } });
  q.chain('opening', 'notice', 'approach'); q.link('approach', 'compositor'); q.link('approach', 'delivery');
  q.link('alibi', 'safe-route'); q.link('safe-route', 'protection'); q.link('safe-route', 'negotiated-exit'); q.link('negotiated-exit', 'protection'); q.finish('protection');
  return q.pack();
}

function dinner() {
  const q = quest('family-dinner', 'A Very Small Family Dinner',
    'Ada invites you to a dinner that has acquired three extra guests, two forged invitations, and a seating chart described by everyone as a personal insult. Tomas only wants one ordinary evening.', { minutes: 25, difficulty: 'Intermediate' });
  q.puzzle('invitations', 'Guests Who Invited Themselves', 'deduction',
    'Ada\'s real invitations use a small flour stamp and are numbered 1–4 in her book. The numbered card with the flour stamp is genuine; a gold card with no number is not. File the genuine invitation.',
    [item('flour', 'Number 3, flour stamp'), item('gold', 'Unnumbered gold card'), item('blank', 'Unsigned blank envelope')], ['flour'], { mode: 'unordered_ids' });
  q.choice('kindness', 'Before the Guests Arrive', 'Ada is overwhelmed; the retired doorman is waiting alone. You have time to help one of them properly before dinner.', [
    { id: 'ada', label: 'Help Ada prepare and hear why the bakery matters' },
    { id: 'doorman', label: 'Sit with the doorman and hear about his missing daughter' },
  ], { flagKey: 'friend', flagKind: 'npc_ally' });
  q.puzzle('seating', 'Diplomacy With Place Cards', 'scene',
    'There are three labeled seats. Ada needs the kitchen seat to serve. Tomas requested the window. The doorman needs the remaining door seat. Arrange their place cards; all three preferences are written down.',
    [item('ada', 'Ada'), item('tomas', 'Tomas'), item('doorman', 'The doorman')],
    { kitchen: 'ada', window: 'tomas', door: 'doorman' }, { slots: [item('door', 'Door seat'), item('kitchen', 'Kitchen seat'), item('window', 'Window seat')] });
  q.puzzle('dish', 'The Missing Ceremonial Dish', 'inventory',
    'The family\'s grand silver dome contains a sandwich. Ada left three notes: chalk locates the borrowed dish on the storeroom list; a clean cloth lifts it safely; the invitation is no cooking implement. Match each useful object to its task.',
    [item('chalk', 'Tailor\'s chalk'), item('cloth', 'Clean cloth'), item('invitation', 'Gold invitation')], { locate: 'chalk', lift: 'cloth' },
    { slots: [item('locate', 'Mark the shelf from the list'), item('lift', 'Lift the hot dish')] });
  q.puzzle('settlement', 'Three Promises, No Money', 'planning',
    'Ada wants quiet after 22:00. Tomas wants the press key returned. The doorman wants a lift home. Assign each stated concession to its beneficiary; no payment satisfies their requests.',
    [item('quiet', 'End the gathering before 22:00'), item('key', 'Return the borrowed press key'), item('ride', 'Arrange the homeward ride')],
    { ada: 'quiet', tomas: 'key', doorman: 'ride' }, { slots: [item('ada', 'Ada\'s agreement'), item('tomas', 'Tomas\'s agreement'), item('doorman', 'Doorman\'s agreement')] });
  q.choice('last-toast', 'The Last Toast', 'Tomas asks what you will remember: a contact who helped your work, or a friend whose evening you helped save?', [
    { id: 'friend', label: 'Promise to return as a friend' }, { id: 'business', label: 'Keep a respectful business relationship' },
  ], { flagKey: 'relationship', flagKind: 'npc_ally' });
  q.chain('opening', 'invitations', 'kindness', 'seating', 'dish', 'settlement', 'last-toast'); q.finish('last-toast'); return q.pack();
}

function missingName() {
  const q = quest('missing-name', 'The Name Between the Lines',
    'A payroll has twelve wage envelopes and eleven names. The doorman remembers his daughter at the printworks, but every official list has a blank where her name should be. Orsini has learned that investigators compare copies.',
    { minutes: 35, gates: [sagaFlag('early-obituary', 'complete', 'filed')], commitments: ['The archive route remains available without specialist training.'] });
  q.puzzle('absence', 'Twelve Envelopes, Eleven Names', 'deduction',
    'Eleven numbered signatures account for eleven envelopes; envelope 12 is stamped collected. A shift photograph has twelve workers. Select the two independent records that establish an omitted worker.',
    [item('envelope', 'Envelope 12: collected'), item('photo', 'Twelve workers in shift photograph'), item('smudge', 'A coffee stain over a margin')], ['envelope', 'photo'], { mode: 'unordered_ids' });
  q.choice('method', 'Recover a Person, Not Just a Name', 'The archive has older copies. A trained reader can reconstruct the impressions in the ledger. The doorman will speak freely to someone who sat with him at dinner.', [
    { id: 'archive', label: 'Compare the public archive', nextNodeIds: ['archive'] },
    { id: 'specialist', label: 'Use ledger mastery to reconstruct impressions', gates: [{ kind: 'mastery_at_least', trackId: 'commerce', level: 5 }], nextNodeIds: ['impressions'] },
    { id: 'friend', label: 'Ask the doorman about his daughter', gates: [sagaFlag('family-dinner', 'friend', 'doorman')], nextNodeIds: ['daughter'] },
  ], { flagKey: 'method' });
  q.puzzle('archive', 'The Copy He Could Not Recall', 'timeline',
    'Archive deposits are dated: 3 May, Rosa\'s signed shift record; 4 May, the official name-removal order; 5 May, a replacement payroll. Order the chain of alteration.',
    [item('replacement', '5 May: replacement payroll'), item('rosa', '3 May: Rosa signs'), item('order', '4 May: removal order')], ['rosa', 'order', 'replacement']);
  q.puzzle('impressions', 'What the Ledger Kept', 'scene',
    'The first carbon sheet preserves R, the second OSA. The two impressions have matching ruled lines. Place the fragments in their marked positions.',
    [item('r', 'Left fragment: R'), item('osa', 'Right fragment: OSA')], { left: 'r', right: 'osa' }, { slots: [item('left', 'Left of matching line'), item('right', 'Right of matching line')] });
  q.puzzle('daughter', 'A Name Said Aloud', 'interrogation',
    'The doorman says Rosa carried a crescent-shaped lunch tin. The photograph shows that tin beside envelope 12. Which record checks his recollection against the payroll?',
    [item('photo', 'Shift photograph: crescent tin and envelope 12'), item('weather', 'That day\'s weather report')], ['photo'], { mode: 'unordered_ids' });
  q.choice('countermove', 'Orsini Changes the Rules', 'If you exposed his office stamp, Orsini now insists that only original records count. If you kept the source private, his men instead watch Ada\'s deliveries. Choose an available lead.', [
    { id: 'ordinary', label: 'Use the independently deposited archive original', nextNodeIds: ['original'] },
    { id: 'public', label: 'Challenge his new originals-only rule with the archive receipt', gates: [sagaFlag('early-obituary', 'protection', 'public')], nextNodeIds: ['originals-rule'] },
    { id: 'quiet', label: 'Use Ada\'s knowledge of the watched delivery schedule', gates: [sagaFlag('early-obituary', 'protection', 'quiet')], nextNodeIds: ['watched-delivery'] },
  ], { flagKey: 'response' });
  q.converge('countermove', 'archive', 'impressions', 'daughter');
  q.puzzle('original', 'Independent Custody', 'deduction', 'The archive receipt predates Orsini\'s removal order. Select the evidence establishing that his office did not supply this copy.', [item('receipt', 'Independent archive deposit receipt'), item('claim', 'Orsini\'s unsigned assurance')], ['receipt'], { mode: 'unordered_ids' });
  q.puzzle('originals-rule', 'His Own Standard', 'interrogation', 'Orsini demands an original. The archive custodian has the original deposit receipt, with its dated seal. Present it.', [item('seal', 'Custodian\'s original sealed receipt'), item('rumor', 'A rumor about the missing name')], ['seal'], { mode: 'unordered_ids' });
  q.puzzle('watched-delivery', 'The Cart He Watches', 'planning', 'Ada\'s watched bread cart leaves at noon; the archive\'s public reading room opens at eleven. Choose the route that needs no secret delivery.', [item('room', 'Meet Rosa in the public reading room at eleven'), item('cart', 'Put Rosa on the watched cart at noon')], ['room'], { mode: 'unordered_ids' });
  q.puzzle('identify', 'Who Belongs in the Missing Line?', 'deduction',
    'Three workers could occupy the omitted line. The signed wage receipts assign envelope 12 to Rosa, 11 to Mara, and 10 to Elena. Independently, the shift photograph shows the omitted worker carrying a crescent tin; the cloakroom register assigns that tin to Rosa, a square tin to Mara, and a round tin to Elena. File the inferred identity and the independent visual record corroborating it.',
    [item('rosa', 'Rosa'), item('mara', 'Mara'), item('elena', 'Elena'), item('photograph', 'Dated shift photograph, checked against cloakroom register'), item('rumor', 'Anonymous rumor about a missing daughter')],
    { identity: 'rosa', corroboration: 'photograph' }, { slots: [item('identity', 'Identity belonging to the missing line'), item('corroboration', 'Independent corroboration of the wage receipt')] });
  q.choice('identity', 'Who Owns the Corrected Record?', 'Rosa wants her wages and name restored, but does not want her new address published. The doorman asks to send a letter through the archive.', [
    { id: 'privacy', label: 'Restore her work record; keep her address private' },
    { id: 'letter', label: 'Restore the record and offer a mediated family letter' },
  ], { flagKey: 'rosa', flagKind: 'district_contact' });
  q.converge('identify', 'original', 'originals-rule', 'watched-delivery'); q.link('identify', 'identity');
  q.chain('opening', 'absence', 'method'); for (const target of ['archive', 'impressions', 'daughter']) q.link('method', target);
  for (const target of ['original', 'originals-rule', 'watched-delivery']) q.link('countermove', target); q.finish('identity'); return q.pack();
}

function viewpoints() {
  const q = quest('three-witnesses', 'Three Witnesses, One Room',
    'A banquet ended with a missing ledger. Revisit the same seven minutes as the waiter, the driver and Rosa. Each saw something true; none saw the whole room.', { minutes: 30, gates: [sagaFlag('missing-name', 'complete', 'filed')] });
  q.puzzle('waiter', '19:00 — The Waiter', 'scene',
    'As the waiter, you place the guest\'s blue coat on the left hook and the inspector\'s gray coat on the right. Put both where the cloakroom ticket says they belonged.',
    [item('blue', 'Guest\'s blue coat'), item('gray', 'Inspector\'s gray coat')], { left: 'blue', right: 'gray' }, { slots: [item('left', 'Left hook'), item('right', 'Right hook')] });
  q.evidence('coat', 'Waiter\'s Observed Detail', 'At 19:00 the blue coat hung left and the gray coat right. The waiter did not see the later exchange.', 'waiter', 'testimony');
  q.puzzle('driver', '19:04 — The Driver', 'timeline',
    'As the driver, you see the gray-coated passenger arrive at 19:04, exchange coats at 19:05, and leave wearing blue at 19:06. Put those observations in order.',
    [item('leave', '19:06 — passenger leaves in blue'), item('arrive', '19:04 — passenger arrives in gray'), item('swap', '19:05 — coats exchanged')], ['arrive', 'swap', 'leave']);
  q.evidence('swap-proof', 'Driver\'s Observed Detail', 'A coat changed owners before departure. Coat color alone cannot identify the departing person.', 'driver', 'testimony');
  q.puzzle('rosa', '19:07 — Rosa', 'interrogation',
    'As Rosa, you inspect the left-behind gray coat. Its inside pocket holds Orsini\'s office key, while its outside pocket holds a borrowed guest ticket. Which object identifies its habitual owner?',
    [item('key', 'Office key with Orsini\'s engraved tag'), item('ticket', 'Borrowed guest ticket')], ['key'], { mode: 'unordered_ids' });
  q.puzzle('combined', 'A Person Is Not a Coat', 'deduction',
    'Connect each conclusion to the independent record supporting it. One record establishes that a coat changed owners; another identifies the habitual owner of the gray coat. Color alone establishes neither conclusion.',
    [item('exchange', 'Driver\'s timed coat exchange'), item('key', 'Engraved office key in gray coat'), item('color', 'An assumption that colors identify people')],
    { 'changed-owner': 'exchange', 'habitual-owner': 'key' }, { slots: [item('changed-owner', 'The coat changed owners before departure'), item('habitual-owner', 'Orsini habitually owned the gray coat')] });
  q.choice('account', 'File the Limits of Each Account', 'The witnesses agree once you distinguish observation from assumption. What will the file emphasize?', [
    { id: 'corroboration', label: 'The corroborated coat exchange' }, { id: 'limits', label: 'The limits of each honest witness\'s view' },
  ], { flagKey: 'finding', flagKind: 'case_evidence' });
  q.chain('opening', 'waiter', 'driver', 'rosa', 'combined', 'account'); q.finish('account'); return q.pack();
}

function wedding() {
  const q = quest('quiet-wedding', 'Nothing Happened at the Wedding',
    'A witness must leave a wedding safely while the guests enjoy an ordinary evening. Case the venue, choose a cover, and preserve the appearance of a routine delivery.', { minutes: 35, gates: [sagaFlag('three-witnesses', 'complete', 'filed')], commitments: ['Failed cover attempts open a negotiation route. No player property is at risk.'] });
  q.puzzle('case-venue', 'Read Before You Enter', 'deduction',
    'The public schedule lists the band loading through the east door at 20:00, dinner at 20:15, and a watched main entrance throughout. Select the useful delivery opportunity.',
    [item('east', 'East band entrance at 20:00'), item('main', 'Watched main entrance at any hour'), item('kitchen', 'Unverified rumor of a kitchen tunnel')], ['east'], { mode: 'unordered_ids' });
  q.choice('cover', 'Choose the Plan', 'You can join the band\'s load-out or carry the signed florist order. Each plan requires different preparation.', [
    { id: 'band', label: 'Prepare the band\'s equipment route', nextNodeIds: ['band-plan'] },
    { id: 'flowers', label: 'Prepare the florist\'s scheduled delivery', nextNodeIds: ['flower-plan'] },
  ], { flagKey: 'cover' });
  q.puzzle('band-plan', 'Cases With a Purpose', 'inventory', 'A marked equipment case holds the witness\'s ordinary coat. A trolley moves it without blocking guests. Match those items to their stated uses.',
    [item('case', 'Marked equipment case'), item('trolley', 'Band trolley'), item('glass', 'Champagne glass')], { coat: 'case', transport: 'trolley' }, { slots: [item('coat', 'Carry the ordinary coat'), item('transport', 'Move equipment safely')] });
  q.puzzle('flower-plan', 'An Order That Checks Out', 'scene', 'The florist order assigns white flowers to table 2 and blue flowers to table 5. Arrange the delivery as written to maintain a credible cover.',
    [item('white', 'White flowers'), item('blue', 'Blue flowers')], { table2: 'white', table5: 'blue' }, { slots: [item('table2', 'Table 2'), item('table5', 'Table 5')] });
  for (const route of [
    { id: 'band', plan: 'band-plan', proof: 'docket', label: 'Signed band load-out docket, east door 20:00',
      prompt: 'Your equipment plan uses the east door at 20:00. The usher asks for the signed band load-out docket matching that schedule. A florist order covers a different entrance and cannot support your chosen cover.',
      scenePrompt: 'Maintain the band plan you prepared: keep the program on the noticeboard, put the tagged equipment case on its trolley, and leave the coat hanger in the cloakroom. The inspector will check this particular equipment movement.',
      sceneItems: [item('program', 'Band program'), item('case', 'Tagged equipment case'), item('hanger', 'Empty coat hanger')],
      sceneSolution: { board: 'program', trolley: 'case', cloakroom: 'hanger' },
      slots: [item('board', 'Noticeboard'), item('trolley', 'Band trolley'), item('cloakroom', 'Cloakroom')],
      inspection: 'The inspector checks the equipment case you placed on the trolley against the scheduled band departure. Select the signed load-out docket and matching case tag. A florist invoice cannot explain this scene.',
      records: [item('docket', 'Signed east-door band docket, 20:00'), item('tag', 'Case tag matching the trolley load'), item('flowers', 'Unrelated florist invoice')], solution: ['docket', 'tag'] },
    { id: 'flower', plan: 'flower-plan', proof: 'order', label: 'Signed florist order, service door 19:45',
      prompt: 'Your florist plan uses the service door at 19:45. The usher asks for the signed florist order listing the table deliveries. The band\'s later east-door docket cannot support your chosen cover.',
      scenePrompt: 'Maintain the florist plan you prepared: white flowers stay on table 2, blue flowers on table 5, and the signed order stays with the service-door porter. The inspector will compare these placements to the order.',
      sceneItems: [item('white', 'White flowers'), item('blue', 'Blue flowers'), item('order', 'Signed florist order')],
      sceneSolution: { table2: 'white', table5: 'blue', porter: 'order' },
      slots: [item('table2', 'Table 2'), item('table5', 'Table 5'), item('porter', 'Service-door porter')],
      inspection: 'The inspector checks the flower placements you constructed against the porter\'s signed order: white on table 2, blue on table 5. Select the two records supporting this scene. Band equipment records cannot explain the florist delivery.',
      records: [item('order', 'Signed florist order: table 2 white, table 5 blue'), item('tables', 'Porter\'s checked delivery record matching both tables'), item('band', 'Unrelated band equipment docket')], solution: ['order', 'tables'] },
  ]) {
    const test = `${route.id}-cover-test`, recovery = `${route.id}-usher-talk`, scene = `${route.id}-decoy`, inspection = `${route.id}-inspection`;
    q.puzzle(test, 'The Usher Tests Your Chosen Cover', 'stealth', route.prompt,
      [item(route.proof, route.label), item('gossip', 'Claim that you know the groom'), item('card', 'Unsigned calling card')], [route.proof],
      { mode: 'unordered_ids', extra: { suspicion: { onWrong: 1, max: 2 }, successNextNodeIds: [scene], failForward: { afterAttempts: 2, nextNodeId: recovery, summary: 'Your cover draws attention. The usher agrees to hear a direct request about this route.' } } });
    q.puzzle(recovery, 'Ask the Usher for Supervised Help', 'planning', `The ${route.id === 'band' ? 'equipment' : 'florist'} cover drew attention. The usher wants guests safe and the ceremony uninterrupted. A supervised service-door exit satisfies both. A fire-alarm diversion does not.`,
      [item('supervised', 'Supervised quiet service-door exit'), item('alarm', 'Trigger a false alarm')], ['supervised'], { mode: 'unordered_ids' });
    q.puzzle(scene, 'Construct the Scene Your Plan Requires', 'scene', route.scenePrompt, route.sceneItems, route.sceneSolution, { slots: route.slots, extra: { unlockMode: 'any' } });
    q.evidence(`${route.id}-scene-record`, 'The Constructed Scene', route.scenePrompt, scene);
    q.puzzle(inspection, 'The Inspector Tests Your Constructed Scene', 'deduction', route.inspection, route.records, route.solution, { mode: 'unordered_ids' });
    q.chain(route.plan, test); q.link(test, scene); q.link(test, recovery); q.link(recovery, scene); q.chain(scene, inspection);
  }
  q.choice('rescue', 'What the Guests Remember', 'The witness is safe. You can quietly tell the couple why the usher helped, or leave their evening entirely their own.', [
    { id: 'explain', label: 'Explain privately after the ceremony' }, { id: 'ordinary', label: 'Let them remember an ordinary wedding' },
  ], { flagKey: 'aftermath', extra: { unlockMode: 'any' } });
  q.chain('opening', 'case-venue', 'cover'); q.link('cover', 'band-plan'); q.link('cover', 'flower-plan'); q.link('band-inspection', 'rescue'); q.link('flower-inspection', 'rescue'); q.finish('rescue'); return q.pack();
}

function morning() {
  const q = quest('morning-after', 'When the Shop Opens Again',
    'Return to Tomas and Ada after the forged obituary. The shop window and their next request depend on how you protected them. The file is personal to your own history.', { minutes: 20, gates: [sagaFlag('early-obituary', 'complete', 'filed')], difficulty: 'Intermediate' });
  q.choice('return', 'What Kind of Morning?', 'Read the consequence of your earlier decision, or investigate the public correction if this is your first encounter with the family.', [
    { id: 'new', label: 'Review the public correction', nextNodeIds: ['correction'] },
    { id: 'public', label: 'Visit Tomas\'s reopened shop while Ada is away', gates: [sagaFlag('early-obituary', 'protection', 'public')], nextNodeIds: ['reopened'] },
    { id: 'quiet', label: 'Help Ada prepare for Tomas\'s return from temporary closure', gates: [sagaFlag('early-obituary', 'protection', 'quiet')], nextNodeIds: ['shuttered'] },
  ], { flagKey: 'visit' });
  q.puzzle('correction', 'A Correction With a Source', 'deduction', 'The correction names the dated original notice and the verified appearance of Tomas alive. Choose the verifiable observation rather than the rumor.', [item('alive', 'Dated appearance of Tomas alive'), item('rumor', 'Rumor that the notice was a joke')], ['alive'], { mode: 'unordered_ids' });
  q.puzzle('reopened', 'A Window Lit Again', 'scene', 'Tomas has reopened. Ada\'s forwarding letters belong behind the counter, not on the public noticeboard. Place the open sign in the window and private letters behind the counter.', [item('sign', 'Open sign'), item('letters', 'Ada\'s private forwarding letters')], { window: 'sign', counter: 'letters' }, { slots: [item('window', 'Shop window'), item('counter', 'Behind the counter')] });
  q.puzzle('shuttered', 'A Door Ready to Open', 'planning', 'Tomas must approve reopening; Ada has already checked the locks. Arrange the remaining steps: ask Tomas, receive his approval, turn the open sign.', [item('sign', 'Turn open sign'), item('ask', 'Ask Tomas'), item('approval', 'Receive Tomas\'s approval')], ['ask', 'approval', 'sign']);
  q.choice('friendship', 'Help Without Keeping Score', 'Ada asks you to deliver a personal letter, with no fee or influence attached. Someone who promised friendship at dinner can hear why the reply matters.', [
    { id: 'deliver', label: 'Deliver the sealed letter without reading it' },
    { id: 'listen', label: 'Hear Ada\'s worries as a friend, then deliver it', gates: [sagaFlag('family-dinner', 'relationship', 'friend')] },
  ], { flagKey: 'trust', flagKind: 'npc_ally' });
  q.converge('friendship', 'correction', 'reopened', 'shuttered'); q.link('opening', 'return'); for (const target of ['correction', 'reopened', 'shuttered']) q.link('return', target); q.finish('friendship'); return q.pack();
}

function inherited() {
  const q = quest('inherited-file', 'The File They Left Behind',
    'A family case file contains an unfinished accusation against Rosa. The notes and account-owned evidence survive a change of character. Check the predecessor\'s assumptions before deciding what the family record should say.', { minutes: 25, gates: [sagaFlag('missing-name', 'complete', 'filed')] });
  q.puzzle('old-notes', 'A Pencil Mark Is Not a Verdict', 'deduction', 'The old investigator underlined Rosa\'s name but supplied no observation. Rosa\'s signed shift card places her at work; a dated ferry ticket places the courier at the archive. Which record actually tests Rosa\'s alibi?', [item('shift', 'Rosa\'s signed shift card'), item('underline', 'Unexplained pencil underline'), item('ferry', 'Courier\'s ferry ticket')], ['shift'], { mode: 'unordered_ids' });
  q.puzzle('reconstruct', 'What the Family Did Not Know', 'timeline', 'The family note was written on 4 May. The corrected payroll was deposited on 5 May. Rosa\'s reply arrived on 6 May. Reconstruct why the old file lacked her explanation.', [item('reply', '6 May: Rosa\'s reply'), item('note', '4 May: family note'), item('payroll', '5 May: corrected payroll')], ['note', 'payroll', 'reply']);
  q.choice('legacy', 'The Family Record', 'You can correct the accusation openly, preserving the original mistake beside the evidence, or privately amend the family file with an explanation to Rosa.', [
    { id: 'open', label: 'Record both the error and its correction' }, { id: 'private', label: 'Amend the file and explain the change to Rosa' },
  ], { flagKey: 'legacy', flagKind: 'public_reputation' });
  q.chain('opening', 'old-notes', 'reconstruct', 'legacy'); q.finish('legacy'); return q.pack();
}

function archiveService() {
  const q = quest('archive-service', 'The Back Room of the Archive',
    'The completed early-obituary case memento identifies you to the archive custodian. Use the newly available reading room to practice checking an anonymous witness account against dated records.',
    { minutes: 15, difficulty: 'Intermediate', gates: [{ kind: 'collectible_owned', collectibleId: 'saga-early-obituary-memento' }] });
  q.puzzle('keepsake', 'A Familiar Fold in the Paper', 'interrogation', 'The custodian recognizes your filed case memento. A witness says the archive was closed all day, but its signed visitor book records an 11:00 reading. Present the record that checks the claim.', [item('visitors', 'Signed visitor book, 11:00'), item('opinion', 'Your opinion that the witness is wrong')], ['visitors'], { mode: 'unordered_ids' });
  q.puzzle('practice', 'The Custodian\'s Exercise', 'deduction', 'A room can be open without every visitor meeting every other visitor. The book confirms presence, while an unsigned note claims a meeting. File only the confirmed fact.', [item('presence', 'The signed visitor was present'), item('meeting', 'An uncorroborated meeting occurred')], ['presence'], { mode: 'unordered_ids' });
  q.choice('access', 'A Place to Work', 'The custodian offers you future access to the casework reading desk. It is a narrative service with further exercises, not a source of cash or combat advantage.', [
    { id: 'accept', label: 'Accept access to the casework reading desk', value: 'open' }, { id: 'letter', label: 'Accept access and leave a thank-you letter', value: 'open' },
  ], { flagKey: 'reading-desk' });
  q.chain('opening', 'keepsake', 'practice', 'access'); q.finish('access'); return q.pack();
}

function sixthEnvelope() {
  const q = quest('sixth-envelope', 'The Sixth Envelope',
    'A clerk and courier each hold half of a delivery explanation. Work at different times, share only the evidence you choose to put in the case notes, and settle your private promises before the handoff.',
    { minutes: 30, roles: ['clerk', 'courier'], group: 'Two members of one Crew or Extended Family', commitments: ['Each role has a private objective requiring explicit consent.', 'Releasing a seat preserves contributions but gives up current membership and future self-claim rights.'] });
  q.nodes.find(node => node.id === 'party-policy').payload.allowRoleReplacement = true;
  q.nodes.find(node => node.id === 'clerk').payload.privateAgenda = { prompt: 'Your source asked you to retain the carbon copy. Choose preserve when filing the clerk\'s records.', consentRequired: true, completionNodeId: 'clerk-oath', choiceId: 'preserve' };
  q.nodes.find(node => node.id === 'courier').payload.privateAgenda = { prompt: 'Your witness asked to remain anonymous in the courier\'s note. Choose anonymous when recording the route.', consentRequired: true, completionNodeId: 'courier-oath', choiceId: 'anonymous' };
  q.puzzle('manifest', 'The Clerk\'s Half', 'deduction', 'Your private manifest assigns the sixth envelope a triangle seal. The handwritten word blue names the wrapping paper, not the seal. Select the seal recorded by the signed manifest.',
    [item('triangle', 'Triangle seal'), item('circle', 'Circle seal'), item('blue', 'Blue wrapping paper')], ['triangle'], { role: 'clerk', mode: 'unordered_ids' });
  q.puzzle('door-map', 'The Courier\'s Half', 'scene', 'Your private door map places triangle-sealed deliveries at Bay Seven and circle-sealed deliveries at Bay Nine. Copy both assignments into your route file.',
    [item('seven', 'Bay Seven'), item('nine', 'Bay Nine')], { triangle: 'seven', circle: 'nine' },
    { role: 'courier', slots: [item('triangle', 'Triangle seal'), item('circle', 'Circle seal')] });
  q.add('private-manifest', 'evidence', { title: 'Private manifest fragment', summary: 'The sixth envelope has a triangle seal. Blue describes only its wrapping.', shareScope: 'role_private', roleId: 'clerk', evidenceKind: 'fact' });
  q.link('manifest', 'private-manifest', 'REVEALS');
  q.add('private-map', 'evidence', { title: 'Private route fragment', summary: 'Triangle seals belong at Bay Seven. Circle seals belong at Bay Nine.', shareScope: 'role_private', roleId: 'courier', evidenceKind: 'fact' });
  q.link('door-map', 'private-map', 'REVEALS');
  q.choice('clerk-oath', 'The Carbon Copy', 'Your role owns this filing decision. The other participant will learn your private objective only in the final debrief.', [
    { id: 'preserve', label: 'Preserve the carbon copy in sealed custody' }, { id: 'discard', label: 'Discard the duplicate after recording its contents' },
  ], { role: 'clerk', flagKey: 'carbon', flagKind: 'case_evidence' });
  q.choice('courier-oath', 'The Witness Name', 'Your role owns the witness-note decision. You can share the routing evidence without naming the person who supplied it.', [
    { id: 'anonymous', label: 'Record the route without the witness\'s name' }, { id: 'named', label: 'Record the witness by name' },
  ], { role: 'courier', flagKey: 'witness', flagKind: 'witness_spared' });
  q.puzzle('combined-route', 'A Route Neither Half Can Prove', 'deduction', 'Combine the clerk\'s manifest with the courier\'s door map. Ask your partner to leave an interpretation in the shared notes. Which bay takes the sixth envelope?',
    [item('seven', 'Bay Seven'), item('nine', 'Bay Nine'), item('unknown', 'The wrapping-paper color determines the bay')], ['seven'], { role: 'clerk', mode: 'unordered_ids' });
  q.choice('handoff', 'Two Accounts, One Handoff', 'Both accounts remain in the file. Close with a signed joint receipt or a sealed archive receipt; the debrief will reveal what each participant privately promised.', [
    { id: 'joint', label: 'Sign the joint handoff receipt' }, { id: 'archive', label: 'Seal the handoff with the archive' },
  ], { role: 'clerk', flagKey: 'handoff' });
  q.link('opening', 'manifest'); q.link('opening', 'door-map');
  q.chain('manifest', 'clerk-oath', 'combined-route'); q.chain('door-map', 'courier-oath', 'combined-route');
  q.chain('combined-route', 'handoff'); q.finish('handoff'); return q.pack();
}

function rivalAccord() {
  const q = quest('rival-accord', 'The Receipt Between Two Houses',
    'Two organizations receive incompatible accounts of a fictional warehouse dispute. Only explicitly invited participants enter this case. Each side retains its own organization and must consent to its role.',
    { minutes: 30, roles: ['mediator', 'delegate'], group: 'Two explicitly invited members from distinct Crews', commitments: ['All participants opt in.', 'The dispute moves no territory, money, inventory or player liabilities.'] });
  const policy = q.nodes.find(node => node.id === 'party-policy').payload;
  policy.organizationScopes = ['invitation']; policy.invitation = { organizationKind: 'crew', maxInvitees: 3 };
  q.nodes.find(node => node.id === 'party-quorum').payload.minimumOrganizations = 2;
  q.puzzle('house-ledger', 'The First House\'s Receipt', 'deduction', 'The first house claims ownership because its receipt says purchased. The same signed receipt specifies twelve crates, while the dispute concerns one borrowed press. Which detail limits that claim?',
    [item('crates', 'The receipt purchases twelve crates'), item('word', 'The word purchased by itself')], ['crates'], { role: 'mediator', mode: 'unordered_ids' });
  q.puzzle('loan-record', 'The Second House\'s Record', 'interrogation', 'The second house calls the press a gift, but its signed ledger says return after restoration. Present the term that checks the claim.',
    [item('return', 'Signed term: return after restoration'), item('gift', 'An unsigned note calling it a gift')], ['return'], { role: 'delegate', mode: 'unordered_ids' });
  q.choice('offer', 'Propose a Settlement', 'Both documents establish that the press was borrowed. Offer either a supervised return with a public correction, or a sealed return with an acknowledgement to both houses.', [
    { id: 'public', label: 'Offer a supervised return and public correction', nextNodeIds: ['public-response'] },
    { id: 'sealed', label: 'Offer a sealed return and joint acknowledgement', nextNodeIds: ['sealed-response'] },
  ], { role: 'mediator', flagKey: 'offer' });
  q.choice('public-response', 'The Other House Answers Publicly', 'The mediator offered a public correction. Your side may accept, or request that the witness\'s name be withheld from it.', [
    { id: 'accept', label: 'Accept the public correction', nextNodeIds: ['public-close'] },
    { id: 'counter', label: 'Counteroffer: publish the finding without naming the witness', nextNodeIds: ['reconcile'] },
  ], { role: 'delegate' });
  q.choice('sealed-response', 'The Other House Answers Privately', 'The mediator offered a sealed return. Your side may accept, or ask that both houses receive identical copies of the acknowledgement.', [
    { id: 'accept', label: 'Accept the sealed return', nextNodeIds: ['sealed-close'] },
    { id: 'counter', label: 'Counteroffer: both houses receive identical acknowledgements', nextNodeIds: ['reconcile'] },
  ], { role: 'delegate' });
  q.choice('reconcile', 'Answer the Counteroffer', 'The delegate has requested protection of the witness or equal copies of the acknowledgement. Neither condition changes ownership or adds a payment. Choose how to record agreement.', [
    { id: 'agree', label: 'Accept the requested protection and equal record' }, { id: 'archive', label: 'Ask the neutral archive to hold the agreed record' },
  ], { role: 'mediator', flagKey: 'counteragreement', extra: { unlockMode: 'any' } });
  q.choice('public-close', 'A Public Correction Agreed', 'Both parties accepted the correction. Record the agreed fictional return; this grants no authority over player assets.', [
    { id: 'file', label: 'File the joint public receipt' }, { id: 'copy', label: 'File the receipt and give both houses a copy' },
  ], { role: 'mediator', flagKey: 'public-agreement' });
  q.choice('sealed-close', 'A Sealed Return Agreed', 'Both parties accepted the sealed return. Record the agreed fictional return; this grants no authority over player assets.', [
    { id: 'file', label: 'File the sealed receipt' }, { id: 'copy', label: 'File the receipt and give both houses a copy' },
  ], { role: 'mediator', flagKey: 'sealed-agreement' });
  q.link('opening', 'house-ledger'); q.link('opening', 'loan-record'); q.link('house-ledger', 'offer'); q.link('loan-record', 'offer');
  q.link('offer', 'public-response'); q.link('offer', 'sealed-response');
  q.link('public-response', 'public-close'); q.link('public-response', 'reconcile'); q.link('sealed-response', 'sealed-close'); q.link('sealed-response', 'reconcile');
  q.finish('public-close'); q.finish('sealed-close'); q.finish('reconcile');
  q.nodes.find(node => node.id === 'case-reward').payload.unlockMode = 'any';
  return q.pack();
}

export const QUEST_SAGA_PACKS = Object.freeze([
  obituary(), dinner(), missingName(), viewpoints(), wedding(), morning(), inherited(), archiveService(), sixthEnvelope(), rivalAccord(),
]);
