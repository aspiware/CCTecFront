import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { SubscriptionService } from '../shared/services/subscription.service';

@Component({
  standalone: true,
  selector: 'app-subscription',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss',
})
export class SubscriptionComponent implements OnInit {
  public isBusy = false;
  public message = '';

  private redirectTo = '/tabs';
  private readonly productId = 'com.aspiware.cctec.basic.weekly';
  private iapObserver: any;
  private pendingPurchase: {
    resolve: (value: { receiptData: string; productId?: string; transactionId?: string }) => void;
    reject: (reason?: any) => void;
  } | null = null;
  private pendingRestore: {
    resolve: (value: { receiptData: string }) => void;
    reject: (reason?: any) => void;
  } | null = null;
  private productsRequest: SKProductsRequest | null = null;
  private productsRequestDelegate: any;

  constructor(
    private subscriptionService: SubscriptionService,
    private routerExtensions: RouterExtensions,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (__IOS__) {
      this.ensureTransactionObserver();
    }

    this.redirectTo = this.route.snapshot.queryParamMap.get('redirect') || '/tabs';
    const reason = this.route.snapshot.queryParamMap.get('reason');

    if (reason === 'inactive') {
      this.message = 'Your subscription is inactive. Subscribe to continue.';
    } else if (reason === 'verify-error') {
      this.message = 'Could not verify your subscription. Please try again.';
    } else {
      this.message = 'Start your 7-day trial to unlock full access.';
    }
  }

  ngOnDestroy(): void {
    if (__IOS__ && this.iapObserver) {
      SKPaymentQueue.defaultQueue().removeTransactionObserver(this.iapObserver);
      this.iapObserver = null;
    }
  }

  public onSubscribe(): void {
    if (this.isBusy) {
      return;
    }

    this.isBusy = true;
    this.cdr.detectChanges();

    this.startApplePurchase(this.productId)
      .then((purchase) => {
        this.subscriptionService.validateApplePurchase(purchase).subscribe({
          next: (isActive) => {
            this.isBusy = false;
            if (isActive) {
              this.routerExtensions.navigate([this.redirectTo], { clearHistory: true });
              return;
            }
            this.message = 'Subscription could not be activated.';
            this.cdr.detectChanges();
          },
          error: () => {
            this.isBusy = false;
            this.message = 'Subscription validation failed.';
            this.cdr.detectChanges();
          },
        });
      })
      .catch((error) => {
        this.isBusy = false;
        this.message = String(error || 'Subscription failed. Try again.');
        this.cdr.detectChanges();
      });
  }

  public onRestore(): void {
    if (this.isBusy) {
      return;
    }

    this.isBusy = true;
    this.cdr.detectChanges();

    this.restoreApplePurchases()
      .then((restoreData) => {
        this.subscriptionService.validateApplePurchase(restoreData).subscribe({
          next: (isActive) => {
            this.isBusy = false;
            if (isActive) {
              this.routerExtensions.navigate([this.redirectTo], { clearHistory: true });
              return;
            }
            this.message = 'No active subscription found for this account.';
            this.cdr.detectChanges();
          },
          error: () => {
            this.isBusy = false;
            this.message = 'Restore validation failed.';
            this.cdr.detectChanges();
          },
        });
      })
      .catch((error) => {
        this.isBusy = false;
        this.message = String(error || 'Restore failed. Please try again.');
        this.cdr.detectChanges();
      });
  }

  private ensureTransactionObserver(): void {
    if (!__IOS__ || this.iapObserver) {
      return;
    }

    const self = this;
    const ObserverClass = (NSObject as any).extend(
      {
        paymentQueueUpdatedTransactions(_queue: SKPaymentQueue, transactions: NSArray<SKPaymentTransaction>) {
          for (let i = 0; i < transactions.count; i += 1) {
            const transaction = transactions.objectAtIndex(i);
            self.handleTransaction(transaction);
          }
        },
        paymentQueueRestoreCompletedTransactionsFinished(_queue: SKPaymentQueue) {
          if (!self.pendingRestore) {
            return;
          }
          const receiptData = self.getReceiptData();
          const pending = self.pendingRestore;
          self.pendingRestore = null;
          if (!receiptData) {
            pending.reject('Could not read receipt after restore.');
            return;
          }
          pending.resolve({ receiptData });
        },
        paymentQueueRestoreCompletedTransactionsFailedWithError(
          _queue: SKPaymentQueue,
          error: NSError
        ) {
          if (!self.pendingRestore) {
            return;
          }
          const pending = self.pendingRestore;
          self.pendingRestore = null;
          pending.reject(error?.localizedDescription || 'Restore failed.');
        },
      },
      {
        protocols: [SKPaymentTransactionObserver],
      }
    );

    this.iapObserver = ObserverClass.new();
    SKPaymentQueue.defaultQueue().addTransactionObserver(this.iapObserver);
  }

