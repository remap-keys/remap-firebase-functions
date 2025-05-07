import { CallableRequest, CallableResponse } from 'firebase-functions/https';
import { NeedAuthentication, ValidateRequired } from '../utils/decorators';
import {
  ERROR_ORDER_CREATE_FAILED,
  IResult,
  RemainingPurchaseStatus,
} from '../utils/types';
import {
  OrdersController,
  CheckoutPaymentIntent,
  OrderRequest,
} from '@paypal/paypal-server-sdk';
import { AbstractPurchaseCommand } from './abstract-purchase-command';

type IOrderCreateResult = {
  orderId?: string;
} & IResult;

export class OrderCreateCommand extends AbstractPurchaseCommand<IOrderCreateResult> {
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
    let historyDocRef:
      | FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>
      | undefined;
    try {
      // Create a purchase history.
      historyDocRef = await this.createPurchaseHistory(uid);

      // Send an order create request to PayPal.
      const client = this.createPayPalClient(
        secrets.paypalClientId,
        secrets.paypalClientSecret
      );
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
        await this.recordErrorMessage(
          historyDocRef,
          `Failed to create order. Status code: ${httpResponse.statusCode}`
        );
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
      if (historyDocRef !== undefined) {
        await this.recordErrorMessage(
          historyDocRef,
          `Error creating order: ${error}`
        );
      }
      return {
        success: false,
        errorCode: ERROR_ORDER_CREATE_FAILED,
        errorMessage: 'Order creation failed',
      };
    }
  }
}
