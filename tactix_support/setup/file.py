# Copyright (c) 2026, StakLogic and contributors
# For license information, please see license.txt

import frappe


def create_tactix_folder():
	f = frappe.new_doc("File")
	f.file_name = "Tactix"
	f.is_folder = 1
	f.folder = "Home"
	f.insert(ignore_if_duplicate=True)
