import { rankRoomActivity } from '../server/db/sessionService.js';

describe('rankRoomActivity', () => {
  const now = new Date('2026-06-07T12:00:00.000Z');

  it('surfaces rooms with recently updated posts even without live peers', () => {
    const activity = rankRoomActivity([
      {
        _id: 'poetry',
        recentPosts: 2,
        lastActivityAt: new Date('2026-06-07T10:00:00.000Z')
      }
    ], [], now);

    expect(activity).toEqual([
      {
        roomId: 'poetry',
        activeUsers: 0,
        recentPosts: 2,
        lastActivityAt: new Date('2026-06-07T10:00:00.000Z')
      }
    ]);
  });

  it('prioritizes live rooms and counts each active peer once across blocks', () => {
    const activity = rankRoomActivity([
      {
        _id: 'poetry',
        recentPosts: 3,
        lastActivityAt: new Date('2026-06-07T11:59:00.000Z')
      }
    ], [
      {
        roomId: 'history',
        peers: {
          'peer-1': new Date('2026-06-07T11:58:00.000Z'),
          'peer-expired': new Date('2026-06-07T11:00:00.000Z')
        }
      },
      {
        roomId: 'history',
        peers: {
          'peer-1': new Date('2026-06-07T11:59:00.000Z'),
          'peer-2': new Date('2026-06-07T11:57:00.000Z')
        }
      }
    ], now);

    expect(activity.map(room => room.roomId)).toEqual(['history', 'poetry']);
    expect(activity[0].activeUsers).toBe(2);
    expect(activity[0].recentPosts).toBe(0);
    expect(activity[0].lastActivityAt).toEqual(new Date('2026-06-07T11:59:00.000Z'));
  });

  it('orders non-live rooms by their latest post activity', () => {
    const activity = rankRoomActivity([
      {
        _id: 'older-busy-room',
        recentPosts: 10,
        lastActivityAt: new Date('2026-06-06T12:00:00.000Z')
      },
      {
        _id: 'newer-room',
        recentPosts: 1,
        lastActivityAt: new Date('2026-06-07T08:00:00.000Z')
      }
    ], [], now);

    expect(activity.map(room => room.roomId)).toEqual(['newer-room', 'older-busy-room']);
  });
});
