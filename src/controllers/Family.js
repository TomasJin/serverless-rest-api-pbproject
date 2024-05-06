import Boom from 'boom';
import * as R from 'ramda';
import FamilyModel from 'models/Family';
import UserModel from 'models/User';
import { notifyNewFamilyMemberJoined } from 'utils/noti/index';

export default class FamilyController {
  constructor() {
    this.family = new FamilyModel();
    this.user = new UserModel();
  }

  async get(id, scope) {
    const isFull = scope && scope === 'full';
    const family = await this.family.fetchById(id);

    if (!family) {
      throw Boom.notFound('Not existing family');
    }

    if (isFull) {
      const members = await this.family.fetchMembersByFamilyId(id);

      return {
        ...family,
        members: R.map(R.omit('familyId'), members)
      };
    }

    return family;
  }

  async fetchByUserId(userId) {
    const families = await this.family.fetchByMember(userId);
    const promises$ = families.map(family => this.get(family.familyId));

    return Promise.all(promises$);
  }

  async create(familyAdmin) {
    const newFamily = await this.family.create(familyAdmin);

    await this.family.join(newFamily.id, familyAdmin);

    // Update cognito user attribute
    const newAttribs = {
      familyIds: familyAdmin.familyIds.concat([newFamily.id]),
    };

    await this.user.updateAttributes(familyAdmin['cognito:username'], newAttribs);

    return newFamily;
  }

  async join(user, targetFamilyId) {
    const family = await this.family.fetchById(targetFamilyId);
    if (R.isEmpty(family.Item)) {
      throw Boom.notFound('not existing family');
    }

    const familyMember = await this.family.join(targetFamilyId, user);

    // Update cognito user attribute
    const newAttribs = {
      familyIds: user.familyIds.concat([targetFamilyId]),
    };

    if (user.type === 'child'/* && !user.email */) {
      newAttribs.email = family.adminSummary.email;
      newAttribs.email_verified = 'true';
    }

    await notifyNewFamilyMemberJoined(familyMember);

    return this.user.updateAttributes(user['cognito:username'], newAttribs);
  }

  async getFamilyUsernames(parentEmail) {
    const [parentUser] = await this.user.fetchByAttribute('email', parentEmail);
    if (!parentUser) {
      throw Boom.notFound('Not found any user with given email');
    }

    const { familyIds } = parentUser;
    if (!familyIds.length) {
      throw Boom.notFound('Given user has no family yet');
    }

    const sort = R.sortWith([
      R.descend(R.prop('type')),
      R.ascend(R.prop('username')),
    ]);

    const fetchMembersPromises = familyIds
      .map(familyId => this.family
        .fetchMembersByFamilyId(familyId, false)
        .then(members => members.map(member => R.pick(['username', 'type'])(member.userSummary)))
        .then(sort));

    return Promise.all(fetchMembersPromises);
  }
}
