import { MenuButtonAction } from "./common"

export interface Item {
  name: string
  options: Array<MenuButtonAction>
}
