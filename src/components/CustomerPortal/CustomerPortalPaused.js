import React from "react";

function CustomerPortalPaused() {
  return (
    <div style={{ maxWidth: 720, margin: "64px auto", padding: "0 24px" }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #d9d9d9",
          borderRadius: 8,
          padding: 32,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
        }}
      >
        <h1 style={{ marginTop: 0 }}>CloudiQS customer portal is not available in this phase</h1>
        <p style={{ marginBottom: 12 }}>
          Phase 1 is focused on customer notifications and audit visibility. Customer portal setup and
          customer dashboard access are paused for now.
        </p>
        <p style={{ marginBottom: 0 }}>
          If you were expecting customer access, contact support at <strong>info@sfproject.com.pk</strong>.
        </p>
      </div>
    </div>
  );
}

export default CustomerPortalPaused;
