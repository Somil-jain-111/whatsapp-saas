export enum BeneficiaryStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  FAILED = "FAILED",
}

export enum BeneficiaryType {
  BANK = "BANK",
  UPI = "UPI",
}

export enum BeneficiaryRelationshipType {
  SELF = "SELF",
  SPOUSE = "SPOUSE",
  FATHER_OR_MOTHER = "FATHER_OR_MOTHER",
  SON_OR_DAUGHTER = "SON_OR_DAUGHTER",
  BROTHER_OR_SISTER = "BROTHER_OR_SISTER",
  BUSINESS_PARTNER = "BUSINESS_PARTNER",
  SHOP_STAFF_OR_EMPLOYEE = "SHOP_STAFF_OR_EMPLOYEE",
  OTHER = "OTHER",
}

export const BeneficiaryRelationshipTypeLabels = {
  [BeneficiaryRelationshipType.SELF]: "Self",
  [BeneficiaryRelationshipType.SPOUSE]: "Spouse",
  [BeneficiaryRelationshipType.FATHER_OR_MOTHER]: "Father Or Mother",
  [BeneficiaryRelationshipType.SON_OR_DAUGHTER]: "Son Or Daughter",
  [BeneficiaryRelationshipType.BROTHER_OR_SISTER]: "Brother Or Sister",
  [BeneficiaryRelationshipType.BUSINESS_PARTNER]: "Business Partner",
  [BeneficiaryRelationshipType.SHOP_STAFF_OR_EMPLOYEE]:
    "Shop Staff or Employee",
  [BeneficiaryRelationshipType.OTHER]: "Other",
};
