import { success } from 'utils/response';

export function health(event, context, callback) {
  const healthData = {
    health: 'good',
    requiredVersion: '2.0.0'
  };

  const response = success(healthData);

  callback(null, response);
}

export default { health }; // Add this for test
