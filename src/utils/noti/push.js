import AWSXRay from 'aws-xray-sdk-core';
import * as R from 'ramda';

const AWS = AWSXRay.captureAWS(require('aws-sdk'));

const sns = new AWS.SNS({
  region: process.env.REGION
});

const startsWith = R.curry((prefix, xs) => R.equals(R.take(prefix.length, xs), prefix));
const is_iOS_token = ({ model }) => startsWith('iPhone', model) || startsWith('iPad', model) || startsWith('iPod', model); // eslint-disable-line

export function sendAPNToSingleDevice(token, msgText, meta) {
  const createEndpointParams = {
    PlatformApplicationArn: process.env.SNS_PUSH_APN_ARN,
    Token: token,
    Attributes: {
      Enabled: 'true'
    }
  };

  sns
    .createPlatformEndpoint(createEndpointParams).promise()
    .then(({ EndpointArn }) => {
      const payload = {
        default: msgText,
        APNS: JSON.stringify({
          aps: {
            alert: msgText,
            sound: 'default',
            badge: 1
          },
          meta
        })
      };

      return sns.publish({
        Message: JSON.stringify(payload),
        MessageStructure: 'json',
        TargetArn: EndpointArn
      }).promise();
    });
}

export const sendPush = (deviceTokens, msgText, meta = {}) => {
  console.log('Received push request to', JSON.stringify(deviceTokens, null, 4));
  const iosTokens = R.compose(
    R.map(R.prop('token')),
    R.filter(is_iOS_token)
  )(deviceTokens);

  console.log('Please send push to ', iosTokens);
  console.log('With this content:', msgText, meta);

  return Promise.all(iosTokens.map(token => sendAPNToSingleDevice(token, msgText, meta)));
};
