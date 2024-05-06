### COMING SOON

### Keep your lambda functions warm
Coming from https://github.com/postlight/serverless-babel-starter

Lambda functions will go "cold" if they haven't been invoked for a certain period of time (estimates vary, and AWS doesn't offer a clear answer). From the [Serverless blog](https://serverless.com/blog/keep-your-lambdas-warm/):

> Cold start happens when you execute an inactive (cold) function for the first time. It occurs while your cloud provider provisions your selected runtime container and then runs your function. This process, referred to as cold start, will increase your execution time considerably.

A frequently running function won't have this problem, but you can keep your function running hot by scheduling a regular ping to your lambda function. Here's what that looks like in your `serverless.yml`:

```yaml
functions:
  myFunc:
    handler: handler.myFunc
    timeout: 10
    memorySize: 256
    events:
      # ...other config happening up here and then...
      # Ping every 5 minutes to avoid cold starts
      - schedule:
          rate: rate(5 minutes)
          enabled: true
```

Your handler function can then handle this event like so:

```javascript
const myFunc = (event, context, callback) => {
  // Detect the keep-alive ping from CloudWatch and exit early. This keeps our
  // lambda function running hot.
  if (event.source === 'aws.events') { // aws.events is the source for Scheduled events
    return callback(null, 'pinged');
  }

  // ... the rest of your function
}

export default myFunc;

```

Copying and pasting the above can be tedious, so we've added a higher order function to wrap your run-warm functions. You still need to configure the ping in your `serverless.yml` file; then your function should look like this:

```javascript
import runWarm from './utils'

const myFunc = (event, context, callback) => {
  // Your function logic
}

export default runWarm(myFunc);
```
