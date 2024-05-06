import Boom from 'boom';
import { pick } from 'ramda';
import JobModel from 'models/Job';
import FamilyModel from 'models/Family';
import TransactionModel from 'models/Transaction';
import { notifyJob } from 'utils/noti/index';

import {
  checkAllowedJobStatusSafeUpdate as checkSafeStatus,
  checkAllowedJobSummarySafeUpdate as checkSafeSummary
} from 'utils/validation';

export default class JobController {
  constructor() {
    this.job = new JobModel();
    this.family = new FamilyModel();
    this.transaction = new TransactionModel();
  }

  async get(id) {
    const data = await this.job.fetchById(id);

    return data;
  }

  async listByFamily(userId, familyId, lastEvaluatedKey, limit) {
    return this.job.fetchByFamilyId(familyId, lastEvaluatedKey, limit);
  }

  async listByFamilyMember(userId, familyId, lastEvaluatedKey, limit) {
    // check if user is family member
    if (!(await this.family.checkIsFamilyMember(familyId, userId))) {
      throw Boom.badRequest('given user is not given family member');
    }

    return this.job.fetchByFamilyMember(familyId, userId, lastEvaluatedKey, limit);
  }

  async create(currentUser, reqParam) {
    let jobData = pick(['familyId', 'jobSummary', 'childUserId'], reqParam);

    if (currentUser.type === 'parent') {
      jobData = {
        ...jobData,
        status: 'CREATED_BY_PARENT'
      };
    } else if (currentUser.type === 'child') {
      jobData = {
        ...jobData,
        status: 'CREATED_BY_CHILD',
        childUserId: currentUser.userId
      };
    }

    let newJob = await this.job.create(currentUser.userId, jobData);
    await notifyJob(newJob);

    if (currentUser.type === 'parent') {
      newJob = await this.job.updateStatus(currentUser.userId, {
        status: 'START_APPROVED'
      }, newJob);
    }

    return newJob;
  }

  async safeUpdateStatus(currentUser, jobId, reqParam) {
    const jobData = await this.job.fetchById(jobId);
    if (!jobData) {
      throw Boom.notFound('Not existing job');
    }

    // TODO: child user can only update the job that created for him.
    // TODO: parent user can only update the job that created for his family.
    const safetyError = checkSafeStatus(currentUser.type, jobData.status, reqParam.status);
    if (safetyError) {
      throw Boom.badRequest(safetyError);
    }

    const updatedJob = await this.job.updateStatus(currentUser.userId, reqParam, jobData);
    if (updatedJob.status === 'PAID') {
      const { userSummary } = await this.family.updateFamilyMemberAfterJobCompletion(updatedJob);
      await this.transaction.createFromJobCompletion(userSummary.balance, updatedJob);
    }

    await notifyJob(updatedJob);

    return updatedJob;
  }

  async safeUpdateSummary(currentUser, jobId, reqParam) {
    const jobData = await this.job.fetchById(jobId);
    if (!jobData) {
      throw Boom.notFound('Not existing job');
    }

    // TODO: child user can only update the job that created for him.
    // TODO: parent user can only update the job that created for his family.
    const safetyError = checkSafeSummary(currentUser.type, jobData.status);
    if (safetyError) {
      throw Boom.badRequest(safetyError);
    }

    const updatedJob = await this.job.updateSummary(currentUser.userId, reqParam, jobData);

    await notifyJob(updatedJob);

    return updatedJob;
  }
}
