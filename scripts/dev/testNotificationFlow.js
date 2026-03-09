import mongoose from 'mongoose';
import { initMongooseConnection } from '../../server/db/mongoose.js';
import BlockComment from '../../server/db/models/BlockComment.js';
import Notification from '../../server/db/models/Notification.js';
import {
  notifyBlockAuthorOfComment,
  getNotificationsForUser,
  getUnreadNotificationCount,
  markNotificationRead
} from '../../server/db/notificationService.js';

async function main() {
  const blockId = process.argv[2] || '699bb0011e9d3b2c0919af81';
  const roomId = process.argv[3] || 'test-room';
  const blockAuthorId = process.argv[4] || 'REAL_BLOCK_AUTHOR_USER_ID';
  const actorUserId = process.argv[5] || 'commenter-user-id';
  const actorUsername = process.argv[6] || 'commenterUser';

  try {
    await initMongooseConnection();

    const block = {
      _id: String(blockId),
      roomId: String(roomId),
      userId: String(blockAuthorId),
      title: 'Test Block for Notification Flow',
      lang: 'en'
    };

    const comment = await BlockComment.create({
      blockId: String(blockId),
      userId: String(actorUserId),
      body: 'This is a test comment to exercise the notification flow.',
      status: 'visible',
      editedAt: null,
      deletedAt: null,
      hiddenAt: null
    });

    console.log('Created comment:', {
      commentId: comment._id.toString(),
      blockId: comment.blockId,
      userId: comment.userId
    });

    console.log('\nTest 1: notify block author');
    const notification = await notifyBlockAuthorOfComment({
      block,
      comment,
      actorUser: {
        id: String(actorUserId),
        username: actorUsername
      }
    });

    console.log('Notification result:', notification);

    console.log('\nTest 2: unread count');
    const unread1 = await getUnreadNotificationCount(blockAuthorId);
    console.log('Unread count after notify:', unread1);

    console.log('\nTest 3: list notifications');
    const notifications = await getNotificationsForUser({
      userId: blockAuthorId,
      limit: 10
    });
    console.log('Latest notifications:', notifications.map(n => ({
      id: n._id?.toString?.() || n._id,
      type: n.type,
      readAt: n.readAt,
      blockId: n.blockId,
      commentId: n.commentId
    })));

    if (notification?._id) {
      console.log('\nTest 4: mark read');
      const marked = await markNotificationRead({
        notificationId: notification._id,
        userId: blockAuthorId
      });

      console.log('Marked read:', {
        id: marked._id?.toString?.() || marked._id,
        readAt: marked.readAt
      });

      const unread2 = await getUnreadNotificationCount(blockAuthorId);
      console.log('Unread count after mark read:', unread2);
    } else {
      console.log('No notification created, skipping mark-read test.');
    }

    console.log('\nTest 5: self-notification suppression');
    const selfNotification = await notifyBlockAuthorOfComment({
      block: {
        ...block,
        userId: String(actorUserId)
      },
      comment,
      actorUser: {
        id: String(actorUserId),
        username: actorUsername
      }
    });

    console.log('Self-notification result (should be null):', selfNotification);

    // Optional cleanup:
    // await Notification.deleteMany({ blockId: String(blockId), commentId: comment._id.toString() });
    // await BlockComment.deleteOne({ _id: comment._id });
    // console.log('\nCleaned up test records');
  } catch (err) {
    console.error('Script error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main();
