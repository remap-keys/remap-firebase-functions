import { CallableRequest, CallableResponse } from 'firebase-functions/https';
import { NeedAuthentication, ValidateRequired } from '../utils/decorators';
import {
  ERROR_CAPTURE_ORDER_FAILED,
  IResult,
  RemainingPurchaseStatus,
} from '../utils/types';
import { OrdersController } from '@paypal/paypal-server-sdk';
import { AbstractPurchaseCommand } from './abstract-purchase-command';

export class CaptureOrderCommand extends AbstractPurchaseCommand<IResult> {
  @NeedAuthentication()
  @ValidateRequired(['orderId', 'environment'])
  async execute(
    request: CallableRequest,
    _response: CallableResponse | undefined,
    secrets: {
      jwtSecret: string;
      notificationUrl: string;
      paypalClientIdForSandbox: string;
      paypalClientSecretForSandbox: string;
      paypalClientIdForProduction: string;
      paypalClientSecretForProduction: string;
    }
  ): Promise<IResult> {
    const uid = request.auth!.uid;
    const orderId = request.data.orderId;
    const environment = request.data.environment as string;
    if (environment !== 'sandbox' && environment !== 'production') {
      throw new Error(
        `Invalid environment: ${environment}. It should be 'sandbox' or 'production'.`
      );
    }

    let historyDocRef:
      | FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>
      | undefined;
    try {
      // Check the purchase history.
      const historyDocsRef = await this.fetchPurchaseHistory(uid, orderId);
      if (historyDocsRef.empty) {
        return {
          success: false,
          errorCode: ERROR_CAPTURE_ORDER_FAILED,
          errorMessage: `The order[${orderId}] is not found`,
        };
      }
      if (historyDocsRef.docs.length > 1) {
        return {
          success: false,
          errorCode: ERROR_CAPTURE_ORDER_FAILED,
          errorMessage: `The order[${orderId}] is duplicated`,
        };
      }
      const historyDoc = historyDocsRef.docs[0];
      historyDocRef = historyDoc.ref;
      if (historyDoc.data().status !== RemainingPurchaseStatus.order_created) {
        await this.recordErrorMessage(
          historyDocRef,
          `The order[${orderId}] is not in the correct status: ${historyDoc.data().status}`
        );
        return {
          success: false,
          errorCode: ERROR_CAPTURE_ORDER_FAILED,
          errorMessage: `The order[${orderId}] is not in the correct status`,
        };
      }

      // Update the purchase history.
      await historyDocRef.update({
        status: RemainingPurchaseStatus.capturing_order,
        updatedAt: new Date(),
      });

      // Send a request to PayPal to capture the order.
      const client = this.createPayPalClient(
        environment,
        environment === 'sandbox'
          ? secrets.paypalClientIdForSandbox
          : secrets.paypalClientIdForProduction,
        environment === 'sandbox'
          ? secrets.paypalClientSecretForSandbox
          : secrets.paypalClientSecretForProduction
      );
      const ordersController = new OrdersController(client);
      const collect = {
        id: orderId,
        prefer: 'return=minimal',
      };
      const { body, ...httpResponse } =
        await ordersController.captureOrder(collect);
      console.log(body);

      if (httpResponse.statusCode !== 201) {
        await this.recordErrorMessage(
          historyDoc.ref,
          `Failed to capture order. Status code: ${httpResponse.statusCode}`
        );
        return {
          success: false,
          errorCode: ERROR_CAPTURE_ORDER_FAILED,
          errorMessage: `Failed to capture order: ${httpResponse.statusCode}`,
        };
      }

      // Update the purchase history.
      await historyDocRef.update({
        status: RemainingPurchaseStatus.order_captured,
        captureOrderResponseJson: body,
        updatedAt: new Date(),
      });

      // Increase the remaining builds.
      const userDocRef = this.db
        .collection('users')
        .doc('v1')
        .collection('purchases')
        .doc(uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        await this.recordErrorMessage(
          historyDocRef,
          `The purchase document for the user[${uid}] is not found`
        );
        return {
          success: false,
          errorCode: ERROR_CAPTURE_ORDER_FAILED,
          errorMessage: `User[${uid}] is not found`,
        };
      }
      const remainingBuildCount = userDoc.data()!.remainingBuildCount || 0;
      await userDocRef.update({
        remainingBuildCount: remainingBuildCount + 10,
        updatedAt: new Date(),
      });

      // Send a response to the client.
      return {
        success: true,
      };
    } catch (error) {
      console.error('Capture order failed:', error);
      if (historyDocRef !== undefined) {
        await this.recordErrorMessage(
          historyDocRef,
          `Capture order failed: ${error}`
        );
      }
      return {
        success: false,
        errorCode: ERROR_CAPTURE_ORDER_FAILED,
        errorMessage: 'Capture order failed',
      };
    }
  }
}
