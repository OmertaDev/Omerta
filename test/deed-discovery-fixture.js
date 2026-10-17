import assert from 'node:assert/strict';

// Follow only server-issued objectives and real travel/investigation actions. Client/receipt
// fixtures cannot silently retain free claims or manufacture property evidence.
export async function earnBuildingClaim(app, token, buildingId) {
  const headers = { authorization: `Bearer ${token}` };
  const district = buildingId.split('-')[0];
  for (let step = 1; step <= 4; step++) {
    const board = (await app.inject({ method: 'GET', url: '/v1/deeds/discovery?district=' + district, headers })).json();
    const objective = board.buildings.find(building => building.id === buildingId)?.objective;
    assert(objective?.actionId, 'Each property objective is issued by the server.');
    if (board.currentDistrict !== objective.requiredDistrict) {
      const travel = await app.inject({ method: 'POST', url: '/v1/travel/' + objective.requiredDistrict, headers, payload: {} });
      assert.equal(travel.statusCode, 200, `Discovery travel: ${travel.body}`);
    }
    const result = await app.inject({ method: 'POST', url: '/v1/deeds/investigate', headers,
      payload: { buildingId, actionId: objective.actionId } });
    assert.equal(result.statusCode, 200, `Discovery fixture step ${step}: ${result.body}`);
    assert.equal(result.json().steps, step);
  }
  return buildingId;
}
