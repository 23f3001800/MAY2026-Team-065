import os
import secrets
from dotenv import load_dotenv
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta, timezone

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-for-dev")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Ambiguous glyphs are left out on purpose. A temporary password is read off a
# screen or an email and typed by hand, and "was that a 1 or an l" is how a new
# officer ends up locked out of an account that was created correctly.
_TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"


def generate_temporary_password(length: int = 14) -> str:
    """A random password for an account somebody else is creating.

    ``secrets`` rather than ``random``: these are real credentials for real
    accounts, and a predictable generator would mean anyone who knows roughly
    when a colleague was onboarded can narrow the search to something feasible.

    Fourteen characters from a 56-symbol alphabet is around 81 bits, which is
    more than enough for a password that is meant to be changed on first use.
    """
    return "".join(secrets.choice(_TEMP_ALPHABET) for _ in range(length))
