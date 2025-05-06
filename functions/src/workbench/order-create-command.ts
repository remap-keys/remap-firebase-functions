import { CallableRequest, CallableResponse } from 'firebase-functions/https';
import AbstractCommand from '../abstract-command';
import { NeedAuthentication, ValidateRequired } from '../utils/decorators';
import {
  ERROR_ORDER_CREATE_FAILED,
  IResult,
  RemainingPurchaseStatus,
} from '../utils/types';
import {
  Client,
  OrdersController,
  Environment,
  LogLevel,
  CheckoutPaymentIntent,
  OrderRequest,
} from '@paypal/paypal-server-sdk';

type IOrderCreateResult = {
  orderId?: string;
} & IResult;

export class OrderCreateCommand extends AbstractCommand<IOrderCreateResult> {
  @NeedAuthentication()
  @ValidateRequired(['language'])
  async execute(
    request: CallableRequest,
    _response: CallableResponse | undefined,
    secrets: {
      jwtSecret: string;
      notificationUrl: string;
      paypalClientId: string;
      paypalClientSecret: string;
    }
  ): Promise<IOrderCreateResult> {
    const uid = request.auth!.uid;
    const language = request.data.language as string;
    try {
      // Create a purchase history.
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

      // Send an order create request to PayPal.
      const client = new Client({
        clientCredentialsAuthCredentials: {
          oAuthClientId: secrets.paypalClientId,
          oAuthClientSecret: secrets.paypalClientSecret,
        },
        timeout: 0,
        // environment: Environment.Sandbox,
        environment: Environment.Production,
        logging: {
          logLevel: LogLevel.Debug,
          logRequest: { logBody: true },
          logResponse: { logHeaders: true },
        },
      });
      const ordersController = new OrdersController(client);
      const collect = {
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              amount: {
                currencyCode: 'USD',
                value: '1.65',
                breakdown: {
                  itemTotal: {
                    currencyCode: 'USD',
                    value: '1.50',
                  },
                  taxTotal: {
                    currencyCode: 'USD',
                    value: '0.15',
                  },
                },
              },
              description:
                language === 'ja'
                  ? 'Remap 10回ビルドパッケージを購入することで、ファームウェアワークベンチ機能を使ってあなた独自のファームウェアを10回ビルドすることができます。'
                  : 'Remap 10 Builds Package',
              items: [
                {
                  name:
                    language === 'ja'
                      ? 'Remap 10回ビルドパッケージ'
                      : 'Remap 10 Builds Package',
                  unitAmount: {
                    currencyCode: 'USD',
                    value: '1.50',
                  },
                  quantity: '1',
                  sku: 'remap-10-builds-package',
                },
              ],
            },
          ],
          applicationContext: {
            shippingPreference: 'NO_SHIPPING',
          },
        } as OrderRequest,
        prefer: 'return=minimal',
      };
      const { body, result, ...httpResponse } =
        await ordersController.createOrder(collect);
      console.log(body);

      if (httpResponse.statusCode !== 201) {
        console.error('Failed to create order:', httpResponse);
        return {
          success: false,
          errorCode: ERROR_ORDER_CREATE_FAILED,
          errorMessage: 'Order creation failed',
        };
      }

      // Update the purchase history.
      await historyDocRef.update({
        status: RemainingPurchaseStatus.order_created,
        createOrderResponseJson: body,
        orderId: result.id, // PayPal order ID should not be undefined if the status code is 201.
        updatedAt: new Date(),
      });

      // Send a response to the client.
      return {
        success: true,
        orderId: result.id,
      };
    } catch (error) {
      console.error('Error creating order:', error);
      return {
        success: false,
        errorCode: ERROR_ORDER_CREATE_FAILED,
        errorMessage: 'Order creation failed',
      };
    }
  }
}
