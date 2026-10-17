// OFF-REPO canonical content proposal. Not imported by the current registry/runtime.
const f=Object.freeze;
export const EQUIPMENT_RECOVERY_PACKAGE=f({
  id:'equipment-recovery',version:1,season:'core',
  dependsOn:f(['core-materials','automotive-salvage']),
  nodes:f([f({id:'recipe:recover_worn_precision_tool',type:'recipe',version:1,
    visibility:'public',repeatability:'repeatable',
    consumes:f([f({templateId:'item:precision_lock_tool',quantity:1})]),
    produces:f([f({templateId:'mat:salvage_parts',quantity:1,quality:'standard'})]),
    conditions:f([f({adapter:'location',value:'foundry'}),f({adapter:'level',minimumLevel:8}),f({adapter:'skill',skillId:'fence_network'})]),
    metadata:f({title:'Recover a Worn Precision Tool'}),
  })]),
});
