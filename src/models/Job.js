import { omit, pick, merge } from 'ramda';
import uuidv1 from 'uuid/v1';
import dbClient from 'utils/db-client';

export const JOB_TABLENAME = 'Jobs';
export const availableJobStatus = {
  CREATED_BY_PARENT: {
    allowedRoles: ['parent'],
    availableNextMove: ['START_APPROVED']
  },
  CREATED_BY_CHILD: {
    allowedRoles: ['child'],
    availableNextMove: ['START_APPROVED', 'START_DECLINED', 'REMOVED']
  },
  START_APPROVED: {
    allowedRoles: ['parent'],
    availableNextMove: ['STARTED', 'REMOVED']
  },
  START_DECLINED: {
    allowedRoles: ['parent'],
    availableNextMove: ['REMOVED']
  },
  STARTED: {
    allowedRoles: ['child'],
    availableNextMove: ['FINISHED', 'REMOVED']
  },
  FINISHED: {
    allowedRoles: ['child'],
    availableNextMove: ['FINISH_DECLINED', 'PAID', 'REMOVED']
  },
  FINISH_DECLINED: {
    allowedRoles: ['parent'],
    availableNextMove: ['FINISHED', 'REMOVED']
  },
  PAID: {
    allowedRoles: ['parent'],
    availableNextMove: []
  },
  REMOVED: {
    allowedRoles: ['parent', 'child'],
    availableNextMove: []
  }
};

export default class JobModel {
  constructor() {
    this.dbClient = dbClient;
  }

  fetchById(id) {
    const params = {
      TableName: JOB_TABLENAME,
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

  fetchByFamilyId(familyId, lastEvaluatedKey, limit = 20) {
    const params = {
      TableName: JOB_TABLENAME,
      Limit: limit,
      ScanIndexForward: false,
      IndexName: 'familyId-modified-index',
      KeyConditionExpression: 'familyId = :hkey',
      ExpressionAttributeValues: {
        ':hkey': familyId
      },
      ExclusiveStartKey: lastEvaluatedKey
    };

    return this
      .dbClient('query', params)
      .then(data => ({ ...data, Limit: limit }));
  }

  fetchByFamilyMember(familyId, userId, lastEvaluatedKey, limit = 20) {
    const params = {
      TableName: JOB_TABLENAME,
      Limit: limit,
      ScanIndexForward: false,
      IndexName: 'familyId-childUserId__modifiedTimestamp-index',
      KeyConditionExpression: 'familyId = :hkey AND begins_with(childUserId__modifiedTimestamp, :rkey)',
      ExpressionAttributeValues: {
        ':hkey': familyId,
        ':rkey': userId
      },
      ExclusiveStartKey: lastEvaluatedKey
    };

    return this.dbClient('query', params);
  }

  create(currentUserId, jobData) {
    const now = new Date();
    const timestamp = now.getTime();

    const params = {
      TableName: JOB_TABLENAME,
      Item: {
        ...omit(['meta'], jobData),
        id: uuidv1(),
        modified: now.toISOString(),
        modifiedTimestamp__familyId: `${timestamp}__${jobData.familyId}`,
        childUserId__createdTimestamp: `${jobData.childUserId}__${timestamp}`,
        childUserId__modifiedTimestamp: `${jobData.childUserId}__${timestamp}`,
        history: [
          {
            status: jobData.status,
            issuedAt: timestamp,
            issuedBy: currentUserId,
            meta: jobData.meta
          }
        ]
      }
    };

    return this.dbClient('put', params).then(() => params.Item);
  }

  updateStatus(currentUserId, newData, currentJob) {
    const now = new Date();
    const primaryKeys = ['familyId', 'childUserId__createdTimestamp'];

    const params = {
      TableName: JOB_TABLENAME,
      Key: pick(primaryKeys, currentJob),
      UpdateExpression: [
        'SET history = list_append(history, :h)',
        '#st = :s',
        'modified = :m',
        'childUserId__modifiedTimestamp = :cm',
        'modifiedTimestamp__familyId = :mf'
      ].join(', '),
      ExpressionAttributeNames: {
        '#st': 'status'
      },
      ExpressionAttributeValues: {
        ':h': [{
          ...newData,
          issuedAt: now.getTime(),
          issuedBy: currentUserId,
          description: 'STATUS_UPDATED'
        }],
        ':s': newData.status,
        ':m': now.toISOString(),
        ':cm': `${currentJob.childUserId}__${now.getTime()}`,
        ':mf': `${now.getTime()}__${currentJob.familyId}`
      },
      ReturnValues: 'ALL_NEW'
    };

    return this.dbClient('update', params).then(data => data.Attributes);
  }

  updateSummary(currentUserId, summaryUpdate, currentJob) {
    const now = new Date();
    const primaryKeys = ['familyId', 'childUserId__createdTimestamp'];
    const newSummary = merge(currentJob.jobSummary, summaryUpdate);

    const params = {
      TableName: JOB_TABLENAME,
      Key: pick(primaryKeys, currentJob),
      UpdateExpression: [
        'SET history = list_append(history, :h)',
        'jobSummary = :summary',
        'modified = :m',
        'childUserId__modifiedTimestamp = :cm',
        'modifiedTimestamp__familyId = :mf'
      ].join(', '),
      ExpressionAttributeValues: {
        ':h': [{
          issuedAt: now.getTime(),
          issuedBy: currentUserId,
          meta: {
            before: currentJob.jobSummary,
            after: newSummary
          },
          description: 'SUMMARY_UPDATED'
        }],
        ':summary': newSummary,
        ':m': now.toISOString(),
        ':cm': `${currentJob.childUserId}__${now.getTime()}`,
        ':mf': `${now.getTime()}__${currentJob.familyId}`
      },
      ReturnValues: 'ALL_NEW'
    };

    return this.dbClient('update', params).then(data => data.Attributes);
  }
}
