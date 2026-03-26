import { Utils } from "@nativescript/core";
import { MenuButtonAction, MenuButtonBase } from "./common";

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
    const itemPathById: Record<number, number[]> = {};
    let nextItemId = 1;

    const addMenuOptions = (
      menu: android.view.Menu,
      options: MenuButtonAction[],
      parentPath: number[] = []
    ) => {
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const currentPath = [...parentPath, i];

        if (option.children?.length) {
          const subMenu = menu.addSubMenu(0, nextItemId++, android.view.Menu.NONE, option.name);
          const menuItem = subMenu.getItem();
          if (option.disabled) {
            menuItem.setEnabled(false);
          }
          addMenuOptions(subMenu, option.children, currentPath);
          continue;
        }

        const itemId = nextItemId++;
        const item = menu.add(0, itemId, android.view.Menu.NONE, option.name);
        itemPathById[itemId] = currentPath;
        if (option.disabled) {
          item.setEnabled(false);
        }
      }
    };

    if (this.options) {
      addMenuOptions(popupMenu.getMenu(), this.options);
      popupMenu.setOnMenuItemClickListener(
        new android.widget.PopupMenu.OnMenuItemClickListener({
          onMenuItemClick: (item): boolean => {
            const path = itemPathById[item.getItemId()];
            if (!path?.length) {
              return false;
            }

            let selected: MenuButtonAction | undefined;
            let currentOptions = this.options;
            for (const pathIndex of path) {
              selected = currentOptions?.[pathIndex];
              currentOptions = selected?.children || [];
            }

            if (selected?.disabled) {
              return false;
            }

            this.notify({
              eventName: "selected",
              object: this,
              index: path[0],
              path,
            });
            return true;
          },
        })
      );
    }

    popupMenu.show();
  }
}
