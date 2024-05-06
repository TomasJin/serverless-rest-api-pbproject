import Boom from 'boom';
import { success, failure } from 'utils/response';
import { parseAPIGatewayEvent } from 'utils/parser';
import FamilyController from 'controllers/Family';

const family = new FamilyController();

export async function get(event, context, callback) {
  let response;

  try {
    const { params, queryParams } = await parseAPIGatewayEvent(event);
    const data = await family.get(params.familyId, queryParams.scope);

    response = success(data);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}


export async function create(event, context, callback) {
  let response;

  try {
    const { currentUser } = await parseAPIGatewayEvent(event);

    if (currentUser.type !== 'parent') {
      throw Boom.badRequest('Only Parent user can create family');
    } else if (currentUser.familyIds.length > 2) {
      throw Boom.badRequest('maximum available families are 2');
    }

    const data = await family.create(currentUser);

    response = success(data, true);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function join(event, context, callback) {
  let response;

  try {
    const { currentUser, body } = await parseAPIGatewayEvent(event);

    if (!body.familyId) {
      throw Boom.badRequest('familyId is missing in request body');
    } else if (currentUser.familyIds.length > 2) {
      throw Boom.badRequest('can\'t join more than 2 families');
    } else if (currentUser.familyIds.includes(body.familyId)) {
      throw Boom.badRequest('already member of target family');
    }

    await family.join(currentUser, body.familyId);

    response = success({ message: 'joined ' });
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export default {
  get, create, join
};
