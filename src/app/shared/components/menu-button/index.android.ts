import { Utils } from "@nativescript/core";
import { MenuButtonBase } from "./common";

export class MenuButton extends MenuButtonBase {
  initNativeView(): void {
    super.initNativeView();
    this.on("tap", () => {
      this.showPopup();
    });
  }
  showPopup() {
    const popupMenu = new android.widget.PopupMenu(
      Utils.android.getCurrentActivity(),
      this.android
    );

    if (this.options) {
      for (let i = 0; i < this.options.length; i++) {
        const option = this.options[i];
        const item = popupMenu.getMenu().add(option.name);
        if (option.disabled) {
          item.setEnabled(false);
        }
      }
      popupMenu.setOnMenuItemClickListener(
        new android.widget.PopupMenu.OnMenuItemClickListener({
          onMenuItemClick: (item): boolean => {
            const selected = this.options.find((o) => o.name === item.getTitle());
            if (selected?.disabled) {
              return false;
            }
            this.notify({
              eventName: "selected",
              object: this,
              index: this.options.findIndex((o) => o.name === item.getTitle()),
            });
            return true;
          },
        })
      );
    }

    popupMenu.show();
  }
}
