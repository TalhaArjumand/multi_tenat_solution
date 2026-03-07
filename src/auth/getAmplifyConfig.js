import workforceConfig from "../aws-exports.workforce";
import customerConfig from "../aws-exports.customer";

export function isCustomerRoute(pathname) {
  return pathname === "/customer" || pathname === "/customer-setup" || pathname.startsWith("/customer/");
}

export default function getAmplifyConfig(pathname = window.location.pathname) {
  return isCustomerRoute(pathname) ? customerConfig : workforceConfig;
}
