# Copyright (c) 2026, StakLogic and contributors
# For license information, please see license.txt

import frappe


def set_bootinfo(bootinfo):
	tactix_settings = frappe.get_cached_doc("Tactix Settings")
	bootinfo["tactix_support_enabled"] = tactix_settings.enable_ticket_raising
	bootinfo["tactix_max_file_size"] = tactix_settings.max_recording_size
	bootinfo["tactix_file_type"] = 1 if tactix_settings.save_recording == "Private" else 0
	# Set backward compatibility keys
	bootinfo["genie_support_enabled"] = tactix_settings.enable_ticket_raising
	bootinfo["genie_max_file_size"] = tactix_settings.max_recording_size
	bootinfo["genie_file_type"] = 1 if tactix_settings.save_recording == "Private" else 0
