import { path, pathOr } from 'ramda';
import User from 'models/User';

const user = new User();

export function parseCognitoUser(rawUser) {
  const WHITE_LIST = [
    'sub', 'cognito:username', 'cognito:groups',
    'custom:type', 'custom:familyIds', 'custom:deviceTokens',
    'email', 'preferred_username', 'phone_number', 'name'
  ];

  return WHITE_LIST.reduce((container, attribName) => {
    const newAttribName = User.attribNameMapper(attribName);

    if (newAttribName === 'familyIds') {
      container[newAttribName] = rawUser[attribName] ? rawUser[attribName].split(',') : [];  // eslint-disable-line
    } else if (newAttribName === 'deviceTokens') {
      try { container[newAttribName] = JSON.parse(rawUser[attribName]); } catch (e) { container[newAttribName] = []; } // eslint-disable-line
    } else {
      container[newAttribName] = rawUser[attribName];  // eslint-disable-line
    }

    return container;
  }, {});
}

export async function parseAPIGatewayEvent(event) {
  let data = {};

  if (event.body) {
    try {
      data = JSON.parse(event.body);
    } catch (e) {
      console.error('Error occur during parsing request body', e);
      data = {};
    }
  }

  let currentUser = parseCognitoUser(pathOr({}, ['requestContext', 'authorizer', 'claims'], event));
  if (currentUser && currentUser['cognito:username']) {
    const freshCognitoUser = await user.getByCognitoUsername(currentUser['cognito:username']);
    currentUser = {
      ...currentUser,
      ...freshCognitoUser
    };
  }

  return {
    body: data,
    path: path(['requestContext', 'resourcePath'], event),
    httpMethod: path(['requestContext', 'httpMethod'], event),
    stage: path(['requestContext', 'stage'], event),
    currentUser,
    params: event.pathParameters || event.path,
    queryParams: (event.queryStringParameters || event.query) || {},
    cognitoPoolClaims: event.cognitoPoolClaims,
  };
}

export function parseCognitoEvent(event) {
  return {
    attributes: path(['request', 'userAttributes'], event),
    cognitoUserName: event.userName,
    userPoolId: event.userPoolId,
    validationData: path(['request', 'validationData'], event) || {}
  };
}

export function parseSNSEvent(event) {
  const sns = path(['Records', 0, 'Sns'], event);
  let message;

  try {
    message = JSON.parse(path(['Message'], sns));
  } catch (e) {
    message = {};
  }

  return {
    message,
    attributes: path(['MessageAttributes'], sns)
  };
}
