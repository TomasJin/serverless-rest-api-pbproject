import Boom from 'boom';
import { success, failure } from 'utils/response';
import { parseAPIGatewayEvent } from 'utils/parser';
import TransactionController from 'controllers/Transaction';

const transaction = new TransactionController();

export async function get(event, context, callback) {
  let response;

  try {
    const { params } = await parseAPIGatewayEvent(event);
    const data = await transaction.get(params.transactionId);

    if (!data) {
      throw Boom.notFound('Not existing transaction history');
    }

    response = success(data);
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

    const data = await transaction.listByFamily(...ctrlParams);

    if (!data) {
      throw Boom.notFound('No transaction history existing');
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

    const data = await transaction.listByFamilyMember(...ctrlParams);

    if (!data) {
      throw Boom.notFound('No transaction history existing');
    }

    response = success(data);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export default {
  get, listByFamilyMember, listByFamily
};
