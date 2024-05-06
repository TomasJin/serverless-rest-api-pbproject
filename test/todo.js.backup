// const mochaPlugin = require('serverless-mocha-plugin');
import { lambdaWrapper, chai } from 'serverless-mocha-plugin';
import mod from '../src/handlers/todo';

const { expect } = chai;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'getall' });

// const expect = mochaPlugin.chai.expect;
// let wrapped = mochaPlugin.getWrapper('hello', '/handler.js', 'hello');

describe('function TODO', () => {
  before((done) => {
    // lambdaWrapper.init(liveFunction); // Run the deployed lambda
    done();
  });

  it('returns response', (done) => {
    wrapped
      .run({})
      .then((response) => {
        expect(response).to.not.be.empty;
        done();
      })
      .catch(done);
  });
});
