import Boom from 'boom';
import { pick } from 'ramda';
import WithdrawalModel, { availableWithdrawalStatus } from 'models/Withdrawal';
import TransactionModel from 'models/Transaction';
import FamilyModel from 'models/Family';
import { notifyWithdrawal } from 'utils/noti/index';

import {
  checkAllowedWithdrawalStatusSafeUpdate as checkSafeStatus
} from 'utils/validation';

export default class WithdrawalController {
  constructor() {
    this.withdrawal = new WithdrawalModel();
    this.family = new FamilyModel();
    this.transaction = new TransactionModel();
  }

  async get(id) {
    const data = await this.withdrawal.fetchById(id);

    return data;
  }

  async listByFamily(userId, familyId, status, lastEvaluatedKey, limit) {
    const wanted = status === 'pending'
      ? ['CREATED_BY_PARENT', 'CREATED_BY_CHILD']
      : Object.keys(availableWithdrawalStatus);

    return this.withdrawal.fetchByFamilyId(familyId, wanted, lastEvaluatedKey, limit);
  }

  async listByFamilyMember(userId, familyId, status, lastEvaluatedKey, limit) {
    // check if user is family member
    if (!(await this.family.checkIsFamilyMember(familyId, userId))) {
      throw Boom.badRequest('given user is not given family member');
    }

    const wanted = status === 'pending'
      ? ['CREATED_BY_PARENT', 'CREATED_BY_CHILD']
      : Object.keys(availableWithdrawalStatus);

    Array.isArray(status)
      ? status.map(one => one.toUpperCase())
      : [status.toUpperCase()];

    return this.withdrawal.fetchByFamilyMember(familyId, userId, wanted, lastEvaluatedKey, limit);
  }

  async getAvailableBalance(familyId, childUserId) {
    const pendingAmount = await this.withdrawal.getPendingAmount(familyId, childUserId);
    const familyMemberInfo = await this.family.fetchMember(familyId, childUserId);

    return familyMemberInfo.userSummary.balance - pendingAmount;
  }

  async create(currentUser, reqParam) {
    let withdrawalData = pick(['familyId', 'amount', 'childUserId'], reqParam);

    if (currentUser.type === 'parent') {
      withdrawalData = {
        ...withdrawalData,
        status: 'CREATED_BY_PARENT'
      };
    } else if (currentUser.type === 'child') {
      withdrawalData = {
        ...withdrawalData,
        status: 'CREATED_BY_CHILD',
        childUserId: currentUser.userId
      };
    }

    // check if available to withdraw
    const availableBalance = await this
      .getAvailableBalance(withdrawalData.familyId, withdrawalData.childUserId);

    if (availableBalance < withdrawalData.amount) {
      throw Boom.badRequest('Not enough available balance');
    }

    let newWithdrawal = await this.withdrawal.create(currentUser.userId, withdrawalData);

    await notifyWithdrawal(newWithdrawal);

    if (currentUser.type === 'parent') {
      newWithdrawal = await this.withdrawal.updateStatus(currentUser.userId, 'APPROVED', newWithdrawal);
      const { userSummary } = await this.family.updateFamilyMemberAfterWithdrawal(newWithdrawal);
      await this.transaction.createFromWithdrawal(userSummary.balance, newWithdrawal, true);
    }

    return newWithdrawal;
  }

  async safeUpdateStatus(currentUser, withdrawalId, reqParam) {
    const withdrawalData = await this.withdrawal.fetchById(withdrawalId);

    if (!withdrawalData) {
      throw Boom.notFound('Not existing withdrawal request');
    }

    // check if user is family member
    if (!(await this.family.checkIsFamilyMember(withdrawalData.familyId, currentUser.userId))) {
      throw Boom.badRequest('Disallowed to set other family\'s data');
    }

    const safetyError = checkSafeStatus(currentUser.type, withdrawalData.status, reqParam.status);
    if (safetyError) {
      throw Boom.badRequest(safetyError);
    }

    const updatedWithdrawal = await this.withdrawal
      .updateStatus(currentUser.userId, reqParam.status, withdrawalData);

    if (updatedWithdrawal.status === 'APPROVED') {
      const { userSummary } = await this.family
        .updateFamilyMemberAfterWithdrawal(updatedWithdrawal);
      await this.transaction.createFromWithdrawal(userSummary.balance, updatedWithdrawal);
    }

    await notifyWithdrawal(updatedWithdrawal);

    return updatedWithdrawal;
  }
}
