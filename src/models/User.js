import AWSXRay from 'aws-xray-sdk-core';
import * as R from 'ramda';

const AWS = AWSXRay.captureAWS(require('aws-sdk'));

export default class UserModel {
  constructor() {
    this.cognito = new AWS.CognitoIdentityServiceProvider({
      region: process.env.REGION
    });
  }

  static attribNameMapper(origin, inversed) { // eslint-disable-line
    const mapping = {
      'sub': 'userId', // eslint-disable-line
      'preferred_username': 'username', // eslint-disable-line
      'custom:type': 'type',
      'cognito:groups': 'groups',
      'custom:familyIds': 'familyIds',
      'custom:deviceTokens': 'deviceTokens'
    };

    if (inversed) {
      const nMapping = R.invertObj(mapping);
      return nMapping[origin] || origin;
    }

    return mapping[origin] || origin;
  }

  static extractAttribFromCognitoUser(cognitoUser, attributesKey = 'UserAttributes') {
    if (!cognitoUser[attributesKey] || !Array.isArray(cognitoUser[attributesKey])) {
      return cognitoUser;
    }

    const plainObjAttribs = cognitoUser[attributesKey].reduce((container, attr) => {
      const key = UserModel.attribNameMapper(attr.Name);

      if (key === 'familyIds') {
        container[key] = attr.Value ? attr.Value.split(',') : []; // eslint-disable-line
      } else if (key === 'deviceTokens') {
        try { container[key] = JSON.parse(attr.Value); } catch (e) { container[key] = []; } // eslint-disable-line
      } else {
        container[key] = attr.Value;  // eslint-disable-line
      }

      return container;
    }, {});

    return {
      ...plainObjAttribs,
      _meta: R.omit(attributesKey, cognitoUser)
    };
  }

  getByCognitoUsername(cognitoUserName, userPoolId) {
    const params = {
      UserPoolId: userPoolId || process.env.COGNITO_POOL_ID,
      Username: cognitoUserName
    };

    return this.cognito
      .adminGetUser(params)
      .promise()
      .then(UserModel.extractAttribFromCognitoUser);
  }

  fetchById(userId, userPoolId) {
    return this
      .fetchByAttribute('sub', userId, userPoolId)
      .then(Users => Users[0]);
  }

  getByAccessToken(accessToken) {
    return this.cognito
      .getUser({ AccessToken: accessToken })
      .promise()
      .then(UserModel.extractAttribFromCognitoUser);
  }

  fetchByAttribute(attribName, attribValue, userPoolId) {
    // Note that you can't search for custom attributes
    const params = {
      UserPoolId: userPoolId || process.env.COGNITO_POOL_ID,
      Filter: `${attribName} = "${attribValue}"`
    };

    return this.cognito
      .listUsers(params)
      .promise()
      .then(data => data.Users.map(user => UserModel.extractAttribFromCognitoUser(user, 'Attributes')));
  }

  addUserToGroup(cognitoUserName, groupName, userPoolId) {
    const params = {
      UserPoolId: userPoolId || process.env.COGNITO_POOL_ID,
      GroupName: groupName,
      Username: cognitoUserName
    };

    return this.cognito
      .adminAddUserToGroup(params)
      .promise();
  }

  updateAttributes(cognitoUserName, attributes, userPoolId) {
    const params = {
      UserPoolId: userPoolId || process.env.COGNITO_POOL_ID,
      Username: cognitoUserName,
      UserAttributes:
        R.compose(
          R.map((attribName) => {
            if (attribName === 'familyIds') {
              return {
                Name: 'custom:familyIds',
                Value: attributes[attribName].join(',')
              };
            }

            return {
              Name: UserModel.attribNameMapper(attribName, true),
              Value: attributes[attribName]
            };
          }),
          R.keys
        )(attributes)
    };

    return this.cognito
      .adminUpdateUserAttributes(params)
      .promise();
  }

  deleteUser(cognitoUserName, userPoolId) {
    const params = {
      UserPoolId: userPoolId || process.env.COGNITO_POOL_ID,
      Username: cognitoUserName
    };

    return this.cognito.adminDeleteUser(params);
  }
}
