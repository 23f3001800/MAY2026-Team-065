import os
import secrets
from dotenv import load_dotenv
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta, timezone

load_dotenv()

# No default. Every JWT the API issues is signed with this, and every protected
# route trusts whatever it validates -- so a fallback baked into the source is a
# published signing key. Anyone who can read the repository could mint an
# administrator token with it: no password, and nothing in the logs to tell it
# apart from a real sign-in.
#
# Refusing to start is the only safe behaviour. The previous default meant a
# deployment that simply forgot the variable came up looking healthy, which is
# exactly the case where nobody finds out. This matches how database.py already
# treats DATABASE_URL.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or not SECRET_KEY.strip():
    raise RuntimeError(
        "SECRET_KEY is not set. Every access token is signed with it, so there "
        "is no safe default. Generate one with:\n"
        "    python -c \"import secrets; print(secrets.token_urlsafe(48))\"\n"
        "and put it in backend/.env"
    )
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
