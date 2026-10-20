from fastapi import Depends

from phub_api.models.user import User
from phub_api.dependencies.auth import require_customer_user
from phub_api.models.customer import CurrentCustomer


def require_customer(user: User = Depends(require_customer_user)) -> CurrentCustomer:
    return CurrentCustomer(customer_id=user.customer_id)
