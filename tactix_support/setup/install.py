# Copyright (c) 2026, StakLogic and contributors
# For license information, please see license.txt

from tactix_support.setup.file import create_tactix_folder


def after_install():
	create_tactix_folder()
