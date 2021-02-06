import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {IResult} from "./types";

abstract class AbstractCommand<R extends IResult = IResult> {
  protected db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  abstract async execute(data: any, context: functions.https.CallableContext): Promise<R>;

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

}

export default AbstractCommand;
