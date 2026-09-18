import Room from '../server/db/models/Room.js';
import { getRoomMetadataByIds } from '../server/db/roomService.js';
import * as cache from '../server/services/cache.js';

describe('homepage discovery room metadata', () => {
  beforeEach(() => cache.clear());

  it('loads, localizes, and caches a room batch independent of ID order', async () => {
    const lean = jasmine.createSpy('lean').and.resolveTo([
      {
        _id: 'physics',
        name: 'Physics',
        name_i18n: { es: 'Física' }
      },
      {
        _id: 'computing',
        name: 'Computing'
      }
    ]);
    const find = spyOn(Room, 'find').and.returnValue({ lean });

    const first = await getRoomMetadataByIds(['physics', 'computing', 'physics'], 'es');
    const second = await getRoomMetadataByIds(['computing', 'physics'], 'es');

    expect(find).toHaveBeenCalledOnceWith({
      _id: { $in: ['computing', 'physics'] }
    });
    expect(lean).toHaveBeenCalledTimes(1);
    expect(first.physics.displayName).toBe('Física');
    expect(first.computing.displayName).toBe('Computing');
    expect(second).toBe(first);
  });

  it('returns an empty lookup without querying MongoDB', async () => {
    const find = spyOn(Room, 'find');

    expect(await getRoomMetadataByIds([], 'en')).toEqual({});
    expect(find).not.toHaveBeenCalled();
  });
});
