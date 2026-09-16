# Copyright (c) 2026, StakLogic and contributors
# For license information, please see license.txt

import json
import frappe
from frappe.utils import cint, flt, get_url, now
from frappe.utils.safe_exec import get_safe_globals, safe_eval

from tactix_support.utils.requests import make_request


@frappe.whitelist()
def create_ticket(
	title,
	description,
	screen_recording=None,
	user=None,
	user_fullname=None,
	priority="Low",
	ticket_type="Bug / Issue",
	file_attachment=None,
	attachments=None,
	system_info=None,
	console_logs=None,
	department=None,
):
	"""Create ticket in Tactix Support Portal with rich diagnostics and media attachments"""
	settings = frappe.get_cached_doc("Tactix Settings")
	if not settings.enable_ticket_raising:
		frappe.throw("Ticket raising is not enabled in Tactix Settings.")

	if not settings.support_url or not settings.get_password("support_api_token"):
		frappe.throw("Tactix Support URL or API token is missing in Tactix Settings.")

	user = user or frappe.session.user
	user_fullname = user_fullname or frappe.utils.get_fullname(user)

	headers = {
		"Authorization": f"token {settings.get_password('support_api_token')}",
	}

	ensure_portal_user(settings, headers, user, user_fullname)

	# Aggregate attachments
	all_file_urls = []
	if screen_recording:
		all_file_urls.append(screen_recording)
	if file_attachment:
		all_file_urls.append(file_attachment)

	if attachments:
		if isinstance(attachments, str):
			try:
				attachments = json.loads(attachments)
			except Exception:
				attachments = [attachments]
		if isinstance(attachments, list):
			for item in attachments:
				if isinstance(item, dict):
					url = item.get("file_url") or item.get("file")
				else:
					url = str(item)
				if url and url not in all_file_urls:
					all_file_urls.append(url)

	remote_attachments = []
	for file_url in all_file_urls:
		if not file_url:
			continue
		full_file_url = file_url if file_url.startswith("http") else f"{get_url()}{file_url}"
		try:
			file_data = make_request(
				url=f"{settings.support_url.rstrip('/')}/api/method/upload_file",
				headers=headers,
				payload={"file_url": full_file_url},
			).get("message")
			if file_data:
				remote_attachments.append(file_data)
		except Exception as e:
			frappe.log_error(title="Attachment Upload Error to Tactix Portal", message=str(e))

	# Format rich diagnostics section
	enriched_description = format_ticket_description(
		description=description,
		system_info=system_info,
		console_logs=console_logs,
		user=user,
		user_fullname=user_fullname,
	)

	response = make_request(
		url=f"{settings.support_url.rstrip('/')}/api/method/tactix.api.ticket.create_tactix_ticket",
		headers=headers,
		payload={
			"doc": {
				"subject": title,
				"description": enriched_description,
				"priority": priority,
				"ticket_type": ticket_type or "Support",
				"raised_by": user,
				"raised_by_user": user,
				"user_fullname": user_fullname,
				"customer": settings.hd_customer,
				"via_customer_portal": 1,
				**generate_ticket_details(settings),
			},
			"attachments": remote_attachments,
		},
	)

	ticket_id = response.get("message") if isinstance(response, dict) else response
	if isinstance(ticket_id, dict) and ticket_id.get("error"):
		frappe.throw(str(ticket_id.get("error")))

	return {
		"ticket_id": ticket_id,
		"portal_url": settings.support_url.rstrip("/"),
	}


