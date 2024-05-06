import Boom from 'boom';
import * as R from 'ramda';
import { success, failure } from 'utils/response';
import { parseAPIGatewayEvent, parseSNSEvent } from 'utils/parser';
import { checkValidNotiTriggerMessage } from 'utils/validation';
import NotiController from 'controllers/Notification';

const noti = new NotiController();

export async function send(event, context, callback) {
  let response;
  try {
    const { message } = parseSNSEvent(event);
    if (!checkValidNotiTriggerMessage(message)) {
      throw new Error('Invalid notification trigger message');
    }

    const startsWith = R.curry((prefix, xs) => R.equals(R.take(prefix.length, xs), prefix));
    const performedAction = message.content.split('.')[1];

    if (startsWith('job', performedAction)) {
      response = await noti.notifyJob(message.jobId, message);
    } else if (startsWith('withdrawal', performedAction)) {
      response = await noti.notifyWithdrawal(message.withdrawalId, message);
    } else if (performedAction === 'familyJoined') {
      response = await noti.notifyNewFamilyMemberJoined(message.familyId, message.userId, message);
    }
  } catch (e) {
    console.error(e);
    return callback(e);
  }

  return callback(null, response);
}

export async function listMine(event, context, callback) {
  let response;

  try {
    const { currentUser, body } = await parseAPIGatewayEvent(event);
    const { userId } = currentUser;

    const ctrlParams = [
      userId, body.lastEvaluatedKey, body.limit
    ];

    const data = await noti.listByUser(...ctrlParams);

    if (!data) {
      throw Boom.notFound('No notifications existing');
    }

    response = success(data);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function markOneAsRead(event, context, callback) {
  let response;

  try {
    const { currentUser, params } = await parseAPIGatewayEvent(event);

    const updated = await noti.markOneAsRead(params.notificationId, currentUser);
    response = success(updated);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function getUnreadCount(event, context, callback) {
  let response;
  const reflect = promise => promise.then(
    v => ({ v, status: 'resolved' }),
    e => ({ e, status: 'rejected' })
  );

  try {
    const { queryParams } = await parseAPIGatewayEvent(event);
    let { usernames } = queryParams;

    if (!usernames) {
      throw Boom.preconditionFailed('\'usernames\' is missing in query params');
    }
    usernames = usernames.split(',').map(u => u.trim());

    const data = await Promise.all(usernames
      .filter(u => !!u)
      .map(u => noti.getUnreadNotifications(u))
      .map(reflect)
    );

    const final = data.reduce((acc, item, idx) => {
      acc[usernames[idx]] = item.status === 'rejected' ? item.e.toString() : item.v;

      return acc;
    }, {});

    response = success(final);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export default {
  listMine, markOneAsRead, send, getUnreadCount
};
