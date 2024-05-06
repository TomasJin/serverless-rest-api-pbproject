'use strict';

const mochaPlugin = require('serverless-mocha-plugin');

const expect = mochaPlugin.chai.expect;
const wrapped = mochaPlugin.getWrapper('preSignup', '/src/handlers/signup.js', 'preSignup');

describe('preSignup - signup data validation', () => {
  before((done) => {
    done();
  });

  describe('- username validation check', () => {
    it('should return validation error when empty input', () => {
      return wrapped.run({})
        .catch((error) => {
          const json = JSON.parse(error);
          const expectedErrorType = 'validation error';
          expect(json).to.have.property('errorType', expectedErrorType);
        });
    });

    it('should return validation error when pureUserName is missing in validationData', () => {
      const event = {
        request: {
          validationData: {
          }
        }
      };
      // attributes: path(['request', 'userAttributes'], event),
      // cognitoUserName: event.userName,
      // userPoolId: event.userPoolId,
      // validationData: path(['request', 'validationData'], event) || {}

      return wrapped.run(event)
        .catch((error) => {
          const json = JSON.parse(error);
          expect(json).to.have.property('errorType', 'validation error');
          expect(json).to.have.property('errorMessage', 'pureUserName is missing in validationData');
        });
    });

    it('should return validation error when username is dirty', () => {
      const event = {
        request: {
          validationData: {
            pureUserName: 'fuck'
          }
        }
      };

      return wrapped.run(event)
        .catch((error) => {
          const json = JSON.parse(error);
          expect(json).to.have.property('errorType', 'username validation error');
        });
    });

    it('should return validation error when username is not in rule', () => {
      const BAD_USERNAME = 'bad username!@#$!@#$';
      const event = {
        request: {
          validationData: {
            pureUserName: BAD_USERNAME
          }
        }
      };

      return wrapped.run(event)
        .catch((error) => {
          const json = JSON.parse(error);
          expect(json).to.have.property('errorMessage', 'username can only have a-z dot(.) underscore(_) and dash(-)');
        });
    });

    const ALREADY_REGISTERED = 'james';
    it('should return validation error if already registered', () => {
      const event = {
        request: {
          validationData: {
            pureUserName: ALREADY_REGISTERED
          }
        }
      };

      return wrapped.run(event)
        .catch((error) => {
          const json = JSON.parse(error);
          expect(json).to.have.property('errorMessage', 'This username is already registered');
        });
    });
  });

  describe('- email validation check', () => {
    const ALREADY_REGISTERED = 'jameslin@gmx.hk';
    it('should return validation error if already registered', () => {
      const event = {
        request: {
          validationData: {
            pureUserName: 'something_new'
          },
          userAttributes: {
            'custom:type': 'parent',
            email: ALREADY_REGISTERED
          }
        }
      };

      return wrapped.run(event)
        .catch((error) => {
          const json = JSON.parse(error);
          expect(json).to.have.all.keys(['errorType', 'errorMessage']);
          expect(json).to.have.property('errorMessage', 'This email is already registered');
        });
    });
  });

  it('should auto confirm user if signup data is good', () => {
    const goodEvent = {
      request: {
        validationData: {
          pureUserName: 'fresh_new_god'
        },
        userAttributes: {
          'custom:type': 'parent',
          email: 'fresh_new_god@email.com'
        }
      },
      response: {}
    };

    return wrapped.run(goodEvent)
      .then((data) => {
        expect(data.response).to.have.property('autoConfirmUser', true);
      });
  });
});
