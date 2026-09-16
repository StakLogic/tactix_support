// Copyright (c) 2026, StakLogic and Contributors
// MIT License. See license.txt

frappe.provide("tactix");
frappe.provide("tactix_support");

tactix.OpenPortal = function () {
    frappe.call({
        method: "tactix_support.utils.support.get_portal_url",
        callback: function (r) {
            if (r.message && r.message.url) {
                window.open(r.message.url, "_blank");
            }
        }
    });
};

tactix_support.OpenPortal = tactix.OpenPortal;
