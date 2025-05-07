import { Client, Environment, LogLevel } from '@paypal/paypal-server-sdk';
import AbstractCommand from '../abstract-command';
import { IResult, RemainingPurchaseStatus } from '../utils/types';

export abstract class AbstractPurchaseCommand<
  T extends IResult,
> extends AbstractCommand<T> {
  protected createPayPalClient(
    environment: 'sandbox' | 'production',
    clientId: string,
    clientSecret: string
  ) {
    const client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      timeout: 0,
      environment:
        environment === 'sandbox'
          ? Environment.Sandbox
          : Environment.Production,
      logging: {
        logLevel: LogLevel.Debug,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
      },
    });
    return client;
  }

  protected async createPurchaseHistory(
    uid: string
  ): Promise<
    FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>
  > {
    const historyDocRef = await this.db
      .collection('users')
      .doc('v1')
      .collection('purchases')
      .doc(uid)
      .collection('histories')
      .add({
        status: RemainingPurchaseStatus.creating_order,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    return historyDocRef;
  }

  protected async fetchPurchaseHistory(
    uid: string,
    orderId: string
  ): Promise<FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>> {
    const historyDocRef = await this.db
      .collection('users')
      .doc('v1')
      .collection('purchases')
      .doc(uid)
      .collection('histories')
      .where('orderId', '==', orderId)
      .get();
    return historyDocRef;
  }

  protected async recordErrorMessage(
    historyDocRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
    errorMessage: string
  ): Promise<void> {
    try {
      await historyDocRef.update({
        errorMessage: errorMessage,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Recording error message failed:', error);
    }
  }
}
