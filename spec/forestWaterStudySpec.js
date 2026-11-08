import { buildWaterStudy, studySample, studyCanMove, queryWaterStudy, WATER_STUDY_ID }
  from '../scripts/dev/forestWaterStudyGeometry.js';

describe('River and lake landscape study (not owner generation)', () => {
  for (const seed of ['alder', 'granite', 'snowmelt']) {
    describe(seed, () => {
      const scene = buildWaterStudy(seed);
      it('keeps complete features identical across signed region queries and JSON transport', () => {
        const west = queryWaterStudy(scene, { minX: -1920, minY: -3900, maxX: 0, maxY: -1900 });
        const east = queryWaterStudy(scene, { minX: 0, minY: -3900, maxX: 1920, maxY: -1900 });
        expect(west).toContain(scene.polygons[0]);
        expect(east).toContain(scene.polygons[0]);
        expect(buildWaterStudy(seed)).toEqual(scene);
        expect(queryWaterStudy(JSON.parse(JSON.stringify(scene)), {
          minX: -1920, minY: -3900, maxX: 0, maxY: -1900 })).toEqual(west);
        expect(scene.id).toBe(WATER_STUDY_ID);
        expect(Buffer.byteLength(JSON.stringify(scene))).toBeLessThan(60000);
      });
      it('supports a continuous roughly minute-long bank walk at the actual live speed', () => {
        expect(scene.routeLength / 108).toBeGreaterThan(55);
        expect(scene.routeLength / 108).toBeLessThan(70);
        for (let i = 1; i < scene.route.length; i++) {
          expect(studyCanMove(scene, scene.route[i - 1], scene.route[i])).toBeTrue();
        }
      });
      it('has a usable elevated crossing, dry approaches, and rejects water movement/placement', () => {
        const b = scene.bridge, a = b.angleMilliradians / 1000;
        const local = (along, across = 0) => ({ x: b.worldX + Math.cos(a) * along - Math.sin(a) * across,
          y: b.worldY + Math.sin(a) * along + Math.cos(a) * across });
        for (let step = -b.halfLength - 32; step <= b.halfLength + 32; step += 4) {
          expect(studySample(scene, local(step)).walkable).toBeTrue();
          expect(studySample(scene, local(step)).placeable).toBeFalse();
        }
        expect(studySample(scene, local(0)).surface).toBe('bridge');
        expect(studySample(scene, scene.points[80]).walkable).toBeFalse();
        expect(studySample(scene, { x: 260, y: 1240 }).placeable).toBeFalse();
        expect(studyCanMove(scene, { x: 250, y: 1230 }, { x: 270, y: 1250 })).toBeFalse();
      });
      it('submerges the channel end well inside a substantial receiving lake', () => {
        const end = scene.points.at(-1);
        expect(studySample({ ...scene, polygons: [scene.lake] }, end, 0).surface).toBe('water');
        const width = Math.max(...scene.lake.map(p => p.x)) - Math.min(...scene.lake.map(p => p.x));
        const height = Math.max(...scene.lake.map(p => p.y)) - Math.min(...scene.lake.map(p => p.y));
        expect(width).toBeGreaterThan(2800);
        expect(height).toBeGreaterThan(2000);
      });
    });
  }
  it('rejects oversized queries and movement rather than doing unbounded work', () => {
    const scene = buildWaterStudy();
    expect(() => queryWaterStudy(scene, { minX: -99999, minY: 0, maxX: 99999, maxY: 0 })).toThrow();
    expect(() => studyCanMove(scene, { x: 0, y: 0 }, { x: 1000, y: 0 })).toThrow();
  });
});
