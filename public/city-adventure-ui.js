(function () {
  'use strict';
  const list=value=>Array.isArray(value)?value.slice(0,108):[];
  function el(tag,text,className){const node=document.createElement(tag);if(text!=null)node.textContent=String(text);if(className)node.className=className;return node;}
  const stages=new WeakMap();
  const intentions={strike:['Strike incoming','A direct attack is coming. Guard reduces the impact.'],
    brace:['Opponent bracing','The opponent will defend instead of attack. A feint can break the guard.'],
    pressure:['Pressure incoming','A lighter attack is coming. Recover stamina or press your advantage.']};
  const tactics={strike:'A direct hit. Bracing reduces its damage; momentum from guarding strengthens it.',
    guard:'Recover stamina up to its cap, reduce incoming damage and build momentum for your next strike.',
    feint:'Strong against a brace. Cunning improves the hit and, when trained enough, reduces the reply.',
    negotiate:'End the drill with a truce. Requires Fast Talker or an opponent at half drill health or lower.',
    retreat:'Leave this drill immediately. Your core health, cash and equipment stay unchanged.'};
  function stage(root,board,encounter){
    const scope=[board.viewer?.characterId,board.viewer?.generation,board.viewer?.district].join(':');
    const previous=stages.get(root),changed=previous?.scope===scope&&previous.id===encounter.id&&encounter.revision>previous.revision;
    if(previous?.scope!==scope||previous.id!==encounter.id||encounter.revision>=previous.revision)stages.set(root,{scope,id:encounter.id,revision:encounter.revision});
    const arena=el('section',null,'city-drill');arena.dataset.cityDrill=encounter.id;arena.dataset.cityDrillRevision=String(encounter.revision);
    arena.setAttribute('aria-label',encounter.name+' tactical drill');
    if(changed)arena.classList.add('is-resolved');
    const cue=intentions[encounter.intent];
    const heading=el('div',null,'city-drill__heading');
    heading.append(el('strong',encounter.name),el('span',encounter.status==='active'?'Round '+(encounter.turn+1)+'/'+encounter.roundLimit:encounter.status));
    arena.append(heading);
    const scene=el('div',null,'city-drill__stage');scene.setAttribute('aria-hidden','true');
    const player=el('img',null,'city-drill__player');player.src='/art/city-player-right-v1.png';player.alt='';
    const opponent=el('img',null,'city-drill__opponent');opponent.src='/art/city-worker-v1.png';opponent.alt='';
    const signal=el('span',cue?.[0]||'Drill complete','city-drill__signal');
    scene.dataset.intent=cue?encounter.intent:'complete';scene.append(player,signal,opponent);arena.append(scene);
    const stats=el('div',null,'city-drill__stats');
    for(const [label,value,max] of [['Your drill health',encounter.health,encounter.maxHealth],['Stamina',encounter.stamina,10],['Opponent drill health',encounter.enemyHealth,encounter.enemyMaxHealth]]){
      const group=el('div');group.append(el('span',label),el('strong',value+'/'+max));
      const meter=el('meter');meter.min=0;meter.max=max;meter.value=value;meter.setAttribute('aria-label',label);group.append(meter);stats.append(group);
    }
    arena.append(stats);
    if(cue)arena.append(el('p',cue[1],'city-drill__intent'));
    if(encounter.last)arena.append(el('p',encounter.last,'city-drill__result'));
    arena.append(el('small','Practice only · separate drill health and stamina. Core health, money and equipment are unchanged.'));
    return arena;
  }
  function render(root,{encounters,index,detail,pending,onRead,onAction,onCrew,onBind}){
    const button=(label,handler,disabled=false)=>{const node=el('button',label);node.type='button';node.disabled=pending||disabled;onBind(node,'click',handler);return node;};
    const hint=text=>root.append(el('p',text,'city-world__hint'));
    const issued=action=>{const node=button(action.label,()=>onAction(action),action.available!==true);node.dataset.cityAdventureAction=action.id;
      if(list(action.blockedBy).length)node.title=list(action.blockedBy).map(reason=>reason.message||reason.code||String(reason)).join(' · ');return node;};
    root.append(el('h4','District adventures'));
    const controls=el('div',null,'city-world__emotes');controls.append(button('Refresh encounters',()=>onRead('encounters')),
      button('NPC favors & discoveries',()=>onRead('opportunities')),button('Crew mission board',()=>onCrew()));root.append(controls);
    if(encounters){
      hint(encounters.description);
      const active=encounters.active;
      if(active){
        const card=el('section',null,'city-world__card');card.dataset.cityEncounter=active.id;
        card.append(stage(root,encounters,active));
        const choices=el('div',null,'city-drill__moves');for(const action of list(active.actions)){
          const choice=el('div',null,'city-drill__move'),control=issued(action);choice.append(control);
          if(tactics[action.id])choice.append(el('p',tactics[action.id]));
          if(list(action.blockedBy).length)choice.append(el('p',list(action.blockedBy).map(reason=>({encounter_stamina:'Recover stamina with Guard first.',
            weaken_or_learn_fast_talker:'Weaken this opponent or learn Fast Talker.',return_to_encounter_district:'Return to the encounter district, or retreat here.'}[reason.code]||'Refresh the encounter to check this move.')).join(' '),'city-drill__blocked'));
          choices.append(choice);
        }card.append(choices);root.append(card);
      }else for(const scenario of list(encounters.scenarios)){const card=el('section',null,'city-world__card');card.append(el('strong',scenario.name),el('p',scenario.description),issued(scenario.action));root.append(card);}
      if(list(encounters.history).length){const last=encounters.history[0];if(!active)root.append(stage(root,encounters,last));else root.append(el('p',last.name+' · '+last.status+' · '+last.last,'city-world__hint'));}
      for(const clue of list(encounters.clues)){const card=el('section',null,'city-world__card');card.dataset.cityEncounterClue=clue.scenarioId;card.append(el('strong',clue.title),el('p',clue.text));root.append(card);}
    }
    if(index){
      root.append(el('h4','People with a story'));hint('Relationships are private to your current character. These are actual district NPCs; map placement remains illustrative.');
      if(!list(index.npcs).length)hint('No available NPC is published here. Explore another district through the World Map.');
      for(const npc of list(index.npcs)){
        const card=el('section',null,'city-world__card');card.append(el('strong',npc.name),el('p',(npc.tier||'stranger')+' · Favors '+npc.favor+'/3'));
        const memories=['We have not spoken properly. There is a note I could use a careful pair of eyes on.', 'You brought my corrected note back. I remember who takes the trouble.', 'You stayed to put my account straight. There is more I can trust you with now.', 'Three times you kept faith with me. The marked route is yours to follow.'];
        card.append(el('p',npc.name+': '+memories[Math.max(0,Math.min(3,Math.floor(Number(npc.favor)||0)))],'city-world__npc-memory'));
        for(const opportunity of list(index.opportunities).filter(entry=>entry.npcId===npc.id)){
          const entry=el('div',null,'city-world__opportunity');entry.append(el('strong',opportunity.title),el('p',opportunity.description));
          if(list(opportunity.blockedBy).length)entry.append(el('p',list(opportunity.blockedBy).map(reason=>reason.message||reason.code||String(reason)).join(' · ')));
          entry.append(button('Inspect '+opportunity.title,()=>onRead('opportunity-detail',{npcId:npc.id,graphRef:opportunity.graphRef})));card.append(entry);
        }
        root.append(card);
      }
    }
    if(detail){
      const card=el('section',null,'city-world__card');card.dataset.cityOpportunityDetail=detail.graph.id;
      card.append(el('h4',detail.graph.title),el('p',detail.npc.name+' · '+detail.relationship.tier+' · '+detail.graph.status));
      for(const action of list(detail.actions))card.append(issued(action));
      for(const node of list(detail.nodes)){
        const entry=el('section',null,'city-world__opportunity');entry.append(el('strong',node.title),el('p',node.status));
        if(node.description)entry.append(el('p',node.description));if(node.dialogue)entry.append(el('p',node.dialogue));
        for(const action of list(node.actions))entry.append(issued(action));card.append(entry);
      }
      card.append(button('Refresh this story',()=>onRead('opportunity-detail',{npcId:detail.npc.id,graphRef:detail.graph.id})));root.append(card);
    }
  }
  window.CityAdventureUi=Object.freeze({render});
})();
