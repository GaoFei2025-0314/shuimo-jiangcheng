const { test, expect, ready } = require('./fixtures.cjs');

test('scene stays within the triangle budget', async ({ page }) => {
  await ready(page);
  const triangles = await page.evaluate(() => {
    let total = 0;
    window.__testScene.traverse(mesh => {
      if (!mesh.isMesh) return;
      const vertices = mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count;
      total += vertices / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
    });
    return total;
  });
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThanOrEqual(1_500_000);
});

test('each city house type stays within three times its baseline', async ({ page }) => {
  // Each house variant is split into instanced meshes by material. Count one of each batch.
  const baseline = {
    lane: 226,
    apartment: 220,
    arcade: 272,
    highrise: 168,
    slab_tower: 476,
    terrace_tower: 638,
    wharf: 120
  };
  await ready(page);
  const houses = await page.evaluate(() => {
    const totals = {};
    window.__testScene.traverse(mesh => {
      if (!mesh.isInstancedMesh || !mesh.name.startsWith('City / ')) return;
      const type = mesh.name.slice('City / '.length);
      const variant = mesh.userData.cityVariant ?? type;
      const groups = totals[type] ||= {};
      const vertices = mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count;
      groups[variant] = (groups[variant] ?? 0) + vertices / 3;
    });
    return totals;
  });
  expect(Object.keys(houses).sort()).toEqual(Object.keys(baseline).sort());
  for (const [type, variants] of Object.entries(houses)) {
    for (const [variant, triangles] of Object.entries(variants)) {
      expect(triangles, variant).toBeGreaterThan(0);
      expect(triangles, variant).toBeLessThanOrEqual(3 * baseline[type]);
    }
  }
});
