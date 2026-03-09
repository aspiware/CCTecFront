import { Button, Property } from '@nativescript/core';

export type MenuEvent = { index: number };
export type MenuButtonAction = {
  name: string;
  icon?: string;
  disabled?: boolean;
  destructive?: boolean;
  toggle?: boolean;
  checked?: boolean;
  confirm?: boolean | {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    presentation?: 'center' | 'anchor';
  };
};

export type MenuButtonInsets = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

export const optionsProperty = new Property<
  MenuButtonBase,
  Array<MenuButtonAction>
>({
  name: 'options',
});
export const useSFIconProperty = new Property<
  MenuButtonBase,
  boolean
>({
  name: 'useSFIcon',
  defaultValue: false,
});
export const sfIconNameProperty = new Property<
  MenuButtonBase,
  string
>({
  name: 'sfIconName',
  defaultValue: '',
});
export const showSpinnerProperty = new Property<
  MenuButtonBase,
  boolean
>({
  name: 'showSpinner',
  defaultValue: false,
});
export const isRightSideProperty = new Property<
  MenuButtonBase,
  boolean
>({
  name: 'isRightSide',
  defaultValue: false,
});
export const contentInsetsProperty = new Property<
  MenuButtonBase,
  MenuButtonInsets | string
>({
  name: 'contentInsets',
});
export const imageInsetsProperty = new Property<
  MenuButtonBase,
  MenuButtonInsets | string
>({
  name: 'imageInsets',
});
export const spinnerOffsetXProperty = new Property<
  MenuButtonBase,
  number | string
>({
  name: 'spinnerOffsetX',
  defaultValue: -10,
});
export const spinnerOffsetYProperty = new Property<
  MenuButtonBase,
  number | string
>({
  name: 'spinnerOffsetY',
  defaultValue: -6,
});

export class MenuButtonBase extends Button {
  options: Array<MenuButtonAction>;
  useSFIcon: boolean;
  sfIconName: string;
  showSpinner: boolean;
  isRightSide: boolean;
  contentInsets: MenuButtonInsets | string;
  imageInsets: MenuButtonInsets | string;
  spinnerOffsetX: number | string;
  spinnerOffsetY: number | string;
}

optionsProperty.register(MenuButtonBase);
useSFIconProperty.register(MenuButtonBase);
sfIconNameProperty.register(MenuButtonBase);
showSpinnerProperty.register(MenuButtonBase);
isRightSideProperty.register(MenuButtonBase);
contentInsetsProperty.register(MenuButtonBase);
imageInsetsProperty.register(MenuButtonBase);
spinnerOffsetXProperty.register(MenuButtonBase);
spinnerOffsetYProperty.register(MenuButtonBase);
