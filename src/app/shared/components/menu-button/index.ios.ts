import { Application } from '@nativescript/core';
import { MenuButtonBase, MenuButtonAction, optionsProperty, useSFIconProperty, sfIconNameProperty, showSpinnerProperty, isRightSideProperty } from './common';

export class MenuButton extends MenuButtonBase {
  [optionsProperty.setNative](value: Array<MenuButtonAction>) {
    this.resetMenu();
  }

  [useSFIconProperty.setNative](value: boolean) {
    this.useSFIcon = value;
    this.resetMenu();
  }

  [sfIconNameProperty.setNative](value: string) {
    this.sfIconName = value;
    this.resetMenu();
  }

  [showSpinnerProperty.setNative](value: boolean) {
    this.showSpinner = value;
    this.resetMenu();
  }

  [isRightSideProperty.setNative](value: boolean) {
    this.isRightSide = value;
    this.resetMenu();
  }

  resetMenu() {
    if (!this.options) {
      return;
    }
    const iosButton = this.ios as UIButton;
    const tintColor = this.getAdaptiveTintColor();
    const regularActions: UIMenuElement[] = [];
    const destructiveActions: UIMenuElement[] = [];

    if (this.showSpinner) {
      iosButton.setImageForState(null, UIControlState.Normal);
      iosButton.tintColor = tintColor;
      let spinner = iosButton.viewWithTag(9999) as UIActivityIndicatorView;
      if (!spinner) {
        spinner = UIActivityIndicatorView.alloc().initWithActivityIndicatorStyle(UIActivityIndicatorViewStyle.Medium);
        spinner.tag = 9999;
        spinner.color = tintColor;
        spinner.translatesAutoresizingMaskIntoConstraints = false;
        iosButton.addSubview(spinner);
        spinner.centerXAnchor.constraintEqualToAnchorConstant(iosButton.centerXAnchor, -10).active = true;
        spinner.centerYAnchor.constraintEqualToAnchorConstant(iosButton.centerYAnchor, -6).active = true;
      }
      spinner.color = tintColor;
      iosButton.setNeedsLayout();
      iosButton.layoutIfNeeded();
      spinner.startAnimating();
    } else {
      const existingSpinner = iosButton.viewWithTag(9999) as UIActivityIndicatorView;
      if (existingSpinner) {
        existingSpinner.stopAnimating();
        existingSpinner.removeFromSuperview();
      }
    }

    if (this.useSFIcon && !this.showSpinner && !this.isRightSide) {
      const config = UIImageSymbolConfiguration.configurationWithPointSizeWeightScale(
        18,
        UIImageSymbolWeight.Regular,
        UIImageSymbolScale.Medium
      );
      const sfName = this.sfIconName || "ellipsis.circle";
      const image = UIImage.systemImageNamedWithConfiguration(sfName, config);
      iosButton.setImageForState(image, UIControlState.Normal);
      iosButton.tintColor = tintColor;
      iosButton.translatesAutoresizingMaskIntoConstraints = false;
      iosButton.widthAnchor.constraintEqualToConstant(56).active = true;
      iosButton.heightAnchor.constraintEqualToConstant(48).active = true;
      iosButton.contentEdgeInsets = { top: 0, left: 0, bottom: 0, right: 0 };
      iosButton.imageEdgeInsets = { top: -6, left: -10, bottom: 6, right: 9 };
      iosButton.contentVerticalAlignment = UIControlContentVerticalAlignment.Center;
      iosButton.contentHorizontalAlignment = UIControlContentHorizontalAlignment.Center;
      iosButton.imageView.contentMode = UIViewContentMode.ScaleAspectFit;
    } else if (this.useSFIcon && !this.showSpinner && this.isRightSide) {
      const config = UIImageSymbolConfiguration.configurationWithPointSizeWeightScale(
        18,
        UIImageSymbolWeight.Regular,
        UIImageSymbolScale.Medium
      );
      const sfName = this.sfIconName || "ellipsis.circle";
      const image = UIImage.systemImageNamedWithConfiguration(sfName, config);
      iosButton.setImageForState(image, UIControlState.Normal);
      iosButton.tintColor = tintColor;
      // iosButton.translatesAutoresizingMaskIntoConstraints = false;

      iosButton.contentEdgeInsets = { top: 0, left: 0, bottom: 0, right: 0 };
      iosButton.imageEdgeInsets = { top: -6, left: 0, bottom: 6, right: 0 };
      iosButton.contentVerticalAlignment = UIControlContentVerticalAlignment.Center;
      iosButton.contentHorizontalAlignment = UIControlContentHorizontalAlignment.Center;
      iosButton.imageView.contentMode = UIViewContentMode.ScaleAspectFit;
    } else {
      iosButton.setImageForState(null, UIControlState.Normal);
    }



    for (let i = 0; i < this.options.length; i++) {
      const option = this.options[i];

      const iconImage = option.icon ? UIImage.systemImageNamed(option.icon) : null;

      const action = UIAction.actionWithTitleImageIdentifierHandler(
        option.name,
        iconImage,
        null,
        () => {
          if (option.confirm) {
            this.showConfirmSheet(iosButton, option, i);
          } else {
            this.notify({
              eventName: 'selected',
              object: this,
              index: i,
            });
          }
        }
      );

      // Verificar si la propiedad 'disabled' existe y es verdadera
      if (option.disabled) {
        action.attributes = UIMenuElementAttributes.Disabled;
      }

      if (option.destructive) {
        action.attributes = UIMenuElementAttributes.Destructive;
        destructiveActions.push(action);
      } else {
        regularActions.push(action);
      }
    }

    const rootChildren: UIMenuElement[] = [];

    if (regularActions.length > 0) {
      const regularMenu = UIMenu.menuWithTitleImageIdentifierOptionsChildren(
        '',
        null,
        null,
        UIMenuOptions.DisplayInline,
        regularActions
      );
      rootChildren.push(regularMenu);
    }

    if (destructiveActions.length > 0) {
      const destructiveMenu = UIMenu.menuWithTitleImageIdentifierOptionsChildren(
        '',
        null,
        null,
        UIMenuOptions.DisplayInline,
        destructiveActions
      );
      rootChildren.push(destructiveMenu);
    }

    if (rootChildren.length === 1 && regularActions.length > 0 && destructiveActions.length === 0) {
      iosButton.menu = rootChildren[0] as UIMenu;
    } else {
      iosButton.menu = UIMenu.menuWithTitleImageIdentifierOptionsChildren(
        '',
        null,
        null,
        0 as UIMenuOptions,
        rootChildren
      );
    }
    iosButton.showsMenuAsPrimaryAction = true;
  }

