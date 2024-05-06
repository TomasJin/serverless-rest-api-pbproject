import boom from 'boom';

const needBoomLogging = process.env.ERROR_LEVEL === 'VERBOSE';
const needCriticalLogging = needBoomLogging || process.env.DEBUG_BOOM === 'CRITICAL';

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body
  };
}

export function success(body, isCreated) {
  return buildResponse(isCreated ? 201 : 200, JSON.stringify(body));
}

export function failure(err, event) {
  if (boom.isBoom(err)) {
    needBoomLogging && console.log(err);
    needBoomLogging && event && console.log(JSON.stringify(event, null, 4));
    return buildResponse(err.output.statusCode, JSON.stringify(err.output.payload));
  }

  needCriticalLogging && console.log(err);
  needCriticalLogging && event && console.log(JSON.stringify(event, null, 4));
  return buildResponse(500, err.toString());
}
