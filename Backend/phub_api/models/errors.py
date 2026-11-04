"""Application errors shared by services and HTTP error adapters."""


class CatalogError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code, self.code, self.message = status_code, code, message


class OrderError(Exception):
    def __init__(self, status_code, code, message, details=None):
        super().__init__(message)
        self.status_code, self.code, self.message = status_code, code, message
        self.details = details or []


class PaymentError(Exception):
    def __init__(self, status_code, code, message):
        super().__init__(message)
        self.status_code, self.code, self.message = status_code, code, message
