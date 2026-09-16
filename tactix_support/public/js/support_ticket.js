// Copyright (c) 2026, StakLogic and Contributors
// MIT License. See license.txt
// Professional Support Ticket Dialog with rich diagnostics and attachment management

frappe.provide("tactix");
frappe.provide("tactix_support");

// Global diagnostic capture for runtime errors
tactix._recent_errors = tactix._recent_errors || [];
if (typeof window !== "undefined" && !window._tactix_error_listener_attached) {
	window._tactix_error_listener_attached = true;
	window.addEventListener("error", function (event) {
		try {
			tactix._recent_errors.push({
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				time: new Date().toISOString(),
				stack: event.error ? event.error.stack : ""
			});
			if (tactix._recent_errors.length > 5) {
				tactix._recent_errors.shift();
			}
		} catch (e) {
			// ignore
		}
	});
}

tactix.SupportTicket = class SupportTicket {
	constructor() {
		if (!frappe.boot.tactix_support_enabled) {
			frappe.msgprint(__("Ticket raising is not enabled for this site."));
			return;
		}
		this.init_config();
		this.setup_dialog();
		this.dialog.show();
	}

	init_config() {
		this.inUpload = false;
		this.attachments = [];
	}

	get_environment_info() {
		const route = frappe.get_route ? frappe.get_route_str() : window.location.pathname;
		const curForm = window.cur_frm;
		return {
			page_url: window.location.href,
			route: route || "Desk",
			doctype: curForm ? curForm.doctype : "None",
			docname: curForm ? curForm.docname : "None",
			browser: navigator.userAgent,
			screen_resolution: `${window.innerWidth}x${window.innerHeight}`,
			user_email: frappe.session.user_email || frappe.session.user,
			user_fullname: frappe.session.user_fullname || frappe.session.user,
			frappe_version: (frappe.boot.versions && frappe.boot.versions.frappe) || "v15",
			erpnext_version: (frappe.boot.versions && frappe.boot.versions.erpnext) || ""
		};
	}

	setup_dialog() {
		const env = this.get_environment_info();

		this.dialog = new frappe.ui.Dialog({
			title: __("Raise Support Ticket"),
			size: "large",
			minimizable: true,
			static: true,
			fields: [
				{
					fieldtype: "Section Break",
					label: __("Ticket Overview")
				},
				{
					fieldname: "ticket_title",
					label: __("Subject / Summary"),
					fieldtype: "Data",
					placeholder: __("e.g. Unable to submit Sales Invoice due to validation error"),
					reqd: 1
				},
				{
					fieldname: "ticket_type",
					label: __("Ticket Type"),
					fieldtype: "Select",
					options: [
						"Bug / Issue",
						"How-to / Guidance",
						"Feature Request",
						"System Slowdown / Performance",
						"Data / Account Inquiry"
					],
					default: "Bug / Issue",
					reqd: 1
				},
				{
					fieldtype: "Column Break"
				},
				{
					fieldname: "priority",
					label: __("Priority"),
					fieldtype: "Select",
					reqd: 1,
					options: [
						{ label: __("Low - General queries"), value: "Low" },
						{ label: __("Medium - Standard issues"), value: "Medium" },
						{ label: __("High - Impaired workflow"), value: "High" },
						{ label: __("Urgent - Critical system blocker"), value: "Urgent" }
					],
					default: "Medium"
				},
				{
					fieldname: "template_selector",
					label: __("Insert Template"),
					fieldtype: "Select",
					options: [
						"",
						"Bug / Error Report",
						"Feature Request",
						"General Question"
					],
					change: () => {
						const selected = this.dialog.get_value("template_selector");
						this.apply_template(selected);
					}
				},
				{
					fieldtype: "Section Break",
					label: __("Detailed Description")
				},
				{
					fieldname: "ticket_description",
					label: __("Description"),
					fieldtype: "Text Editor",
					reqd: 1
				},
				{
					fieldtype: "Section Break",
					label: __("File Attachments")
				},
				{
					fieldname: "attachments_html",
					fieldtype: "HTML"
				},
				{
					fieldname: "add_attachment_btn",
					label: __("+ Add File Attachment"),
					fieldtype: "Button",
					click: () => {
						this.prompt_file_upload();
					}
				},
				{
					fieldtype: "Section Break",
					label: __("Environment & Diagnostics"),
					collapsible: 1
				},
				{
					fieldname: "include_diagnostics",
					label: __("Include system diagnostics (Route, browser, versions)"),
					fieldtype: "Check",
					default: 1
				},
				{
					fieldname: "include_console_errors",
					label: __("Include captured browser console errors"),
					fieldtype: "Check",
					default: tactix._recent_errors.length > 0 ? 1 : 0
				},
				{
					fieldname: "diagnostics_preview_html",
					fieldtype: "HTML"
				}
			],
			primary_action_label: __("Submit Ticket"),
			primary_action: (values) => {
				this.submit_ticket(values);
			},
			secondary_action_label: __("Cancel"),
			secondary_action: () => {
				this.dialog.hide();
			}
		});

		this.dialog.$wrapper.find(".modal-dialog").css("z-index", 1);
		this.dialog.get_minimize_btn().addClass("pr-3");

		this.render_attachments_list();
		this.render_diagnostics_preview(env);

		// Set default bug template
		this.apply_template("Bug / Error Report");
	}

	apply_template(templateName) {
		let content = "";
		if (templateName.includes("Bug")) {
			content = `
				<p><b>What happened:</b></p>
				<p>[Describe the unexpected behavior or error]</p>
				<p><b>Steps to Reproduce:</b></p>
				<ol>
					<li>Go to '...'</li>
					<li>Click on '...'</li>
					<li>See error</li>
				</ol>
				<p><b>Expected Behavior:</b></p>
				<p>[What you expected to happen]</p>
			`;
		} else if (templateName.includes("Feature")) {
			content = `
				<p><b>Problem / Goal:</b></p>
				<p>[Explain what you are trying to accomplish]</p>
				<p><b>Proposed Solution:</b></p>
				<p>[Describe your suggested feature or workflow]</p>
			`;
		} else if (templateName.includes("Question")) {
			content = `
				<p><b>Question / Inquiry:</b></p>
				<p>[Detail your question or guidance needed]</p>
				<p><b>Context:</b></p>
				<p>[Provide any relevant background or module information]</p>
			`;
		}

		if (content && this.dialog.fields_dict.ticket_description) {
			this.dialog.set_value("ticket_description", content);
		}
	}

	render_attachments_list() {
		const $wrapper = this.dialog.fields_dict.attachments_html.$wrapper;
		if (!this.attachments || this.attachments.length === 0) {
			$wrapper.html(`
				<div style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 8px;">
					No files attached yet. (Screenshots, PDFs, documents, logs supported)
				</div>
			`);
			return;
		}

		const itemsHtml = this.attachments.map((file, idx) => {
			const fileName = file.file_name || file.name || file.file_url.split("/").pop();
			return `
				<div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; margin-bottom: 6px;">
					<div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
						<span style="font-size: 13px; color: #64748b;">[File]</span>
						<a href="${file.file_url}" target="_blank" style="font-size: 12px; color: #2563eb; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
							${frappe.utils.escape_html(fileName)}
						</a>
					</div>
					<button type="button" class="btn btn-xs btn-outline-danger remove-att-btn" data-idx="${idx}" style="padding: 2px 8px;">
						Remove
					</button>
				</div>
			`;
		}).join("");

		$wrapper.html(`<div style="margin-bottom: 10px;">${itemsHtml}</div>`);

		$wrapper.find(".remove-att-btn").on("click", (e) => {
			const idx = $(e.currentTarget).data("idx");
			this.attachments.splice(idx, 1);
			this.render_attachments_list();
		});
	}

	render_diagnostics_preview(env) {
		const $wrapper = this.dialog.fields_dict.diagnostics_preview_html.$wrapper;
		$wrapper.html(`
			<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #475569;">
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
					<div><b>Current Route:</b> ${env.route}</div>
					<div><b>Document:</b> ${env.doctype} ${env.docname !== "None" ? `(${env.docname})` : ""}</div>
					<div><b>User:</b> ${env.user_fullname} (${env.user_email})</div>
					<div><b>Screen:</b> ${env.screen_resolution}</div>
				</div>
				${tactix._recent_errors.length > 0 ? `
					<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; color: #b91c1c;">
						<b>${tactix._recent_errors.length} recent JavaScript error(s) detected</b> will be attached automatically for analysis.
					</div>
				` : ""}
			</div>
		`);
	}

	prompt_file_upload() {
		new frappe.ui.FileUploader({
			folder: "Home/Tactix",
			restrictions: {
				max_number_of_files: 5
			},
			on_success: (file_doc) => {
				this.attachments.push({
					file_name: file_doc.file_name,
					file_url: file_doc.file_url,
					file_size: file_doc.file_size
				});
				this.render_attachments_list();
			}
		});
	}

	submit_ticket(values) {
		if (this.inUpload) return;
		this.inUpload = true;

		const system_info = values.include_diagnostics ? this.get_environment_info() : null;
		const console_logs = values.include_console_errors && tactix._recent_errors.length > 0
			? JSON.stringify(tactix._recent_errors, null, 2)
			: null;

		frappe.call({
			method: "tactix_support.utils.support.create_ticket",
			type: "POST",
			args: {
				title: values.ticket_title,
				description: values.ticket_description,
				priority: values.priority,
				ticket_type: values.ticket_type,
				attachments: this.attachments,
				system_info: system_info ? JSON.stringify(system_info) : null,
				console_logs: console_logs
			},
			freeze: true,
			freeze_message: __("Registering Support Ticket..."),
			callback: (r) => {
				this.inUpload = false;
				if (!r.exc && r.message) {
					const ticketId = (typeof r.message === "object" && r.message.ticket_id)
						? r.message.ticket_id
						: r.message;
					const portalUrl = (typeof r.message === "object" && r.message.portal_url)
						? r.message.portal_url
						: "";

					this.dialog.hide();
					frappe.show_alert({
						indicator: "green",
						message: __("Ticket #{0} raised successfully", [ticketId])
					}, 7);
					this.show_success_modal(ticketId, portalUrl);
				}
			},
			error: () => {
				this.inUpload = false;
			}
		});
	}

	show_success_modal(ticketId, portalUrl) {
		const cleanId = frappe.utils.escape_html(String(ticketId));
		const d = new frappe.ui.Dialog({
			title: __("Ticket Created"),
			size: "small",
			fields: [
				{
					fieldtype: "HTML",
					fieldname: "success_html",
					options: `
						<div style="text-align: center; padding: 12px 8px;">
							<div style="width: 48px; height: 48px; border-radius: 50%; background: #dcfce7; color: #16a34a; font-size: 22px; line-height: 48px; margin: 0 auto 12px auto; font-weight: bold;">
								&#10003;
							</div>
							<h4 style="margin: 0 0 6px 0; color: #1e293b; font-weight: 700;">Ticket Raised Successfully</h4>
							<p style="color: #64748b; font-size: 13px; margin: 0 0 14px 0;">
								Your ticket has been logged with the support engineering team.
							</p>
							<div style="background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 10px; padding: 14px 20px; margin: 0 auto 16px auto; text-align: center;">
								<div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1e40af; letter-spacing: 0.05em; margin-bottom: 2px;">Your Ticket ID</div>
								<div style="font-size: 24px; font-weight: 800; color: #1d4ed8;">#${cleanId}</div>
							</div>
						</div>
					`
				}
			],
			primary_action_label: __("Copy Ticket ID"),
			primary_action: () => {
				navigator.clipboard.writeText(String(ticketId)).then(() => {
					frappe.show_alert({
						indicator: "green",
						message: __("Ticket ID #{0} copied to clipboard!", [ticketId])
					});
				});
			},
			secondary_action_label: __("Done"),
			secondary_action: () => {
				d.hide();
			}
		});

		if (portalUrl) {
			d.set_secondary_action(() => {
				window.open(`${portalUrl}/tactix/tactix/account/login`, "_blank");
			});
			d.set_df_property("secondary_action_label", __("Open Support Portal"));
		}

		d.show();
	}
};

tactix_support.SupportTicket = tactix.SupportTicket;
