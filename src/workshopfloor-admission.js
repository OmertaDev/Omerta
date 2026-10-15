// Fixed canonical admission leaves defer the floor module until a real mutation.
export async function assertWorkshopFloorBeforeCraft(c,ctx,token){return (await import('./workshopfloor.js')).assertWorkshopFloorBeforeCraft(c,ctx,token);}
export async function assertWorkshopFloorStorage(c,ctx,token){return (await import('./workshopfloor.js')).assertWorkshopFloorStorage(c,ctx,token);}
export async function assertWorkshopFloorLease(c,ctx,token){return (await import('./workshopfloor.js')).assertWorkshopFloorLease(c,ctx,token);}
export async function assertWorkshopFloorService(c,ctx,token){return (await import('./workshopfloor.js')).assertWorkshopFloorService(c,ctx,token);}