  private startApplePurchase(productId: string): Promise<{
    receiptData: string;
    productId?: string;
    transactionId?: string;
  }> {
    if (!__IOS__) {
      return Promise.reject('Apple subscription is only available on iOS.');
    }

    if (!SKPaymentQueue.canMakePayments()) {
      return Promise.reject('In-app purchases are disabled on this device.');
    }

    if (this.pendingPurchase) {
      return Promise.reject('A purchase is already in progress.');
    }

    this.ensureTransactionObserver();

    return new Promise((resolve, reject) => {
      this.pendingPurchase = { resolve, reject };

      this.fetchProduct(productId)
        .then((product) => {
          const payment = SKPayment.paymentWithProduct(product);
          SKPaymentQueue.defaultQueue().addPayment(payment);
        })
        .catch((error) => {
          this.pendingPurchase = null;
          reject(error);
        });
    });
  }

  private restoreApplePurchases(): Promise<{ receiptData: string }> {
    if (!__IOS__) {
      return Promise.reject('Restore is only available on iOS.');
    }

    if (this.pendingRestore) {
      return Promise.reject('A restore is already in progress.');
    }

    this.ensureTransactionObserver();

    return new Promise((resolve, reject) => {
      this.pendingRestore = { resolve, reject };
      SKPaymentQueue.defaultQueue().restoreCompletedTransactions();
    });
  }

  private fetchProduct(productId: string): Promise<SKProduct> {
    return new Promise((resolve, reject) => {
      const self = this;
      const DelegateClass = (NSObject as any).extend(
        {
          productsRequestDidReceiveResponse(
            request: SKProductsRequest,
            response: SKProductsResponse
          ) {
            const bundleId = NSBundle.mainBundle.bundleIdentifier || 'unknown.bundle';
            const validCount = response?.products?.count || 0;
            const invalidIdsArray =
              response?.invalidProductIdentifiers?.count
                ? Array.from(
                    { length: response.invalidProductIdentifiers.count },
                    (_, i) => String(response.invalidProductIdentifiers.objectAtIndex(i))
                  )
                : [];

            console.log(
              '[Subscription][StoreKit] products response',
              JSON.stringify({
                bundleId,
                requestedProductId: productId,
                validCount,
                invalidIds: invalidIdsArray,
              })
            );

            self.productsRequest = null;
            self.productsRequestDelegate = null;

            if (!response || response.products.count === 0) {
              const invalidIds = invalidIdsArray.length ? invalidIdsArray.join(', ') : 'none';
              reject(
                `Product not found. bundleId=${bundleId} productId=${productId} invalidIds=${invalidIds}`
              );
              return;
            }

            const product = response.products.objectAtIndex(0);
            resolve(product);
          },
          requestDidFailWithError(_request: SKRequest, error: NSError) {
            console.log(
              '[Subscription][StoreKit] products request failed',
              JSON.stringify({
                productId,
                code: error?.code,
                domain: error?.domain,
                message: error?.localizedDescription,
              })
            );
            self.productsRequest = null;
            self.productsRequestDelegate = null;
            reject(error?.localizedDescription || 'Failed to load product information.');
          },
        },
        { protocols: [SKProductsRequestDelegate] }
      );

      this.productsRequestDelegate = DelegateClass.new();
      const ids = NSSet.setWithArray([productId]);
      const request = SKProductsRequest.alloc().initWithProductIdentifiers(ids);
      request.delegate = this.productsRequestDelegate;
      this.productsRequest = request;
      request.start();
    });
  }

  private handleTransaction(transaction: SKPaymentTransaction): void {
    if (!this.pendingPurchase) {
      return;
    }

    switch (transaction.transactionState) {
      case SKPaymentTransactionState.Purchased:
      case SKPaymentTransactionState.Restored: {
        const receiptData = this.getReceiptData();
        const transactionId = transaction.transactionIdentifier
          ? String(transaction.transactionIdentifier)
          : undefined;
        const productId = transaction.payment?.productIdentifier
          ? String(transaction.payment.productIdentifier)
          : undefined;

        SKPaymentQueue.defaultQueue().finishTransaction(transaction);

        const pending = this.pendingPurchase;
        this.pendingPurchase = null;

        if (!receiptData) {
          pending.reject('Could not read App Store receipt.');
          return;
        }

        pending.resolve({ receiptData, transactionId, productId });
        break;
      }
      case SKPaymentTransactionState.Failed: {
        SKPaymentQueue.defaultQueue().finishTransaction(transaction);
        const pending = this.pendingPurchase;
        this.pendingPurchase = null;
        const err = transaction.error?.localizedDescription || 'Purchase failed.';
        pending.reject(err);
        break;
      }
      default:
        break;
    }
  }

  private getReceiptData(): string | null {
    if (!__IOS__) {
      return null;
    }

    const receiptUrl = NSBundle.mainBundle.appStoreReceiptURL;
    if (!receiptUrl) {
      return null;
    }

    const receipt = NSData.dataWithContentsOfURL(receiptUrl);
    if (!receipt) {
      return null;
    }

    return receipt.base64EncodedStringWithOptions(0 as NSDataBase64EncodingOptions);
  }
}
