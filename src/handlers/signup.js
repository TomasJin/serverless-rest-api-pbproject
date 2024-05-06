import * as R from 'ramda';
import { parseCognitoEvent } from 'utils/parser';
import UserController from 'controllers/User';
import {
  sendWelcome
} from 'utils/mailer';

const user = new UserController();

export async function preSignup(event, context) {
  const {
    attributes,
    validationData,
  } = parseCognitoEvent(event);

  const pureUserName = R.path(['pureUserName'], validationData);
  const avoidValidation = R.path(['avoidValidation'], validationData);

  if (!pureUserName) {
    return context.done(JSON.stringify({
      errorType: 'validation error',
      errorMessage: 'pureUserName is missing in validationData',
    }), event);
  }


  const offlineValidationMsg = user.validateUserNameOffline(pureUserName);

  if (offlineValidationMsg && !avoidValidation) {
    return context.done(JSON.stringify({
      errorType: 'username validation error',
      errorMessage: offlineValidationMsg
    }), event);
  }
  try {
    if (await user.getByPreferredUsername(pureUserName)) {
      return context.done(JSON.stringify({
        errorType: 'username validation error',
        errorMessage: 'This username is already registered'
      }), event);
    } else if (attributes['custom:type'] === 'parent'
      && await user.checkHasParentWithGivenEmail(attributes.email)) {
      return context.done(JSON.stringify({
        errorType: 'email validation error',
        errorMessage: 'This email is already registered'
      }), event);
    }
  } catch (e) {
    return context.done(JSON.stringify({
      errorType: 'validation error',
      errorMessage: e.toString()
    }), event);
  }

  event.response.autoConfirmUser = true; // eslint-disable-line

  return context.done(null, event);
}

export async function postConfirmation(event, context) {
  const {
    attributes,
    userPoolId,
    cognitoUserName
  } = parseCognitoEvent(event);

  try {
    const userType = R.prop('custom:type', attributes);
    const email = R.prop('email', attributes);
    const isNewSignUp = !R.has('cognito:token_nbf', attributes);
    // postConfirmation trigger's also invoked when updating password with confirmation code

    if (isNewSignUp) {
      await user.postConfirmation(cognitoUserName, attributes, userPoolId);
      if (userType === 'parent') {
        console.log('Welcome email sent', await sendWelcome(email));
      }
    }
  } catch (e) {
    return context.done(JSON.stringify({
      errorType: 'postConfirmation error',
      errorMessage: e.toString()
    }), event);
  }

  return context.done(null, event);
}

export default { preSignup, postConfirmation };
