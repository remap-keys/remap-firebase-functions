import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { IResult } from './utils/types';

abstract class AbstractCommand<R extends IResult = IResult> {
  protected db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  abstract execute(
    data: any,
    context: functions.https.CallableContext
  ): Promise<R>;

  async checkUserIsAdministrator(uid: string): Promise<boolean> {
    const userRecord = await admin.auth().getUser(uid);
    const email = userRecord.email;
    if (!email) {
      return false;
    }
    const administratorsSnapshot = await this.db
      .collection('configurations')
      .doc('administrators')
      .get();
    if (!administratorsSnapshot.exists) {
      return false;
    }
    const administrators = administratorsSnapshot.data()?.users || [];
    return administrators.includes(email);
  }

  async checkUserIsOrganizationMember(
    uid: string,
    organizationId: string
  ): Promise<boolean> {
    const organizationDocumentSnapshot = await this.db
      .collection('organizations')
      .doc('v1')
      .collection('profiles')
      .doc(organizationId)
      .get();
    if (!organizationDocumentSnapshot.exists) {
      return false;
    }
    const members = organizationDocumentSnapshot.data()?.members || [];
    return members.includes(uid);
  }
}

export default AbstractCommand;
