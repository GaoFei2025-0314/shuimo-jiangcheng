const { test, expect, ready } = require('./fixtures.cjs');

function neighbouringPairs(placements, distance) {
  let total = 0, repeated = 0;
  for (let i = 0; i < placements.length; i++) {
    const a = placements[i];
    for (let j = 0; j < i; j++) {
      const b = placements[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) >= distance) continue;
      total++;
      if (a.variant === b.variant) repeated++;
    }
  }
  return { total, repeated };
}

test('neighbouring houses use different variants', async ({ page }) => {
  await ready(page);
  const houses = await page.evaluate(() => {
    const batches = new Set(), kinds = {};
    for (const mesh of window.__testScene.children) {
      const { authoredMatrices, cityVariant } = mesh.userData;
      if (!mesh.name.startsWith('City / ') || !authoredMatrices || batches.has(authoredMatrices)) continue;
      batches.add(authoredMatrices);
      const kind = mesh.name.slice('City / '.length);
      const placements = kinds[kind] ||= [];
      for (let i = 0; i < authoredMatrices.length; i += 16) {
        placements.push({ x: authoredMatrices[i + 12], z: authoredMatrices[i + 14], variant: cityVariant ?? kind });
      }
    }
    return kinds;
  });
  expect(Object.fromEntries(Object.entries(houses).map(([kind, placements]) =>
    [kind, new Set(placements.map(p => p.variant)).size]))).toEqual({
    lane: 3, arcade: 3, apartment: 3, wharf: 2, highrise: 2, terrace_tower: 2, slab_tower: 2
  });
  let total = 0, repeated = 0;
  for (const placements of Object.values(houses)) {
    const pairs = neighbouringPairs(placements, 16);
    total += pairs.total;
    repeated += pairs.repeated;
  }
  expect(total).toBeGreaterThan(500);
  expect(repeated / total).toBeLessThan(.03);
  for (const [name, x, z, radius] of [['Hankou', -50, -330, 62], ['Tanhualin', 3, -51, 48]]) {
    let pairs = 0, duplicates = 0;
    for (const placements of Object.values(houses)) {
      const local = placements.filter(p => Math.hypot(p.x - x, p.z - z) < radius);
      const result = neighbouringPairs(local, 16);
      pairs += result.total;
      duplicates += result.repeated;
    }
    expect(pairs, name).toBeGreaterThanOrEqual(10);
    expect(duplicates, name).toBe(0);
  }
});