  private getAdaptiveTintColor(): UIColor {
    if (UIColor.labelColor) {
      return UIColor.labelColor;
    }
    return UIColor.blackColor;
  }

  private showConfirmSheet(iosButton: UIButton, option: MenuButtonAction, index: number) {
    const confirmConfig =
      typeof option.confirm === 'object' ? option.confirm : {};
    const confirmText = confirmConfig.confirmText || option.name;
    const cancelText = confirmConfig.cancelText || 'Cancel';
    const confirmTitle = confirmConfig.title || option.name;
    const presentation = confirmConfig.presentation || 'anchor';

    const alertStyle =
      presentation === 'center'
        ? UIAlertControllerStyle.Alert
        : UIAlertControllerStyle.ActionSheet;
    const alert = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
      confirmTitle,
      null,
      alertStyle
    );

    const confirmStyle = option.destructive
      ? UIAlertActionStyle.Destructive
      : UIAlertActionStyle.Default;

    alert.addAction(
      UIAlertAction.actionWithTitleStyleHandler(confirmText, confirmStyle, () => {
        this.notify({
          eventName: 'selected',
          object: this,
          index,
        });
      })
    );

    alert.addAction(
      UIAlertAction.actionWithTitleStyleHandler(cancelText, UIAlertActionStyle.Cancel, null)
    );

    let viewController = Application.ios?.rootController;
    while (
      viewController &&
      viewController.presentedViewController &&
      !viewController.presentedViewController.beingDismissed
    ) {
      viewController = viewController.presentedViewController;
    }

    if (!viewController) {
      return;
    }

    const isPad =
      UIDevice.currentDevice.userInterfaceIdiom === UIUserInterfaceIdiom.Pad;
    const popover = alert.popoverPresentationController;
    // Only configure popover for ActionSheet on iPad.
    if (alertStyle === UIAlertControllerStyle.ActionSheet && popover) {
      // If presentation is anchor, always anchor to the button (even on iPhone)
      // Otherwise, only configure popover on iPad.
      if (presentation === 'anchor' || isPad) {
        if (presentation === 'center' || !iosButton) {
          popover.sourceView = viewController.view;
          popover.sourceRect = CGRectMake(
            viewController.view.bounds.size.width / 2.0,
            viewController.view.bounds.size.height / 2.0,
            1.0,
            1.0
          );
        } else {
          popover.sourceView = iosButton;
          popover.sourceRect = iosButton.bounds;
        }
        popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
      }
    }

    viewController.presentViewControllerAnimatedCompletion(alert, true, null);
  }
}
