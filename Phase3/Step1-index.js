export const handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    const id = event.id;
    const approval_required = event.approvalRequired;
    let status = event.status;

    if ('statusError' in event) {
      status = "error";
    } else if ("revoke" in event) {
      status = "ended";
    } else if ("grant" in event) {
      status = "in progress";