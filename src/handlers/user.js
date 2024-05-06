import Boom from 'boom';
import { success, failure } from 'utils/response';
import { parseAPIGatewayEvent } from 'utils/parser';
import FamilyController from 'controllers/Family';
import UserController from 'controllers/User';
import {
  checkAddDeviceTokenSchema,
} from 'utils/validation';

const family = new FamilyController();
const user = new UserController();

export async function getMe(event, context, callback) {
  let response;

  try {
    const { currentUser } = await parseAPIGatewayEvent(event);

    const familyInfo = await family.fetchByUserId(currentUser.userId);
    currentUser.family = familyInfo;

    response = success(currentUser);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function remove(event, context, callback) {
  callback(null, {
    statusCode: 200,
    body: 'Not implemented yet',
  });
}

export async function addDeviceToken(event, context, callback) {
  let response;

  try {
    const { currentUser, body } = await parseAPIGatewayEvent(event);
    const validationError = checkAddDeviceTokenSchema(body);

    if (validationError) {
      throw Boom.preconditionFailed(validationError);
    }

    const updatedUser = await user.addDeviceToken(currentUser, body);

    response = success(updatedUser);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export async function removeDeviceToken(event, context, callback) {
  let response;

  try {
    const { currentUser, params } = await parseAPIGatewayEvent(event);
    const tokenData = {
      token: params.token
    };

    const updatedUser = await user.removeDeviceToken(currentUser, tokenData);

    response = success(updatedUser);
  } catch (e) {
    response = failure(e, event);
  }

  callback(null, response);
}

export default { getMe, addDeviceToken, removeDeviceToken };
