import { CallableRequest, CallableResponse } from 'firebase-functions/https';
import AbstractCommand from '../abstract-command';
import { NeedAuthentication, ValidateRequired } from '../utils/decorators';
import {
  ERROR_CAPTURE_ORDER_FAILED,
  IResult,
  RemainingPurchaseStatus,
} from '../utils/types';
import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
} from '@paypal/paypal-server-sdk';

export class CaptureOrderCommand extends AbstractCommand<IResult> {
  @NeedAuthentication()
  @ValidateRequired(['orderId'])
  async execute(
    request: CallableRequest,
    _response: CallableResponse | undefined,
    secrets: {
      jwtSecret: string;
      notificationUrl: string;
      paypalClientId: string;
      paypalClientSecret: string;
    }
  ): Promise<IResult> {
    const uid = request.auth!.uid;
    const orderId = request.data.orderId;

    try {
      // Check the purchase history.
      const historyDocRef = await this.db
        .collection('users')
        .doc('v1')
        .collection('purchases')
        .doc(uid)
        .collection('histories')
        .where('orderId', '==', orderId)
        .get();
      if (historyDocRef.empty) {
        return {
          success: false,
          errorCode: ERROR_CAPTURE_ORDER_FAILED,
          errorMessage: `The order[${orderId}] is not found`,
        };
      }
      if (historyDocRef.docs.length > 1) {
        return {
          success: false,
          errorCode: ERROR_CAPTURE_ORDER_FAILED,
          errorMessage: `The order[${orderId}] is duplicated`,
        };
      }
      const historyDoc = historyDocRef.docs[0];
      if (historyDoc.data().status !== RemainingPurchaseStatus.order_created) {
        return {
          success: false,
          errorCode: ERROR_CAPTURE_ORDER_FAILED,
          errorMessage: `The order[${orderId}] is not in the correct status`,
        };
      }

      // Update the purchase history.
      await historyDoc.ref.update({
        status: RemainingPurchaseStatus.capturing_order,
        updatedAt: new Date(),
      });

      // Send a request to PayPal to capture the order.
      const client = new Client({
        clientCredentialsAuthCredentials: {
          oAuthClientId: secrets.paypalClientId,
          oAuthClientSecret: secrets.paypalClientSecret,
        },
        timeout: 0,
        environment: Environment.Sandbox,
        logging: {
          logLevel: LogLevel.Debug,
          logRequest: { logBody: true },
          logResponse: { logHeaders: true },
        },
      });
      const ordersController = new OrdersController(client);
      const collect = {
        id: orderId,
        prefer: 'return=minimal',
      };
      const { body, ...httpResponse } =
        await ordersController.captureOrder(collect);
      console.log(body);

      if (httpResponse.statusCode !== 201) {
        return {
          success: false,
          errorCode: ERROR_CAPTURE_ORDER_FAILED,
          errorMessage: `Failed to capture order: ${httpResponse.statusCode}`,
        };
      }

      // Update the purchase history.
      await historyDoc.ref.update({
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
      return {
        success: false,
        errorCode: ERROR_CAPTURE_ORDER_FAILED,
        errorMessage: 'Capture order failed',
      };
    }
  }
}
