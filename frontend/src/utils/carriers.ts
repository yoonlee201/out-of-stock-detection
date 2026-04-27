// Values must match keys in the backend's CARRIER_GATEWAYS dict in
// backend/app/util/send.py — that dict is the source of truth for which
// carrier strings the email-to-SMS sender accepts.

export interface CarrierOption {
    value: string;
    label: string;
}

export const CARRIER_OPTIONS: readonly CarrierOption[] = [
    { value: "att",                label: "AT&T" },
    { value: "verizon",            label: "Verizon" },
    { value: "t-mobile",           label: "T-Mobile" },
    { value: "sprint",             label: "Sprint" },
    { value: "boost",              label: "Boost Mobile" },
    { value: "cricket",            label: "Cricket Wireless" },
    { value: "metro",              label: "Metro by T-Mobile" },
    { value: "uscellular",         label: "US Cellular" },
    { value: "virgin",             label: "Virgin Mobile" },
    { value: "xfinity",            label: "Xfinity Mobile" },
    { value: "visible",            label: "Visible" },
    { value: "google fi",          label: "Google Fi" },
    { value: "mint",               label: "Mint Mobile" },
    { value: "consumer cellular",  label: "Consumer Cellular" },
] as const;

export const CARRIER_VALUES: readonly string[] = CARRIER_OPTIONS.map((o) => o.value);
