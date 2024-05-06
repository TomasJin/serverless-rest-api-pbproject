# API Documentation (immature version)

## Endpoint

Prod endpoint: `https://api-prod.pbox.com/v2` <br/>
Staging endpoint: `https://api-stage.pbox.com/v2`

## Authorization

Almost every api request should have `Authorization` header set with idToken from Cognito authentication.
The public apis (doesn't need to send `Authorization` header) are checkHealth, getUnreadNotificationsCount

## APIs

### User api

- getMe: `GET /user/me`

  No params required, returns current user's detail information.

- listJobsByFamilyMember:

  - `GET user/me/jobs/{familyId}` -> List my jobs
  - `GET user/{userId}/jobs/{familyId}`-> List specific user's job

- listWithdrawalsByFamilyMember:

  - `GET user/me/withdrawals/{familyId}` -> List my withdrawal requests
  - `GET user/{userId}/withdrawals/{familyId}`-> List specific user's withdrawal requests

- listTransactionsByFamilyMember:
  - `GET user/me/transactions/{familyId}` -> List my transaction history
  - `GET user/{userId}/transactions/{familyId}`-> List specific user's transaction history

### Family api

- getFamily: `GET family/{familyId}`

  Returns family detail information including family members

- createFamily: `POST family`

  Doable role: Parent - (only parent user can do this op)<br/>
  Creates family. Note that maximum available families per a single user are two.
  No params requierd:

- joinFamily: `POST family/join`

  request parameter

  ```
  { familyId: "string" }
  ```

- listJobsByFamily: `POST family/{familyId}/jobs`

- listWithdrawalsByFamily: `POST family/{familyId}/withdrawals`

- listTransactionsByFamily: `POST family/{familyId}/transactions`
  Note that transaction histories are automatically generated per the user activities.

### Job api

- getJob: `GET job/{jobId}`

  Returns job(task) detail information

- createJob: `POST job`

  Create a single job. Any type of users can do this op.

  request parameter

  ```
  {
    familyId: "string",
    childUserId: "string",
    jobSummary: {
      title: "string",
      price: "number",
      backdropResource: "string"
    }
  }
  ```

- updateJobStatus: `PUT job/{jobId}/status`

  Update job status
  Available job status: `CREATED_BY_PARENT`, `CREATED_BY_CHILD`, `START_APPROVED`, `START_DECLINED`, `STARTED`, `FINISHED`, `FINISH_DECLINED`, `PAID`

  request parameter

  ```
    status: "string",
    meta: {}  // Object includes any meta information
  ```

### Withdrawal request api

- getWithdrawal: `GET withdrawal/{withdrawalId}`

  Returns withdrawal request detail information

- createWithdrawal: `POST withdrawl`

  Create a single withdrawal request. Any type of users can do this op.

  request parameter

  ```
  {
    familyId: "string",
    childUserId: "string",
    amount: number
  }
  ```

- updateWithdrawalStatus: `PUT withdrawal/{withdrawalId}/status`

  Update withdrawal request status
  Available withdrawal request status: `CREATED_BY_CHILD`, `CREATED_BY_PARENT`, `APPROVED`, `REJECTED`, `CANCELED`
  Only return success when user has available balance or have pending withdrawal request less than 2.

  request parameter

  ```
    status: "string",
    meta: {}  // Object includes any meta information
  ```

### notification

- listMyNotifications: `POST user/me/notifications`

  list my all recent notifications

- markSingleNotificationAsRead: `PUT notification/{notificationId}`

  Mark one as read

- getUnreadNotificationsCount: `GET notification/unread`

  request GET parameter: `usernames` array of user name.

- addMyDeviceToken: `POST user/me/tokens`

  Register my iOS device token to get push

  request parameter:

  ```
    {
      model: "string" // device model
      token: "string"
    }
  ```

- removeMyDeviceToken: `DELETE user/me/tokens/{token}`

  Remove my device token to not receive push.

### Misc

- forgotUsername: `POST remind/family_usernames`

  Send email with all family member's username

  request parameter:

  ```
    email: "string" // Email address of family user
  ```

- forgotPincode: `POST remind/forgot_pincode`

  Send email to family Admin telling that child forgot pincode.

  Doable role: Only child user can do this op.

  request parameter:

  ```
    username: "string" // Child user name
  ```
