"""Mobile numbers are stored in E.164 form (+919876543210), so the same
number typed as "98765 43210", "+91-98765-43210" or "919876543210" matches."""
import re


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"[\s\-().]", "", raw or "")
    if re.fullmatch(r"[6-9]\d{9}", digits):          # Indian mobile without code
        return "+91" + digits
    if re.fullmatch(r"0[6-9]\d{9}", digits):         # with a leading trunk 0
        return "+91" + digits[1:]
    if re.fullmatch(r"91[6-9]\d{9}", digits):        # country code without +
        return "+" + digits
    if re.fullmatch(r"\+[1-9]\d{7,14}", digits):      # any international number
        return digits
    raise ValueError("Enter a valid mobile number, e.g. 98765 43210 or +91 98765 43210")
