// Central company identity — used on printed documents (GRN note, etc.) so the
// output matches the look of the Odoo Purchase Order.
export const COMPANY = {
  name: "ENCAPSCIFI LIFESCIENCES PRIVATE LIMITED",
  addressLines: [
    "Q2, 2nd Cross Road, Jigini 1st Stage,",
    "Anekal Taluk",
    "Bengaluru 560105",
    "Karnataka KA",
    "India",
  ],
  phone: "+918075673248",
  email: "admin@encapscifi.com",
  website: "https://www.encapscifi.com",
  gstin: "29AAHCE9361Q1ZO",
} as const;

export const WAREHOUSES: Record<string, string> = {
  WH1: "Warehouse 1 (WH1)",
  WH2: "Warehouse 2 (WH2)",
};
