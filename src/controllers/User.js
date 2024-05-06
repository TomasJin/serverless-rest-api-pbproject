import * as R from 'ramda';
import UserModel from 'models/User';
import { checkIfReserved, checkIfProfane } from 'utils/validation';

export default class User {
  constructor() {
    this.user = new UserModel();
  }

  validateUserNameOffline(userName) { // eslint-disable-line
    const validExp = /^[a-zA-Z]+[\w\d\.\-_]*$/; // eslint-disable-line

    if (!validExp.test(userName)) {
      return 'username can only have a-z dot(.) underscore(_) and dash(-)';
    } else if (userName.length < 3 || userName.length > 16) {
      return 'username must have length between 3 ~ 16 chars';
    } else if (checkIfReserved(userName)) {
      return 'given username is reserved one';
    } else if (checkIfProfane(userName)) {
      return 'given username is not civilized one';
    }

    return false;
  }

  async checkHasParentWithGivenEmail(email) {
    return this.user
      .fetchByAttribute('email', email)
      .then((Users) => {
        if (!Users.length) {
          return false;
        }

        return Users.find(user => user.type === 'parent');
      });
  }

  async getByPreferredUsername(preferredUsername) {
    return this.user
      .fetchByAttribute('preferred_username', preferredUsername)
      .then(Users => (Users || [])[0]);
  }

  async postConfirmation(cognitoUserName, attributes, userPoolId) {
    const groupName = R.pathOr('child', ['custom:type'], attributes) === 'child'
      ? 'Child' : 'Parent';

    if (groupName === 'Parent') {
      await this.user.updateAttributes(cognitoUserName, {
        email_verified: 'true'
      });
    }

    return this.user.addUserToGroup(cognitoUserName, groupName, userPoolId);
  }

  addDeviceToken(targetUser, tokenData) {
    const hasDuplicatedToken = R.compose(
      R.find(R.propEq('token', tokenData.token)),
      R.pathOr([], ['deviceTokens'])
    );

    if (hasDuplicatedToken(targetUser)) {
      return targetUser;
    }

    const deviceTokens = (targetUser.deviceTokens || []).concat([tokenData]);

    return this.user.updateAttributes(targetUser['cognito:username'], {
      deviceTokens: JSON.stringify(deviceTokens)
    }).then(() => deviceTokens);
  }

  async removeDeviceToken(targetUser, tokenData) {
    const removeToken = R.compose(
      R.filter(({ token }) => token !== tokenData.token),
      R.pathOr([], ['deviceTokens'])
    );

    const deviceTokens = removeToken(targetUser);

    return this.user.updateAttributes(targetUser['cognito:username'], {
      deviceTokens: (!deviceTokens || !deviceTokens.length) ? '' : JSON.stringify(deviceTokens)
    }).then(() => deviceTokens);
  }
}
