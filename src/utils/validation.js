import pluralize from 'pluralize';
import swearjar from 'swearjar';
import joi from 'joi';
import * as R from 'ramda';
import { availableJobStatus } from 'models/Job';
import { availableWithdrawalStatus } from 'models/Withdrawal';
import { AVAILABLE_NOTIFICATIONS } from 'utils/noti';

// const getPlainError = joiError => R.compose(
//   R.map(R.prop('message')),
//   R.path(['error', 'details'])
// )(joiError).join('\n');
const getPlainError = joiError => R.path(['error', 'details', 0, 'message'], joiError);

const stripSpecial = str => str.replace(/[^a-zA-Z ]/g, '');

export const checkIfReserved = (str) => {
  const stripped = stripSpecial(str);
  const reservedWords = [
    'pennybox', 'pbox', 'pennyboxadmin', 'penny', 'boxpenny', 'box', 'pennylabs', 'penbox', 'money', 'finance', 'pocketmoney',
    'kid', 'child', 'parent', 'mum', 'dad', 'boy', 'girl', 'uncle', 'aunty', 'grandfather', 'grandmother', 'granny', 'nanny',
    'grandpa', 'granpa', 'grandma', 'granma', 'bro', 'sis', 'cuz', 'him', 'his', 'her', 'his'
  ];

  return !!(reservedWords.filter(word => word === stripped || pluralize(word) === stripped).length);
};

export const checkIfProfane = (str) => {
  const stripped = stripSpecial(str);

  return swearjar.profane(stripped);
};

export const checkCreateJobDataSchema = (rawData) => {
  const schema = joi.object().keys({
    familyId: joi.string().uuid().required(),
    childUserId: joi.string().uuid(),
    jobSummary: joi.object().keys({
      title: joi.string().required(),
      price: joi.number().required(),
      backdropResource: joi.string().uri().allow(null)
    }),
  });

  return getPlainError(joi.validate(rawData, schema));
};

export const checkUpdateJobStatusSchema = (rawData) => {
  const schema = joi.object().keys({
    status: joi.string().valid(Object.keys(availableJobStatus)).required(),
    meta: joi.object()
  });

  return getPlainError(joi.validate(rawData, schema));
};

export const checkUpdateJobSummarySchema = (rawData) => {
  const schema = joi.object().keys({
    title: joi.string().required(),
    price: joi.number().required(),
    backdropResource: joi.string().uri().allow(null)
  });

  return getPlainError(joi.validate(rawData, schema));
};

export const checkAllowedJobStatusSafeUpdate = (userType, originStatus, newStatus) => {
  if (!availableJobStatus[newStatus].allowedRoles.includes(userType)) {
    return 'This user type is not allowed to update job to target status';
  }

  if (!availableJobStatus[originStatus].availableNextMove.includes(newStatus)) {
    return 'Forbidden job status update';
  }

  if (newStatus === 'REMOVED'
    && userType === 'child'
    && !['CREATED_BY_CHILD', 'START_DECLINED'].includes(originStatus)) {
    return 'Child can only delete job before its accepted by parent';
  }

  return null;
};

export const checkAllowedJobSummarySafeUpdate = (userType, currentStatus) => {
  if (['REMOVED', 'PAID', 'START_DECLINED'].includes(currentStatus)) {
    return 'Forbidden job summary update';
  }

  if (userType === 'child' && currentStatus !== 'CREATED_BY_CHILD') {
    return 'Child can only update job before its accepted by parent';
  }

  return null;
};

export const checkCreateWithdrawalDataSchema = (rawData) => {
  const schema = joi.object().keys({
    familyId: joi.string().uuid().required(),
    childUserId: joi.string().uuid(),
    amount: joi.number().required()
  });

  return getPlainError(joi.validate(rawData, schema));
};

export const checkUpdateWithdrawalStatusSchema = (rawData) => {
  const schema = joi.object().keys({
    status: joi.string().valid(Object.keys(availableWithdrawalStatus)).required(),
  });

  return getPlainError(joi.validate(rawData, schema));
};

export const checkAllowedWithdrawalStatusSafeUpdate = (userType, original, newone) => {
  if (!(['CREATED_BY_CHILD', 'CREATED_BY_PARENT'].includes(original))) {
    return 'Withdrawal request is already disposed';
  }

  if (!availableWithdrawalStatus[newone].allowedRoles.includes(userType)) {
    return 'This user type is not allowed to update withdrawal request to target status';
  }

  return null;
};

export const checkforgotUsernameSchema = (rawData) => {
  const schema = joi.object().keys({
    email: joi.string().email().required()
  });

  return getPlainError(joi.validate(rawData, schema));
};

export const checkforgotPasswordSchema = (rawData) => {
  const schema = joi.object().keys({
    username: joi.string().required()
  });

  return getPlainError(joi.validate(rawData, schema));
};

export const checkAddDeviceTokenSchema = (rawData) => {
  const schema = joi.object().keys({
    model: joi.string().required(),
    token: joi.string().required()
  });

  return getPlainError(joi.validate(rawData, schema));
};

export const checkValidNotiTriggerMessage = message =>
  message.content && Object.keys(AVAILABLE_NOTIFICATIONS).includes(message.content);
