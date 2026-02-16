import { Button, Property } from '@nativescript/core';

export type MenuEvent = { index: number };
export type MenuButtonAction = {
  name: string;
  icon?: string;
  disabled?: boolean;
  destructive?: boolean;
  confirm?: boolean | {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    presentation?: 'center' | 'anchor';
  };
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

export class MenuButtonBase extends Button {
  options: Array<MenuButtonAction>;
  useSFIcon: boolean;
  sfIconName: string;
  showSpinner: boolean;
  isRightSide: boolean;
}

optionsProperty.register(MenuButtonBase);
useSFIconProperty.register(MenuButtonBase);
sfIconNameProperty.register(MenuButtonBase);
showSpinnerProperty.register(MenuButtonBase);
isRightSideProperty.register(MenuButtonBase);
