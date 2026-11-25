// Test data for the E2E suite. Every record the suite creates starts with E2E_PREFIX so it can be found
// (and, with the user's approval only, cleaned up). The suite itself never deletes data.
const E2E_PREFIX = "E2E-";

function uniqueName(tag) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${E2E_PREFIX}${tag}-${stamp}`;
}

// Account record types offered on "New Account" (KAN-2). Customer is inactive and must not be offered.
const COUNTRY_RECORD_TYPES = [
  "Australia",
  "New Zealand",
  "United States",
  "Canada"
];
const RETIRED_RECORD_TYPE = "Customer";

// Tasks generated from Onboarding_Task_Template__mdt for a country record type, in Order__c order:
// two templates for every record type + two country-specific ones (DeveloperName suffix = record type).
function countryTasks(recordTypeDeveloperName) {
  return [
    { name: "KYC Verification", key: "KYC_Verification" },
    { name: "Contract Signature", key: "Contract_Signature" },
    {
      name: "Billing Account Setup",
      key: `Billing_Account_Setup_${recordTypeDeveloperName}`
    },
    {
      name: "Customer Welcome Call",
      key: `Customer_Welcome_Call_${recordTypeDeveloperName}`
    }
  ];
}

module.exports = {
  E2E_PREFIX,
  uniqueName,
  COUNTRY_RECORD_TYPES,
  RETIRED_RECORD_TYPE,
  countryTasks
};
