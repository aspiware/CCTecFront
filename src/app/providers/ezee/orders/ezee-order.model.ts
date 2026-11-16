export interface EzeeContactMethod {
  type: string;
  value: string;
  billing: boolean;
}

export interface EzeeCustomer {
  subscriberNumber: string;
  status: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phones: EzeeContactMethod[];
  emails: EzeeContactMethod[];
  contactMethods: EzeeContactMethod[];
}

export interface EzeeOrder {
  number: string;
  date: string;
  timeFrom: string | null;
  timeTo: string | null;
  workType: string;
  initialReason: string | null;
  workUnits: unknown;
  callFirst: unknown;
  address: string;
  detailPath: string;
  customer: EzeeCustomer;
}

export interface EzeeOrderGroup {
  count: number;
  orders: EzeeOrder[];
}

export interface EzeeOrdersDay {
  date: string;
  pending: EzeeOrderGroup;
  completed: EzeeOrderGroup;
}

export interface EzeeOrderListItem extends EzeeOrder {
  workflowStatus: 'Pending' | 'Completed';
}

export interface EzeeOrdersResponse {
  statusCode: number;
  message: string;
  error: boolean;
  data: EzeeOrdersDay;
}
