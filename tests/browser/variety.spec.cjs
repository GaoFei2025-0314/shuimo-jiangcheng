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

test('trees load from the baked vegetation', async ({ page }) => {
  await ready(page);
  const baked = await page.evaluate(() => {
    const { children } = window.__testScene, variants = {};
    const sprigs = children.filter(mesh => mesh.name.startsWith('两岸近树纸本枝叶 · '));
    for (const mesh of children) {
      const tree = mesh.userData.vegetation;
      if (!mesh.isInstancedMesh || !tree) continue;
      const { species, part, variant } = tree;
      const parts = variants[variant ?? species] ||= { species, variant: variant ?? null, parts: {} };
      const levels = [mesh.geometry, mesh.userData.midGeometry, mesh.userData.farGeometry];
      parts.parts[part] = {
        instances: mesh.userData.authoredMatrices.length / 16,
        vertices: levels.map(geo => geo?.getAttribute('position').count ?? 0),
        pigmentAndWind: levels.every(geo => {
          const count = geo?.getAttribute('position').count;
          return count > 0 && ['color', 'windResponse'].every(name => geo.getAttribute(name)?.count === count);
        }),
        sprayCenters: levels.slice(0, 2).every(geo => {
          const count = geo?.getAttribute('position').count;
          return count > 0 && ['crownCenter', 'leafCenter'].every(name =>
            geo.getAttribute(name)?.count === count && geo.getAttribute(name).itemSize === 3);
        })
      };
    }
    return { variants, sprigs: sprigs.map(mesh => mesh.geometry.getAttribute('position').count) };
  });
  expect([...new Set(Object.values(baked.variants).map(tree => tree.species))].sort())
    .toEqual(['broadleaf', 'cherry', 'pine', 'willow']);
  for (const [key, tree] of Object.entries(baked.variants)) {
    expect(tree.variant, key).toBe(key);
    expect(Object.keys(tree.parts).sort(), key).toEqual(['foliage', 'wood']);
    expect(tree.parts.wood.instances, key).toBe(tree.parts.foliage.instances);
    for (const part of Object.values(tree.parts)) {
      expect(part.instances, key).toBeGreaterThan(0);
      expect(part.pigmentAndWind, key).toBe(true);
      const [near, mid, far] = part.vertices;
      expect(near, key).toBeGreaterThan(mid);
      expect(mid, key).toBeGreaterThan(far);
      expect(far, key).toBeGreaterThan(0);
    }
    expect(tree.parts.foliage.sprayCenters, key).toBe(true);
  }
  expect(baked.sprigs.length).toBeGreaterThan(0);
  expect(baked.sprigs.every(count => count > 0)).toBe(true);
});

test('each tree species grows in three variants', async ({ page }) => {
  await ready(page);
  const species = await page.evaluate(() => {
    const species = {};
    for (const mesh of window.__testScene.children) {
      const tree = mesh.userData.vegetation;
      if (!mesh.isInstancedMesh || tree?.part !== 'wood') continue;
      const { authoredMatrices } = mesh.userData;
      const placements = species[tree.species] ||= [];
      for (let i = 0; i < authoredMatrices.length; i += 16) {
        placements.push({ x: authoredMatrices[i + 12], z: authoredMatrices[i + 14], variant: tree.variant });
      }
    }
    return species;
  });
  expect(Object.fromEntries(Object.entries(species).map(([name, placements]) =>
    [name, new Set(placements.map(p => p.variant)).size]))).toEqual({
    broadleaf: 3, cherry: 3, pine: 3, willow: 3
  });
  let total = 0, repeated = 0;
  for (const placements of Object.values(species)) {
    const pairs = neighbouringPairs(placements, 9);
    total += pairs.total;
    repeated += pairs.repeated;
  }
  expect(total).toBeGreaterThan(400);
  expect(repeated / total).toBeLessThan(.08);
});
