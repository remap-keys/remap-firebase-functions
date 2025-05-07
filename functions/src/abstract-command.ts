import { IResult } from './utils/types';
import { Firestore } from 'firebase-admin/firestore';
import { CallableRequest, CallableResponse } from 'firebase-functions/v2/https';
import { Auth } from 'firebase-admin/auth';

abstract class AbstractCommand<R extends IResult = IResult> {
  db: Firestore;
  auth: Auth;

  constructor(db: Firestore, auth: Auth) {
    this.db = db;
    this.auth = auth;
  }

  abstract execute(
    request: CallableRequest,
    response: CallableResponse | undefined,
    secrets: {
      jwtSecret: string;
      notificationUrl: string;
      paypalClientIdForSandbox: string;
      paypalClientSecretForSandbox: string;
      paypalClientIdForProduction: string;
      paypalClientSecretForProduction: string;
    }
  ): Promise<R>;

  async checkUserIsAdministrator(uid: string): Promise<boolean> {
    const userRecord = await this.auth.getUser(uid);
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