def format_ticket_description(description, system_info, console_logs, user, user_fullname):
	"""Append rich environment diagnostics and error logs to ticket description"""
	content = [description or ""]

	if system_info:
		if isinstance(system_info, str):
			try:
				system_info = json.loads(system_info)
			except Exception:
				system_info = {}

		if isinstance(system_info, dict) and system_info:
			rows_html = []
			for k, v in system_info.items():
				label = k.replace("_", " ").title()
				rows_html.append(f"""
					<tr>
						<td style="padding: 6px 12px; border: 1px solid #e2e8f0; font-weight: 600; background: #f8fafc; width: 35%;">{label}</td>
						<td style="padding: 6px 12px; border: 1px solid #e2e8f0; word-break: break-all;">{frappe.utils.escape_html(str(v))}</td>
					</tr>
				""")

			content.append(f"""
				<br><br>
				<div style="margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
					<div style="background: #f1f5f9; padding: 10px 16px; font-weight: 600; font-size: 13px; color: #334155; border-bottom: 1px solid #e2e8f0;">
						System & Environment Diagnostics
					</div>
					<table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #475569;">
						{''.join(rows_html)}
					</table>
				</div>
			""")

	if console_logs:
		escaped_logs = frappe.utils.escape_html(str(console_logs))
		content.append(f"""
			<br>
			<div style="margin-top: 16px; border: 1px solid #fecaca; border-radius: 8px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
				<div style="background: #fef2f2; padding: 10px 16px; font-weight: 600; font-size: 13px; color: #991b1b; border-bottom: 1px solid #fecaca;">
					Client Error / Console Log Capture
				</div>
				<pre style="margin: 0; padding: 12px; background: #fff5f5; color: #b91c1c; font-size: 11px; font-family: monospace; white-space: pre-wrap; word-break: break-all;">{escaped_logs}</pre>
			</div>
		""")

	return "".join(content)


def ensure_portal_user(settings, headers, user, user_fullname):
	"""Ensure portal user exists in Tactix"""
	if not user:
		return

	try:
		user_data = make_request(
			url=f"{settings.support_url.rstrip('/')}/api/method/tactix.api.ticket.check_portal_user",
			headers=headers,
			payload={
				"email": user
			},
			req_type="GET",
		)

		if user_data.get("message"):
			return

	except Exception:
		pass

	try:
		make_request(
			url=f"{settings.support_url.rstrip('/')}/api/method/tactix.api.ticket.create_portal_user",
			headers=headers,
			payload={
				"email": user,
				"first_name": user_fullname or user.split("@")[0],
				"enabled": 1,
				"customer": settings.hd_customer,
				"roles": [
					{"role": "Tactix Ticket Raiser"}
				],
			},
			req_type="POST",
		)
	except Exception as e:
		frappe.log_error(title="Failed creating portal user in Tactix", message=str(e))


def generate_ticket_details(settings):
	req_params = {}
	for row in settings.ticket_details:
		if row.type == "String":
			req_params[row.key] = row.value
		elif row.type == "Integer":
			req_params[row.key] = cint(row.value)
		elif row.type == "Context":
			req_params[row.key] = safe_eval(row.value, get_safe_globals(), {})
		else:
			req_params[row.key] = row.value

		if row.cast_to:
			if row.cast_to == "Int":
				req_params[row.key] = cint(req_params[row.key])
			elif row.cast_to == "String":
				req_params[row.key] = str(req_params[row.key])
			elif row.cast_to == "Float":
				req_params[row.key] = flt(req_params[row.key])

	return req_params


def upload_file(content):
	file_url = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": frappe.scrub(f"ST_{frappe.session.user}_{now()}.mp4"),
			"is_private": False,
			"content": content,
			"decode": True,
		}
	).save(ignore_permissions=True).file_url

	return f"{get_url()}{file_url}"


@frappe.whitelist()
def get_portal_url(user=frappe.session.user):
	support_url = frappe.db.get_single_value("Tactix Settings", "support_url")

	try:
		return {
			"url": f"{support_url}/tactix/tactix/account/login"
		}

	except Exception:
		frappe.log_error(
			title="Support Portal Login Error",
			message=frappe.get_traceback(),
		)

		frappe.throw(
			"Unable to log in to the support portal. Please try again later."
		)
