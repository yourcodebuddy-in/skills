"""Clients for the SMS and card-payment providers, chosen from settings."""

from __future__ import annotations

from clinicbook.config import Config
from clinicbook.gateways.payments import LogOnlyPayments, PaymentGateway
from clinicbook.gateways.sms import LogOnlySms, SmsGateway


def sms_from_config(config: Config) -> SmsGateway | LogOnlySms:
    if not config.sms_url:
        return LogOnlySms()
    return SmsGateway(config.sms_url, config.sms_api_key, config.sms_sender, timeout=config.sms_timeout_seconds)


def payments_from_config(config: Config) -> PaymentGateway | LogOnlyPayments:
    if not config.payments_url:
        return LogOnlyPayments()
    return PaymentGateway(config.payments_url, config.payments_api_key)
