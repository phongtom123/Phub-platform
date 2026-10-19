from fastapi import Depends

from app.models.user import User
from app.dependencies.auth import require_customer_user
from app.models.customer import CurrentCustomer


def require_customer(user: User = Depends(require_customer_user)) -> CurrentCustomer:
    return CurrentCustomer(customer_id=user.customer_id)
