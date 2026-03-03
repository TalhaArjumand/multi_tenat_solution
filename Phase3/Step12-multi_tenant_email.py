def build_customer_approval_email(event):
    """
    Build a rich email to send to the customer admin when 
    a DevOps engineer requests access to their account.
    """
    requester = event.get('email', 'Unknown')
    account_id = event['accountId']
    account_name = event['accountName']
    role = event['role']
    duration = event.get('time', '1')
    justification = event.get('justification', 'No justification provided')
    ticket_no = event.get('ticketNo', 'No ticket')
    customer_name = event.get('customerName', 'Customer')
    start_time = event.get('startTime', '')
    
    subject = f"[CloudIQS MSP] Access Request to {account_name} ({account_id})"
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #232f3e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🔐 Elevated Access Request</h2>
          <p style="margin: 5px 0 0;">CloudIQS MSP Management System</p>
        </div>
        
        <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p>Dear <strong>{customer_name}</strong> Admin,</p>
          
          <p>A CloudIQS MSP engineer has requested temporary elevated access to your AWS environment. 
          Please review the details below:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Requester</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">{requester}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>AWS Account</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">{account_name} ({account_id})</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Role Requested</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">{role}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Duration</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">{duration} hour(s)</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Start Time</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">{start_time}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Ticket #</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">{ticket_no}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Justification</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">{justification}</td>
            </tr>
          </table>
          
          <p style="color: #666; font-size: 12px;">
            This access will be automatically revoked after the specified duration.
            All actions performed during the session are logged and auditable.
          </p>
          
          <p>If you have questions, contact your CloudIQS MSP account manager.</p>
        </div>
      </div>
    </body>
    </html>
    """
    
    return subject, html_body