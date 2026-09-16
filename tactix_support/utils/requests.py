# Copyright (c) 2026, StakLogic and contributors
# For license information, please see license.txt

from urllib.parse import urlparse, urlunparse

import requests
import frappe
from frappe.integrations.utils import create_request_log


def make_request(
	url,
	headers,
	payload,
	req_type="POST",
	return_response=False
):
	req_headers = dict(headers) if headers else {}
	try:
		response = requests.request(
			req_type, url, json=payload, headers=req_headers
		)
	except requests.exceptions.ConnectionError as e:
		parsed = urlparse(url)
		if parsed.hostname and (parsed.hostname == "localhost" or parsed.hostname.endswith(".localhost")):
			port_str = f":{parsed.port}" if parsed.port else ""
			req_headers.setdefault("Host", f"{parsed.hostname}{port_str}")
			fallback_netloc = f"127.0.0.1{port_str}"
			fallback_url = urlunparse(parsed._replace(netloc=fallback_netloc))
			response = requests.request(
				req_type, fallback_url, json=payload, headers=req_headers
			)
		else:
			raise e

	log_request(url, payload, response.json() if response.status_code == 200 else response.text)
	response.raise_for_status()
	if return_response:
		return response
	return response.json()


def log_request(endpoint, payload, output):
	create_request_log(
		payload,
		request_description=endpoint,
		service_name="Tactix Support",
		output=pretty_json(output),
		status="Completed"
	)
	frappe.db.commit()


def pretty_json(obj):
	if not obj:
		return ""

	if isinstance(obj, str):
		return obj

	return frappe.as_json(obj, indent=4)
