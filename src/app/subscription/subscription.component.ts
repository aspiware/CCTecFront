import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { alert, Application, Page, Utils } from '@nativescript/core';
import { ConfigService } from '../shared/services/config.service';
import { SubscriptionService } from '../shared/services/subscription.service';
import { UsersService } from '../shared/services/users.service';

@Component({
  standalone: true,
  selector: 'app-subscription',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss',
})
export class SubscriptionComponent implements OnInit {
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public isBusy = false;

  private redirectTo = '/tabs';
  private readonly productId = 'com.aspiware.cctec.basic.monthly';
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
  private appearanceChangedHandler?: () => void;
  private resumeHandler?: () => void;

  constructor(
    private subscriptionService: SubscriptionService,
    private configService: ConfigService,
    private usersService: UsersService,
    private routerExtensions: RouterExtensions,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private page: Page
  ) {}

  ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);

    if (__IOS__) {
      this.ensureTransactionObserver();
      this.resumeHandler = () => this.processCurrentTransactions();
      Application.on(Application.resumeEvent, this.resumeHandler);
    }

    this.redirectTo = this.route.snapshot.queryParamMap.get('redirect') || '/tabs';
    const reason = this.route.snapshot.queryParamMap.get('reason');
    const shouldRestore = this.route.snapshot.queryParamMap.get('restore') === '1';

    // if (reason === 'inactive') {
    //   this.showErrorAlert('Your subscription is inactive. Subscribe to continue.');
    // } else if (reason === 'verify-error') {
    //   this.showErrorAlert('Could not verify your subscription. Please try again.');
    // }

    if (shouldRestore) {
      setTimeout(() => this.onRestore(), 0);
    }
  }

  ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }

    if (__IOS__ && this.iapObserver) {
      SKPaymentQueue.defaultQueue().removeTransactionObserver(this.iapObserver);
      this.iapObserver = null;
    }

    if (this.resumeHandler) {
      Application.off(Application.resumeEvent, this.resumeHandler);
      this.resumeHandler = undefined;
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onSubscribe(): void {
    if (this.usersService.isActiveDemoUser()) {
      this.subscriptionService.setLocalStatus(true);
      this.routerExtensions.navigate([this.redirectTo], { clearHistory: true });
      return;
    }

    if (this.isBusy) {
      return;
    }

    this.isBusy = true;
    this.cdr.detectChanges();

    this.startApplePurchase(this.productId)
      .then((purchase) => {
        console.log(
          '[Subscription] purchase resolved',
          JSON.stringify({
            productId: purchase?.productId,
            transactionId: purchase?.transactionId,
            hasReceiptData: Boolean(purchase?.receiptData),
          })
        );
        this.subscriptionService.validateApplePurchase(purchase).subscribe({
          next: (result) => {
            console.log('[Subscription] validate result', JSON.stringify(result));
            this.isBusy = false;
            if (result.isActive) {
              console.log('[Subscription] navigating after subscribe', JSON.stringify({ redirectTo: this.redirectTo }));
              this.routerExtensions.navigate([this.redirectTo], { clearHistory: true });
              return;
            }
            this.showErrorAlert(result.message || 'Subscription could not be activated.');
            this.cdr.detectChanges();
          },
          error: () => {
            this.isBusy = false;
            this.showErrorAlert('Subscription validation failed.');
            this.cdr.detectChanges();
          },
        });
      })
      .catch((error) => {
        this.isBusy = false;
        this.showErrorAlert(String(error || 'Subscription failed. Try again.'));
        this.cdr.detectChanges();
      });
  }

  public onRestore(): void {
    if (this.usersService.isActiveDemoUser()) {
      this.subscriptionService.setLocalStatus(true);
      this.routerExtensions.navigate([this.redirectTo], { clearHistory: true });
      return;
    }

    if (this.isBusy) {
      return;
    }

    this.isBusy = true;
    this.cdr.detectChanges();

    this.restoreApplePurchases()
      .then((restoreData) => {
        this.subscriptionService.validateApplePurchase(restoreData).subscribe({
          next: (result) => {
            this.isBusy = false;
            if (result.isActive) {
              this.routerExtensions.navigate([this.redirectTo], { clearHistory: true });
              return;
            }
            this.showErrorAlert(result.message || 'No active subscription found for this account.');
            this.cdr.detectChanges();
          },
          error: () => {
            this.isBusy = false;
            this.showErrorAlert('Restore validation failed.');
            this.cdr.detectChanges();
          },
        });
      })
      .catch((error) => {
        this.isBusy = false;
        this.showErrorAlert(String(error || 'Restore failed. Please try again.'));
        this.cdr.detectChanges();
      });
  }

  public openPrivacyPolicy(): void {
    Utils.openUrl('https://cctec.aspiware.com/privacy/');
  }

  public openTermsOfService(): void {
    Utils.openUrl('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
  }

  public onChangeUser(): void {
    if (this.isBusy) {
      return;
    }

    this.configService.logout();
    this.routerExtensions.navigate(['/login'], { clearHistory: true });
  }

  private showErrorAlert(message: string): void {
    alert({
      title: 'Subscription',
      message,
      okButtonText: 'OK',
    });
  }

  private syncTheme(): void {
    const appAppearance = Application.systemAppearance();
    if (appAppearance === 'dark' || appAppearance === 'light') {
      this.isDarkTheme = appAppearance === 'dark';
      return;
    }

    const pageClassName = String(this.page.className || '');
    this.isDarkTheme = pageClassName.includes('ns-dark');
  }

  private ensureTransactionObserver(): void {
    if (!__IOS__ || this.iapObserver) {
      return;
    }

    const self = this;
    const ObserverClass = (NSObject as any).extend(
      {
        paymentQueueUpdatedTransactions(_queue: SKPaymentQueue, transactions: NSArray<SKPaymentTransaction>) {
          console.log(
            '[Subscription][StoreKit] updated transactions',
            JSON.stringify({ count: transactions?.count || 0 })
          );
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
    this.processCurrentTransactions();
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
          console.log(
            '[Subscription][StoreKit] add payment',
            JSON.stringify({
              productId: String(product.productIdentifier || productId),
              pendingPurchase: Boolean(this.pendingPurchase),
            })
          );
          const payment = SKPayment.paymentWithProduct(product);
          SKPaymentQueue.defaultQueue().addPayment(payment);
          setTimeout(() => this.processCurrentTransactions(), 1000);
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
    console.log(
      '[Subscription][StoreKit] transaction state',
      JSON.stringify({
        state: transaction?.transactionState,
        productId: transaction?.payment?.productIdentifier
          ? String(transaction.payment.productIdentifier)
          : undefined,
        transactionId: transaction?.transactionIdentifier
          ? String(transaction.transactionIdentifier)
          : undefined,
        hasPendingPurchase: Boolean(this.pendingPurchase),
        hasPendingRestore: Boolean(this.pendingRestore),
        error: transaction?.error?.localizedDescription || undefined,
      })
    );

    if (!this.pendingPurchase) {
      return;
    }

    switch (transaction.transactionState) {
      case SKPaymentTransactionState.Purchased:
      case SKPaymentTransactionState.Restored: {
        console.log(
          '[Subscription][StoreKit] handling completed transaction',
          JSON.stringify({
            state: transaction.transactionState,
            productId: transaction.payment?.productIdentifier
              ? String(transaction.payment.productIdentifier)
              : undefined,
          })
        );
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
          console.log('[Subscription][StoreKit] missing receipt data');
          pending.reject('Could not read App Store receipt.');
          return;
        }

        console.log('[Subscription][StoreKit] resolving purchase', JSON.stringify({ hasReceiptData: true }));
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

  private processCurrentTransactions(): void {
    if (!__IOS__) {
      return;
    }

    const transactions = SKPaymentQueue.defaultQueue().transactions;
    if (!transactions || !transactions.count) {
      return;
    }

    console.log(
      '[Subscription][StoreKit] process current transactions',
      JSON.stringify({ count: transactions.count })
    );

    for (let i = 0; i < transactions.count; i += 1) {
      const transaction = transactions.objectAtIndex(i);
      this.handleTransaction(transaction);
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
