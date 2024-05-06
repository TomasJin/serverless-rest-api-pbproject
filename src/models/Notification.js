import { pick } from 'ramda';
import uuidv1 from 'uuid/v1';
import dbClient from 'utils/db-client';

const NOTIFICATION_TABLENAME = 'Notifications';

export default class NotificationModel {
  constructor() {
    this.dbClient = dbClient;
  }

  fetchById(id) {
    const params = {
      TableName: NOTIFICATION_TABLENAME,
      IndexName: 'id-index',
      KeyConditionExpression: 'id = :hkey',
      ExpressionAttributeValues: {
        ':hkey': id
      }
    };

    return this
      .dbClient('query', params)
      .then(data => data.Items[0]);
  }

  fetchByUser(userId, lastEvaluatedKey, limit = 20) {
    const params = {
      TableName: NOTIFICATION_TABLENAME,
      Limit: limit,
      ScanIndexForward: false,
      KeyConditionExpression: 'userId = :hkey',
      ExpressionAttributeValues: {
        ':hkey': `${userId}`,
      },
      ExclusiveStartKey: lastEvaluatedKey
    };

    return this.dbClient('query', params).then(({ Items }) => Items);
  }

  create(userId, content, familyId = 'NO_FAMILY_ID', meta = {}) {
    const now = new Date();
    const params = {
      TableName: NOTIFICATION_TABLENAME,
      Item: {
        id: uuidv1(),
        userId,
        content,
        familyId,
        created: now.toISOString(),
        meta,
        alreadyRead: false
      }
    };

    return this.dbClient('put', params).then(() => params.Item);
  }

  markOneAsRead(notiData) {
    const now = new Date();

    const primaryKeys = ['userId', 'created'];

    const params = {
      TableName: NOTIFICATION_TABLENAME,
      Key: pick(primaryKeys, notiData),
      UpdateExpression: [
        'SET alreadyRead = :read',
        'modified = :m'
      ].join(', '),
      ExpressionAttributeValues: {
        ':read': true,
        ':m': now.toISOString(),
      },
      ReturnValues: 'ALL_NEW'
    };

    return this.dbClient('update', params).then(data => data.Attributes);
  }

  fetchUnreadCountByUserId(userId) {
    const params = {
      TableName: NOTIFICATION_TABLENAME,
      ScanIndexForward: false,
      KeyConditionExpression: 'userId = :hkey',
      ExpressionAttributeValues: {
        ':hkey': `${userId}`,
        ':unread': false
      },
      FilterExpression: 'alreadyRead = :unread'
    };

    return this.dbClient('query', params).then(({ Count }) => Count);
  }
}
