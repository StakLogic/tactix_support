# Tactix Support

An integrated in-app support ticketing and diagnostics integration for Frappe and ERPNext sites, connecting your Frappe desk directly to the **Tactix Support Portal**.

---

## Features

- **In-Desk Support Ticket Dialog**: Raise tickets directly from any page or document in the Desk without context switching.
- **Smart System Diagnostics**: Automatically bundles route, active document/doctype, user information, screen resolution, and Frappe/ERPNext versions.
- **Console Error Capture**: Automatically listens for and captures recent browser JavaScript errors to attach with the ticket.
- **Pre-Built Templates**: Instant templates for *Bug / Error Reports*, *Feature Requests*, and *General Questions*.
- **Attachment Management**: Upload screenshots, error logs, and documents synced directly to the Tactix Support Portal.
- **Direct Portal Redirection**: One-click action to open the Tactix Support Portal or copy the generated Ticket ID.
- **Custom Key-Value Mapping**: Dynamic context mapping in **Tactix Settings** to send custom metadata alongside tickets.
- **User Impersonation**: Built-in temporary login link generator for System Managers to troubleshoot user issues quickly.

---

## Installation

Install the app using the Frappe bench CLI:

```bash
# Get the app repository
bench get-app https://github.com/StakLogic/tactix_support

# Install the app on your site
bench --site [site-name] install-app tactix_support

# Run migrations
bench --site [site-name] migrate

# Build frontend assets
bench build --app tactix_support
```

---

## Configuration & Settings

To configure the integration, navigate to **Tactix Settings** (search for `Tactix Settings` in the Awesome Bar):

### 1. General Settings
| Field | Type | Description |
| :--- | :--- | :--- |
| **Enable Ticket Raising** | Checkbox | Enables the ticket-raising dialog and backend integration site-wide. |
| **Enable User Impersonation** | Checkbox | Enables the *Impersonate* action under the **Password** button on the *User* form for System Managers. |

### 2. Support Portal Settings
| Field | Type | Description |
| :--- | :--- | :--- |
| **URL (`support_url`)** | Data | Base URL of your Tactix Support Portal (e.g., `https://support.example.com`). |
| **API Token (`support_api_token`)** | Password | API Key and Secret in the format `api_key:api_secret` generated from the Tactix Portal. |
| **HD Customer (`hd_customer`)** | Data | *(Optional)* The associated Customer name/ID in the support portal. |

### 3. Ticket Details (Custom Metadata Mapping)
You can configure custom key-value pairs that are passed along with every ticket creation request.

- **Key**: Parameter name expected by the portal.
- **Type**:
  - `String`: Static text.
  - `Integer`: Numeric value.
  - `Context`: Evaluated Python expression in a safe execution sandbox (e.g. `frappe.session.user`).
- **Cast To**: Optional casting (`Int`, `String`, `Float`).
- **Value**: The raw value or Python expression.

---

## JavaScript Actions for Navbar & Shortcuts

The app exposes global JavaScript methods under both `tactix` and `tactix_support` namespaces:

### 1. Raise Support Ticket Dialog
```javascript
new tactix.SupportTicket();
// or
new tactix_support.SupportTicket();
```

### 2. Open Support Portal in New Tab
```javascript
tactix.OpenPortal();
// or
tactix_support.OpenPortal();
```

---

## Configuring in Navbar Settings

You can add quick actions for users in the Frappe Desk top-right navigation bar (Help dropdown or Navbar items):

1. Search for **Navbar Settings** in the Awesome Bar.
2. Scroll to the **Help Dropdown** section (or **Standard Navbar Items**).
3. Click **Add Row** to add the actions:

### Example Configuration:

| Item Label | Action | Is Standard | Hidden |
| :--- | :--- | :---: | :---: |
| **Raise Support Ticket** | `new tactix.SupportTicket()` | 0 | 0 |
| **Open Support Portal** | `tactix.OpenPortal()` | 0 | 0 |

4. Click **Save**.
5. Hard reload your browser (`Ctrl + Shift + R` or `Cmd + Shift + R`) to see the updated menu items.

---

## How to Create a Ticket

1. Click **Raise Support Ticket** from the Navbar Help dropdown or trigger `new tactix.SupportTicket()`.
2. Fill in the ticket fields:
   - **Subject / Summary**: Brief summary of the problem or query.
   - **Ticket Type**: Select from *Bug / Issue*, *How-to / Guidance*, *Feature Request*, *System Slowdown / Performance*, or *Data / Account Inquiry*.
   - **Priority**: Select priority level (*Low*, *Medium*, *High*, *Urgent*).
   - **Insert Template**: Select a template to automatically populate structured prompts (*Bug / Error Report*, *Feature Request*, or *General Question*).
   - **Description**: Add rich-text details.
   - **File Attachments**: Attach relevant screenshots, documents, or log files.
   - **Environment & Diagnostics**: Keep checked to automatically attach current page route, active document, browser details, resolution, and captured JavaScript console errors.
3. Click **Submit Ticket**.
4. Upon successful submission, a confirmation modal appears displaying the **Ticket ID** with options to:
   - **Copy Ticket ID** to clipboard.
   - **Open Support Portal** directly to view the ticket status.

---

## User Impersonation

When **Enable User Impersonation** is checked in **Tactix Settings**:
1. A **System Manager** can navigate to any active **User** document (`Desk > Users > User`).
2. Click the **Password** dropdown in the top-right toolbar.
3. Click **Impersonate**.
4. A secure, single-use temporary login link is generated to open the user's session in an incognito window for debugging.

---

## License

MIT License. Copyright (c) 2026 StakLogic and Contributors.
