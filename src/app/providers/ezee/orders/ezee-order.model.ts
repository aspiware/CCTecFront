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

export interface EzeePricingItem {
  code: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
  source: string;
}

export interface EzeeOrderPricing {
  base: EzeePricingItem | null;
  extras: EzeePricingItem[];
  total: number;
  estimated: boolean;
  priceConfigured: boolean;
}

export interface EzeeOrderNoteAuthor {
  name: string;
  techCode: string;
}

export interface EzeeOrderNote {
  text: string;
  author: EzeeOrderNoteAuthor | null;
  createdAt: string;
  editedBy: EzeeOrderNoteAuthor | null;
  editedAt: string | null;
}

export interface EzeeOrderChargeUpdate {
  code: string;
  quantity: number;
}

export interface EzeeChargeOption {
  code: string;
  description: string;
  category: string;
  unitType: string;
  unitPrice: number;
}

export interface EzeeChargeOptionsResponse {
  statusCode: number;
  data: {
    number: string;
    date: string;
    options: EzeeChargeOption[];
  };
}

export interface EzeeAddOrderNoteResponse {
  statusCode: number;
  message: string;
  error: boolean;
  data: {
    number: string;
  };
}

export interface EzeeFinalizeReason {
  reason: string;
  reasonId: number;
  description: string;
}

export interface EzeeFinalizeOptions {
  reasons: EzeeFinalizeReason[];
  finalSecondaryReasonsRequired: boolean;
  secondaryReasonsRequired: boolean;
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
  notes?: EzeeOrderNote[];
  finalizeOptions?: EzeeFinalizeOptions | null;
  pricing?: EzeeOrderPricing | null;
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
