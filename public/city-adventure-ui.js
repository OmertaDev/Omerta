(function () {
  'use strict';
  const list=value=>Array.isArray(value)?value.slice(0,108):[];
  function el(tag,text,className){const node=document.createElement(tag);if(text!=null)node.textContent=String(text);if(className)node.className=className;return node;}
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
        card.append(el('strong',active.name),el('p','Round '+(active.turn+1)+'/'+active.roundLimit+' · Enemy intent: '+active.intent),
          el('p','Drill health '+active.health+'/'+active.maxHealth+' · Stamina '+active.stamina+'/10 · Enemy '+active.enemyHealth+'/'+active.enemyMaxHealth),el('p',active.last));
        const choices=el('div',null,'city-world__emotes');for(const action of list(active.actions))choices.append(issued(action));card.append(choices);root.append(card);
        hint('Strike spends stamina. Guard recovers it. Feint works best against a brace; negotiation uses Fast Talker or a weakened opponent.');
      }else for(const scenario of list(encounters.scenarios)){const card=el('section',null,'city-world__card');card.append(el('strong',scenario.name),el('p',scenario.description),issued(scenario.action));root.append(card);}
      if(list(encounters.history).length){const last=encounters.history[0];root.append(el('p',last.name+' · '+last.status+' · '+last.last,'city-world__hint'));}
      for(const clue of list(encounters.clues)){const card=el('section',null,'city-world__card');card.dataset.cityEncounterClue=clue.scenarioId;card.append(el('strong',clue.title),el('p',clue.text));root.append(card);}
    }
    if(index){
      root.append(el('h4','People with a story'));hint('Relationships are private to your current character. These are actual district NPCs; map placement remains illustrative.');
      if(!list(index.npcs).length)hint('No available NPC is published here. Explore another district through the World Map.');
      for(const npc of list(index.npcs)){
        const card=el('section',null,'city-world__card');card.append(el('strong',npc.name),el('p',(npc.tier||'stranger')+' · Favors '+npc.favor+'/3'));
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
