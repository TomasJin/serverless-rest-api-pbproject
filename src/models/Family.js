import { pick } from 'ramda';
import uuidv1 from 'uuid/v1';
import dbClient from 'utils/db-client';
import UserModel from './User';

const FAMILY_TABLENAME = 'Families';
const FAMILY_USER_TABLENAME = 'FamiliesUsers';

export default class FamilyModel {
  constructor() {
    this.dbClient = dbClient;
    this.user = new UserModel();
  }

  fetchById(id) {
    const params = {
      TableName: FAMILY_TABLENAME,
      Key: { id }
    };

    return this
      .dbClient('get', params)
      .then(data => data.Item);
  }

  fetchByFamilyEmail(email) {
    const params = {
      TableName: FAMILY_TABLENAME,
      IndexName: 'familyEmail-id-index',
      KeyConditionExpression: 'familyEmail = :hkey',
      ExpressionAttributeValues: {
        ':hkey': email
      }
    };

    return this.dbClient('query', params);
  }

  fetchMember(familyId, userId) {
    const params = {
      TableName: FAMILY_USER_TABLENAME,
      KeyConditionExpression: 'familyId = :hkey AND userId = :rkey',
      ExpressionAttributeValues: {
        ':hkey': familyId,
        ':rkey': userId
      }
    };

    return this
      .dbClient('query', params)
      .then(data => data.Items[0]);
  }

  fetchMembersByFamilyId(id) {
    const PULL_FROM_COGNITO = ['picture', 'username', 'email', 'deviceTokens'];

    const params = {
      TableName: FAMILY_USER_TABLENAME,
      KeyConditionExpression: 'familyId = :hkey',
      ExpressionAttributeValues: {
        ':hkey': id
      }
    };

    return this
      .dbClient('query', params)
      .then(({ Items }) => {
        const promises = Items.map(member =>
          this.user
            .getByCognitoUsername(member.userSummary['cognito:username'])
            .then(cognitoUser => ({
              ...member,
              userSummary: {
                ...member.userSummary,
                ...pick(PULL_FROM_COGNITO, cognitoUser)
              }
            })));

        return Promise.all(promises);
      });
  }

  fetchByMember(memberId) {
    const params = {
      TableName: FAMILY_USER_TABLENAME,
      IndexName: 'userId-familyId-index',
      KeyConditionExpression: 'userId = :hkey',
      ExpressionAttributeValues: {
        ':hkey': memberId
      }
    };

    return this.dbClient('query', params).then(({ Items }) => Items);
  }

  create(familyAdminUser) {
    const SUMMARY_WHITE_LIST = ['userId', 'email'];
    const params = {
      TableName: FAMILY_TABLENAME,
      Item: {
        id: uuidv1(),
        name: `${familyAdminUser.name || familyAdminUser.username}'s Family`,
        created: (new Date()).toISOString(),
        adminSummary: pick(SUMMARY_WHITE_LIST, familyAdminUser),
        familyEmail: familyAdminUser.email
      }
    };

    return this.dbClient('put', params).then(() => params.Item);
  }

  join(familyId, member) {
    const SUMMARY_WHITE_LIST = ['username', 'type', 'cognito:username'];

    const params = {
      TableName: FAMILY_USER_TABLENAME,
      Item: {
        familyId,
        userId: member.userId,
        created: (new Date()).toISOString(),
        userSummary: pick(SUMMARY_WHITE_LIST, member)
      }
    };

    if (member.type === 'child') {
      params.Item.userSummary = {
        ...params.Item.userSummary,
        balance: 0,
        completedJobs: 0
      };
    }

    return this.dbClient('put', params).then(() => params.Item);
  }

  checkIsFamilyMember(familyId, userId) {
    return this
      .fetchMember(familyId, userId)
      .then(member => !!member);
  }

  updateFamilyMemberAfterJobCompletion(completedJob) {
    const primaryKeys = {
      familyId: completedJob.familyId,
      userId: completedJob.childUserId
    };

    const params = {
      TableName: FAMILY_USER_TABLENAME,
      Key: primaryKeys,
      UpdateExpression: [
        'SET userSummary.balance = userSummary.balance + :balance',
        'userSummary.completedJobs = userSummary.completedJobs + :cjIncrement'
      ].join(', '),
      ExpressionAttributeValues: {
        ':balance': completedJob.jobSummary.price,
        ':cjIncrement': 1
      },
      ReturnValues: 'ALL_NEW'
    };

    return this.dbClient('update', params).then(data => data.Attributes);
  }

  updateFamilyMemberAfterWithdrawal(approvedWithdrawal) {
    const primaryKeys = {
      familyId: approvedWithdrawal.familyId,
      userId: approvedWithdrawal.childUserId
    };

    const params = {
      TableName: FAMILY_USER_TABLENAME,
      Key: primaryKeys,
      UpdateExpression: [
        'SET userSummary.balance = userSummary.balance - :balance'
      ].join(', '),
      ExpressionAttributeValues: {
        ':balance': approvedWithdrawal.amount
      },
      ReturnValues: 'ALL_NEW'
    };

    return this.dbClient('update', params).then(data => data.Attributes);
  }
}
