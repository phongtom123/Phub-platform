"""Server-only gateway bypass; invoice and payment records still persist normally."""
from dataclasses import dataclass
import os


@dataclass(frozen=True)
class PaymentDemoSettings:
    enabled: bool

    def permits(self, customer_id: str) -> bool:
        return self.enabled

    @classmethod
    def from_environment(cls):
        return cls(enabled=os.getenv("PAYMENT_DEMO_ENABLED", "false").lower() == "true")
