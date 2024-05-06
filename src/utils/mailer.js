import SendinBlue from 'sendinblue-api';

const sendin = new SendinBlue({
  apiKey: process.env.SEND_IN_BLUE,
  // timeout: 5000
});

export const sendFamilyUsernamesReminder = (familyAdminEmail, usernames) => {
  const params = {
    id: 31, // sendinblue id of forgot username email template
    to: familyAdminEmail,
    attr: {
      USERNAMES: usernames
    }
  };

  return new Promise((resolve, reject) => {
    sendin.send_transactional_template(params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
};

export const sendForgotPincodeReminder = (familyAdminEmail, username) => {
  const params = {
    id: 32, // sendinblue id of forgot username email template
    to: familyAdminEmail,
    attr: {
      USERNAME: username
    }
  };

  return new Promise((resolve, reject) => {
    sendin.send_transactional_template(params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
};

export const sendWelcome = (email) => {
  const params = {
    id: 38, // sendinblue id of welcome email
    to: email
  };

  return new Promise((resolve, reject) => {
    sendin.send_transactional_template(params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
};

export default {
  sendFamilyUsernamesReminder,
  sendForgotPincodeReminder,
  sendWelcome
};
