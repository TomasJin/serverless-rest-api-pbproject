import Boom from 'boom';
import { success, failure } from 'utils/response';
import { parseAPIGatewayEvent } from 'utils/parser';
import JobController from 'controllers/Job';
import {
  checkCreateJobDataSchema,
  checkUpdateJobStatusSchema,
  checkUpdateJobSummarySchema,
} from 'utils/validation';

const job = new JobController();

export async function get(event, context, callback) {
  let response;

  try {
    const { params } = await parseAPIGatewayEvent(event);
    const data = await job.get(params.jobId);

    if (!data) {
      throw Boom.notFound('Not existing job');
    }

    response = success(data);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function create(event, context, callback) {
  let response;

  try {
    const { currentUser, body } = await parseAPIGatewayEvent(event);
    const validationError = checkCreateJobDataSchema(body);

    if (validationError) {
      throw Boom.preconditionFailed(validationError);
    } else if (currentUser.type === 'parent' && !body.childUserId) {
      throw Boom.preconditionFailed('"childUserId" is required');
    } else if (!currentUser.familyIds.includes(body.familyId)) {
      throw Boom.badRequest('Disallowed to create for other family');
    }

    const created = await job.create(currentUser, body);

    response = success(created, true);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function updateStatus(event, context, callback) {
  let response;

  try {
    const { currentUser, body, params } = await parseAPIGatewayEvent(event);

    const validationError = checkUpdateJobStatusSchema(body);
    if (validationError) {
      throw Boom.preconditionFailed(validationError);
    }

    const updated = await job.safeUpdateStatus(currentUser, params.jobId, body);
    response = success(updated);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function updateSummary(event, context, callback) {
  let response;

  try {
    const { currentUser, body, params } = await parseAPIGatewayEvent(event);

    const validationError = checkUpdateJobSummarySchema(body);
    if (validationError) {
      throw Boom.preconditionFailed(validationError);
    }

    const updated = await job.safeUpdateSummary(currentUser, params.jobId, body);
    response = success(updated);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function listByFamily(event, context, callback) {
  let response;

  try {
    const { params, currentUser, body } = await parseAPIGatewayEvent(event);

    if (currentUser.type === 'child') {
      throw Boom.badRequest('Only parent can get family data');
    } else if (!currentUser.familyIds.includes(params.familyId)) {
      throw Boom.badRequest('Disallowed to see other family\'s data');
    }

    const ctrlParams = [
      currentUser.userId, params.familyId, body.lastEvaluatedKey, body.limit
    ];

    const data = await job.listByFamily(...ctrlParams);

    if (!data) {
      throw Boom.notFound('No jobs existing');
    }

    response = success(data);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function listByFamilyMember(event, context, callback) {
  let response;

  try {
    const { params, currentUser, body } = await parseAPIGatewayEvent(event);
    const userId = params.userId || currentUser.userId;
    if (currentUser.type === 'parent') {
      throw Boom.badRequest('Parent doesn\'t have jobs');
    }

    const ctrlParams = [
      userId, params.familyId, body.lastEvaluatedKey, body.limit
    ];

    const data = await job.listByFamilyMember(...ctrlParams);

    if (!data) {
      throw Boom.notFound('No jobs existing');
    }

    response = success(data);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export default {
  get, create, updateStatus, listByFamily, listByFamilyMember
};
