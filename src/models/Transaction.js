import { pick } from 'ramda';
import uuidv1 from 'uuid/v1';
import dbClient from 'utils/db-client';
import { WITHDRAWAL_TABLENAME } from './Withdrawal';
import { JOB_TABLENAME } from './Job';

const TRANSACTION_TABLENAME = 'Transactions';

export default class TransactionModel {
  constructor() {
    this.dbClient = dbClient;
  }

  fetchByFamilyId(familyId, lastEvaluatedKey, limit = 20) {
    const params = {
      TableName: TRANSACTION_TABLENAME,
      Limit: limit,
      ScanIndexForward: false,
      IndexName: 'familyId-created-index',
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
      TableName: TRANSACTION_TABLENAME,
      Limit: limit,
      ScanIndexForward: false,
      KeyConditionExpression: 'familyId = :hkey AND begins_with(childUserId__createdTimestamp, :rkey)',
      ExpressionAttributeValues: {
        ':hkey': familyId,
        ':rkey': userId
      },
      ExclusiveStartKey: lastEvaluatedKey
    };

    return this.dbClient('query', params);
  }

  _create({
    familyId, description, childUserId, balanceAfter, amount, meta
  }) {
    const now = new Date();
    const timestamp = now.getTime();
    const params = {
      TableName: TRANSACTION_TABLENAME,
      Item: {
        id: uuidv1(),
        familyId,
        description,
        childUserId,
        balanceAfter,
        amount,
        created: now.toISOString(),
        childUserId__createdTimestamp: `${childUserId}__${timestamp}`,
        meta
      }
    };

    return this.dbClient('put', params).then(() => params.Item);
  }

  createFromJobCompletion(balanceAfter, completedJob) {
    const params = {
      ...pick(['familyId', 'childUserId'], completedJob),
      description: completedJob.jobSummary.title,
      amount: completedJob.jobSummary.price,
      balanceAfter,
      meta: {
        referenceTable: JOB_TABLENAME,
        referenceId: completedJob.id
      }
    };

    return this._create(params);  // eslint-disable-line
  }

  createFromWithdrawal(balanceAfter, approvedWithdrawal, issuedByParent) {
    const params = {
      ...pick(['familyId', 'childUserId'], approvedWithdrawal),
      description: `Cash Request issued by ${issuedByParent ? 'Parent' : 'Child'}`,
      amount: approvedWithdrawal.amount,
      balanceAfter,
      meta: {
        referenceTable: WITHDRAWAL_TABLENAME,
        referenceId: approvedWithdrawal.id
      }
    };

    return this._create(params);  // eslint-disable-line
  }
}
