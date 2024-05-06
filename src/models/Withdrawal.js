import { pick } from 'ramda';
import uuidv1 from 'uuid/v1';
import dbClient from 'utils/db-client';

export const availableWithdrawalStatus = {
  CREATED_BY_CHILD: {
    allowedRoles: ['child']
  },
  CREATED_BY_PARENT: {
    allowedRoles: ['parent']
  },
  APPROVED: {
    allowedRoles: ['parent']
  },
  REJECTED: {
    allowedRoles: ['parent']
  },
  CANCELED: {
    allowedRoles: ['child']
  }
};
export const WITHDRAWAL_TABLENAME = 'WithdrawalRequests';

export default class WithdrawalModel {
  constructor() {
    this.dbClient = dbClient;
  }

  fetchById(id) {
    const params = {
      TableName: WITHDRAWAL_TABLENAME,
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

  fetchByFamilyId(familyId, statusList, lastEvaluatedKey, limit = 20) {
    const safeStatus = statusList
      .filter(one => Object.keys(availableWithdrawalStatus).includes(one))
      .reduce((acc, curr, idx) => {
        acc[`:status${idx + 1}`] = curr;

        return acc;
      }, {});

    const params = {
      TableName: WITHDRAWAL_TABLENAME,
      Limit: limit,
      ScanIndexForward: false,
      IndexName: 'familyId-modified-index',
      KeyConditionExpression: 'familyId = :hkey',
      FilterExpression: `#st IN (${Object.keys(safeStatus).toString()})`,
      ExpressionAttributeNames: {
        '#st': 'status'
      },
      ExpressionAttributeValues: {
        ':hkey': familyId,
        ...safeStatus
      },
      ExclusiveStartKey: lastEvaluatedKey
    };

    return this
      .dbClient('query', params)
      .then(data => ({ ...data, Limit: limit }));
  }

  fetchByFamilyMember(familyId, userId, statusList, lastEvaluatedKey, limit = 20) {
    const safeStatus = statusList
      .filter(one => Object.keys(availableWithdrawalStatus).includes(one))
      .reduce((acc, curr, idx) => {
        acc[`:status${idx + 1}`] = curr;

        return acc;
      }, {});

    const params = {
      TableName: WITHDRAWAL_TABLENAME,
      Limit: limit,
      ScanIndexForward: false,
      KeyConditionExpression: 'familyId = :hkey AND begins_with(childUserId__createdTimestamp, :rkey)',
      FilterExpression: `#st IN (${Object.keys(safeStatus).toString()})`,
      ExpressionAttributeNames: {
        '#st': 'status'
      },
      ExpressionAttributeValues: {
        ':hkey': familyId,
        ':rkey': userId,
        ...safeStatus
      },
      ExclusiveStartKey: lastEvaluatedKey
    };

    return this.dbClient('query', params);
  }

  create(currentUserId, payload) {
    const now = new Date();
    const timestamp = now.getTime();
    const WHITE_LIST = ['familyId', 'amount', 'childUserId', 'status'];

    const params = {
      TableName: WITHDRAWAL_TABLENAME,
      Item: {
        ...pick(WHITE_LIST, payload),
        id: uuidv1(),
        modified: now.toISOString(),
        childUserId__createdTimestamp: `${payload.childUserId}__${timestamp}`,
        history: [
          {
            status: payload.status,
            issuedAt: timestamp,
            issuedBy: currentUserId
          }
        ]
      }
    };

    return this.dbClient('put', params).then(() => params.Item);
  }

  updateStatus(currentUserId, newStatus, currentWithdrawal) {
    const now = new Date();
    const primaryKeys = ['familyId', 'childUserId__createdTimestamp'];

    const params = {
      TableName: WITHDRAWAL_TABLENAME,
      Key: pick(primaryKeys, currentWithdrawal),
      UpdateExpression: [
        'SET history = list_append(history, :h)',
        '#st = :s',
        'modified = :m',
      ].join(', '),
      ExpressionAttributeNames: {
        '#st': 'status'
      },
      ExpressionAttributeValues: {
        ':h': [{
          status: newStatus,
          issuedAt: now.getTime(),
          issuedBy: currentUserId
        }],
        ':s': newStatus,
        ':m': now.toISOString(),
      },
      ReturnValues: 'ALL_NEW'
    };

    return this.dbClient('update', params).then(data => data.Attributes);
  }

  getPendingAmount(familyId, childUserId) {
    const params = {
      TableName: WITHDRAWAL_TABLENAME,
      ScanIndexForward: false,
      KeyConditionExpression: 'familyId = :hkey AND begins_with(childUserId__createdTimestamp, :rkey)',
      FilterExpression: '#st IN (:status1,:status2)',
      ExpressionAttributeNames: {
        '#st': 'status'
      },
      ExpressionAttributeValues: {
        ':status1': 'CREATED_BY_CHILD',
        ':status2': 'CREATED_BY_PARENT',
        ':hkey': familyId,
        ':rkey': childUserId
      }
    };

    return this.dbClient('query', params)
      .then(({ Items }) =>
        Items.reduce((acc, curr) => (curr.amount + acc), 0));
  }
}
