"""
TRADUX Backend — FastAPI
Certified Translation Service with AI Translation Pipeline

Same infrastructure as Legacy-Portal (Stripe, Resend, MongoDB)
but separate DB/collections and TRADUX branding.

Pipeline: Order → Pay → Admin Start → OCR → AI Translate → AI Proofread → PM Review → Client Review → Done
"""

import os
import io
import re
import json
import math
import uuid
import base64
import secrets
import logging
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import (
    FastAPI, APIRouter, File, UploadFile, Form,
    HTTPException, Request, BackgroundTasks, Body, Header, Query
)
from fastapi.responses import JSONResponse, HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr

import stripe
import resend
import httpx

# Conditional imports for document processing
try:
    import pytesseract
    from PIL import Image
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

try:
    import boto3
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / '.env')
except ImportError:
    pass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tradux")

# MongoDB
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "tradux")

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]
fs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="tradux_files")

# Stripe (same keys as Legacy — separated by metadata.brand = "tradux")
stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_TEST_MODE = stripe.api_key.startswith("sk_test_") if stripe.api_key else True

# Email
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "TRADUX <onboarding@resend.dev>")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "contact@tradux.online")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# AI
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# CORS
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "https://tradux.online,https://tradux-site.vercel.app,http://localhost:5173"
).split(",")

# ---------------------------------------------------------------------------
# Pricing
# ---------------------------------------------------------------------------
TIER_PRICING = {
    "standard": {"per_page": 19.00, "name": "Standard", "description": "Certified translation"},
    "professional": {"per_page": 29.00, "name": "Professional", "description": "Translated + Proofread"},
    "specialist": {"per_page": 39.00, "name": "Specialist", "description": "Field-specific expert"},
}

CERT_FEES = {
    "certified": 0,
    "notarized": 15.00,
    "apostille": 75.00,
}

DELIVERY_SPEED_MULTIPLIER = {
    "standard": 1.0,
    "urgent": 1.25,
    "same-day": 1.50,
}

DELIVERY_METHOD_FEES = {
    "email": 0,
    "mail": 15.00,
    "fedex": 35.00,
}

CURRENCY_CONFIG = {
    "usd": {"symbol": "$", "name": "US Dollar", "payment_methods": ["card"]},
    "brl": {"symbol": "R$", "name": "Brazilian Real", "payment_methods": ["card", "pix"]},
    "eur": {"symbol": "€", "name": "Euro", "payment_methods": ["card"]},
    "gbp": {"symbol": "£", "name": "British Pound", "payment_methods": ["card"]},
}

# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class OrderRequest(BaseModel):
    """Frontend order form submission"""
    service_tier: str = "standard"
    cert_type: str = "certified"
    delivery_speed: str = "standard"
    delivery_method: str = "email"
    source_language: str = "portuguese"
    target_language: str = "english"
    document_type: str = ""
    purpose: str = ""
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    notes: Optional[str] = None
    page_count: int = 1
    document_ids: Optional[List[str]] = None
    currency: Optional[str] = "usd"


class PaymentCheckoutRequest(BaseModel):
    quote_id: str
    origin_url: str
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None
    currency: Optional[str] = "usd"


class TranslationStartRequest(BaseModel):
    order_id: str
    ai_commands: Optional[str] = None  # Pre-selected translation instructions


class TranslationReviewRequest(BaseModel):
    order_id: str
    action: str  # "approve" or "request_correction"
    correction_notes: Optional[str] = None


class AdminActionRequest(BaseModel):
    order_id: str
    action: str  # "start_translation", "approve_pm", "send_to_client", "mark_complete"
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# GridFS Helpers (same pattern as Legacy)
# ---------------------------------------------------------------------------

async def store_file_gridfs(file_data: bytes, filename: str, content_type: str, metadata: dict = None) -> str:
    """Store file bytes in GridFS, return file_id string"""
    file_metadata = {
        "filename": filename,
        "content_type": content_type,
        "uploaded_at": datetime.utcnow(),
    }
    if metadata:
        file_metadata.update(metadata)
    file_id = await fs_bucket.upload_from_stream(
        filename, io.BytesIO(file_data), metadata=file_metadata
    )
    return str(file_id)


async def retrieve_file_gridfs(file_id: str):
    """Retrieve file from GridFS. Returns (bytes, filename, content_type)"""
    from bson import ObjectId
    grid_out = await fs_bucket.open_download_stream(ObjectId(file_id))
    file_bytes = await grid_out.read()
    filename = grid_out.filename or "document"
    ct = "application/octet-stream"
    if grid_out.metadata:
        ct = grid_out.metadata.get("content_type", ct)
    return file_bytes, filename, ct


# ---------------------------------------------------------------------------
# Email Service (Resend — TRADUX branding)
# ---------------------------------------------------------------------------

class EmailService:
    def __init__(self):
        self.sender = SENDER_EMAIL
        self.reply_to = ADMIN_EMAIL

    async def send(self, to: str, subject: str, html: str):
        if not RESEND_API_KEY:
            logger.warning("RESEND_API_KEY not set — email skipped")
            return False
        try:
            params = {
                "from": self.sender,
                "to": [to],
                "subject": subject,
                "reply_to": self.reply_to,
                "html": html,
                "headers": {"X-Entity-Ref-ID": secrets.token_hex(8)},
            }
            resend.Emails.send(params)
            logger.info(f"Email sent to {to}: {subject}")
            return True
        except Exception as e:
            logger.error(f"Email failed to {to}: {e}")
            return False

    async def send_with_attachments(self, to: str, subject: str, html: str, attachments: list):
        if not RESEND_API_KEY:
            return False
        try:
            att_list = []
            for att in attachments:
                if isinstance(att["content"], bytes):
                    att_list.append({"filename": att["filename"], "content": list(att["content"])})
                else:
                    att_list.append({"filename": att["filename"], "content": list(base64.b64decode(att["content"]))})
            params = {
                "from": self.sender,
                "to": [to],
                "subject": subject,
                "reply_to": self.reply_to,
                "html": html,
                "headers": {"X-Entity-Ref-ID": secrets.token_hex(8)},
                "attachments": att_list,
            }
            resend.Emails.send(params)
            return True
        except Exception as e:
            logger.error(f"Email with attachments failed: {e}")
            return False

    def _base_template(self, body_content: str) -> str:
        return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; margin:0; padding:0; background:#f7fafc; }}
            .wrapper {{ max-width:600px; margin:0 auto; background:white; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08); }}
            .header {{ background:linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%); padding:30px; text-align:center; }}
            .header h1 {{ color:white; margin:0; font-size:28px; letter-spacing:2px; }}
            .header .badge {{ display:inline-block; background:#ff6b35; color:white; padding:4px 12px; border-radius:20px; font-size:12px; margin-top:8px; }}
            .body {{ padding:30px; }}
            .footer {{ background:#f7fafc; padding:20px; text-align:center; font-size:12px; color:#718096; border-top:1px solid #e2e8f0; }}
            .btn {{ display:inline-block; background:linear-gradient(135deg,#ff6b35,#ff8c42); color:white; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:700; font-size:16px; }}
            .info-box {{ background:#f0f9ff; border-left:4px solid #3182ce; padding:15px; margin:15px 0; border-radius:0 8px 8px 0; }}
            .status-badge {{ display:inline-block; padding:6px 16px; border-radius:20px; font-weight:600; font-size:13px; }}
        </style></head><body>
        <div class="wrapper">
            <div class="header">
                <h1>TRADUX</h1>
                <div class="badge">Certified Translations</div>
            </div>
            <div class="body">{body_content}</div>
            <div class="footer">
                <p><strong>TRADUX</strong> — Professional Certified Translation Services</p>
                <p>contact@tradux.online | +1 (689) 309-4980</p>
                <p>Boston, MA, United States</p>
            </div>
        </div></body></html>"""

    def order_confirmation(self, order: dict) -> str:
        body = f"""
        <h2 style="color:#1a365d;">Order Confirmed! ✓</h2>
        <p>Dear <strong>{order.get('customer_name', 'Customer')}</strong>,</p>
        <p>Thank you for your order. Your certified translation is being processed.</p>
        <div class="info-box">
            <p><strong>Order Number:</strong> {order.get('order_number', 'N/A')}</p>
            <p><strong>Service:</strong> {order.get('service_tier', '').title()} — {order.get('translate_from', '')} → {order.get('translate_to', '')}</p>
            <p><strong>Document Type:</strong> {order.get('document_type', 'N/A')}</p>
            <p><strong>Certification:</strong> {order.get('cert_type', 'certified').title()}</p>
            <p><strong>Total:</strong> ${order.get('total_price', 0):.2f}</p>
        </div>
        <h3 style="color:#1a365d;">What Happens Next?</h3>
        <ol>
            <li>Your documents are being reviewed by our team</li>
            <li>A certified translator will be assigned to your project</li>
            <li>You'll receive your completed translation via email</li>
            <li>You can review and request corrections if needed</li>
        </ol>
        <p style="text-align:center;margin-top:25px;">
            <span class="status-badge" style="background:#ebf8ff;color:#3182ce;">Processing</span>
        </p>
        """
        return self._base_template(body)

    def translation_ready(self, order: dict, review_url: str) -> str:
        body = f"""
        <h2 style="color:#1a365d;">Your Translation is Ready for Review</h2>
        <p>Dear <strong>{order.get('customer_name', 'Customer')}</strong>,</p>
        <p>Great news! Your certified translation for order <strong>{order.get('order_number', '')}</strong> has been completed and is ready for your review.</p>
        <div class="info-box">
            <p><strong>Document:</strong> {order.get('document_type', 'N/A')}</p>
            <p><strong>Languages:</strong> {order.get('translate_from', '')} → {order.get('translate_to', '')}</p>
            <p><strong>Service:</strong> {order.get('service_tier', '').title()}</p>
        </div>
        <p>Please review your translation and let us know if everything looks good, or if you'd like any corrections.</p>
        <p style="text-align:center;margin:25px 0;">
            <a href="{review_url}" class="btn">Review Your Translation</a>
        </p>
        <p style="font-size:13px;color:#718096;">This link is valid for 30 days. If you have any questions, reply to this email or call us at +1 (689) 309-4980.</p>
        """
        return self._base_template(body)

    def client_approved(self, order: dict) -> str:
        body = f"""
        <h2 style="color:#10b981;">Translation Approved ✓</h2>
        <p>Dear <strong>{order.get('customer_name', 'Customer')}</strong>,</p>
        <p>Thank you for approving your translation for order <strong>{order.get('order_number', '')}</strong>.</p>
        <p>Your final certified translation document is attached to this email. It includes:</p>
        <ul>
            <li>✓ Signed Certificate of Accuracy</li>
            <li>✓ Company letterhead and stamp</li>
            <li>✓ USCIS/Court-ready formatting</li>
        </ul>
        <div class="info-box">
            <p><strong>Need physical copies?</strong> If you selected mail or FedEx delivery, your hard copies are on the way.</p>
        </div>
        <p>Thank you for choosing TRADUX! If you need additional translations, we're always here to help.</p>
        """
        return self._base_template(body)

    def correction_requested(self, order: dict, notes: str) -> str:
        body = f"""
        <h2 style="color:#f59e0b;">Correction Request Received</h2>
        <p>Dear <strong>{order.get('customer_name', 'Customer')}</strong>,</p>
        <p>We've received your correction request for order <strong>{order.get('order_number', '')}</strong>.</p>
        <div class="info-box">
            <p><strong>Your notes:</strong></p>
            <p>{notes}</p>
        </div>
        <p>Our team is working on the corrections and you'll receive the updated translation shortly.</p>
        """
        return self._base_template(body)

    def admin_new_order(self, order: dict) -> str:
        body = f"""
        <h2 style="color:#1a365d;">New TRADUX Order</h2>
        <div class="info-box">
            <p><strong>Order:</strong> {order.get('order_number', 'N/A')}</p>
            <p><strong>Customer:</strong> {order.get('customer_name', '')} ({order.get('customer_email', '')})</p>
            <p><strong>Service:</strong> {order.get('service_tier', '').title()}</p>
            <p><strong>Languages:</strong> {order.get('translate_from', '')} → {order.get('translate_to', '')}</p>
            <p><strong>Document:</strong> {order.get('document_type', 'N/A')}</p>
            <p><strong>Certification:</strong> {order.get('cert_type', 'certified').title()}</p>
            <p><strong>Total:</strong> ${order.get('total_price', 0):.2f}</p>
            <p><strong>Payment:</strong> {order.get('payment_status', 'pending')}</p>
        </div>
        <p style="text-align:center;margin:20px 0;">
            <a href="https://tradux.online/admin" class="btn">Open Admin Dashboard</a>
        </p>
        """
        return self._base_template(body)


email_service = EmailService()


# ---------------------------------------------------------------------------
# OCR & Document Processing
# ---------------------------------------------------------------------------

async def extract_text_from_file(file_bytes: bytes, filename: str, content_type: str) -> dict:
    """Extract text from uploaded document using OCR/PDF parsing"""
    text = ""
    word_count = 0
    page_count = 1
    method = "estimate"

    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    # PDF processing
    if ext == "pdf" and HAS_PYMUPDF:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            page_count = len(doc)
            pages_text = []
            for page in doc:
                page_text = page.get_text()
                if page_text.strip():
                    pages_text.append(page_text)
                elif HAS_TESSERACT:
                    # OCR for scanned pages
                    pix = page.get_pixmap(dpi=300)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    page_text = pytesseract.image_to_string(img, lang="eng+por+spa")
                    pages_text.append(page_text)
            doc.close()
            text = "\n\n".join(pages_text)
            word_count = len(text.split())
            method = "pdf_extract" if any(p.strip() for p in pages_text) else "ocr"
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")

    # Image processing (OCR)
    elif ext in ("jpg", "jpeg", "png", "tiff", "bmp") and HAS_TESSERACT:
        try:
            img = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(img, lang="eng+por+spa")
            word_count = len(text.split())
            method = "ocr"
        except Exception as e:
            logger.error(f"OCR error: {e}")

    # DOCX processing
    elif ext == "docx":
        try:
            from docx import Document
            doc = Document(io.BytesIO(file_bytes))
            text = "\n".join([p.text for p in doc.paragraphs])
            word_count = len(text.split())
            page_count = max(1, math.ceil(word_count / 250))
            method = "docx_extract"
        except Exception as e:
            logger.error(f"DOCX extraction error: {e}")

    # Fallback estimate
    if word_count == 0:
        file_size_kb = len(file_bytes) / 1024
        word_count = max(250, int(file_size_kb * 10))
        page_count = max(1, math.ceil(word_count / 250))
        method = "estimate"

    return {
        "text": text,
        "word_count": word_count,
        "page_count": page_count,
        "method": method,
    }


# ---------------------------------------------------------------------------
# AI Translation Pipeline
# ---------------------------------------------------------------------------

class TranslationPipeline:
    """AI-powered translation pipeline using Claude"""

    def __init__(self):
        self.client = None
        if HAS_ANTHROPIC and ANTHROPIC_API_KEY:
            self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    async def translate(self, text: str, source_lang: str, target_lang: str,
                        document_type: str = "", service_tier: str = "standard",
                        ai_commands: str = "") -> dict:
        """Step 1: AI Translation"""
        if not self.client:
            return {"translated_text": "", "error": "AI service not configured"}

        system_prompt = f"""You are a professional certified translator working for TRADUX,
a certified translation service. You provide accurate, official translations that are
accepted by USCIS, courts, universities, and government agencies.

TRANSLATION REQUIREMENTS:
- Translate from {source_lang} to {target_lang}
- Document type: {document_type or 'general document'}
- Service level: {service_tier}
- Maintain the original document's formatting and structure
- Preserve all names, dates, numbers, and addresses exactly
- Use proper legal/official terminology
- Do NOT add any notes or commentary — output ONLY the translation
{"- Additional instructions: " + ai_commands if ai_commands else ""}"""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=8000,
                system=system_prompt,
                messages=[{"role": "user", "content": f"Translate the following document:\n\n{text}"}]
            )
            translated = response.content[0].text
            return {"translated_text": translated, "tokens_used": response.usage.input_tokens + response.usage.output_tokens}
        except Exception as e:
            logger.error(f"Translation error: {e}")
            return {"translated_text": "", "error": str(e)}

    async def proofread(self, original_text: str, translated_text: str,
                        source_lang: str, target_lang: str,
                        document_type: str = "") -> dict:
        """Step 2: AI Proofreading"""
        if not self.client:
            return {"proofread_text": translated_text, "corrections": [], "error": "AI not configured"}

        system_prompt = f"""You are a senior proofreader at TRADUX certified translation service.
Your job is to review a translation from {source_lang} to {target_lang} and correct any errors.

PROOFREADING REQUIREMENTS:
- Check accuracy against the original text
- Fix grammar, spelling, and punctuation errors
- Ensure proper terminology for {document_type or 'official documents'}
- Verify all names, dates, and numbers are correctly translated
- Ensure the translation reads naturally in {target_lang}
- Output the corrected translation text
- After the corrected text, add a section "---CORRECTIONS---" listing what you changed (if anything)"""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=8000,
                system=system_prompt,
                messages=[{"role": "user", "content": f"ORIGINAL ({source_lang}):\n{original_text}\n\nTRANSLATION ({target_lang}):\n{translated_text}"}]
            )
            result = response.content[0].text
            parts = result.split("---CORRECTIONS---")
            proofread_text = parts[0].strip()
            corrections = parts[1].strip() if len(parts) > 1 else "No corrections needed."

            return {
                "proofread_text": proofread_text,
                "corrections": corrections,
                "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
            }
        except Exception as e:
            logger.error(f"Proofreading error: {e}")
            return {"proofread_text": translated_text, "corrections": [], "error": str(e)}


translation_pipeline = TranslationPipeline()


# ---------------------------------------------------------------------------
# Price Calculation
# ---------------------------------------------------------------------------

def calculate_order_price(
    page_count: int,
    service_tier: str,
    cert_type: str,
    delivery_speed: str,
    delivery_method: str,
) -> dict:
    tier = TIER_PRICING.get(service_tier, TIER_PRICING["standard"])
    base = page_count * tier["per_page"]
    speed_mult = DELIVERY_SPEED_MULTIPLIER.get(delivery_speed, 1.0)
    translation_cost = base * speed_mult
    cert_fee = CERT_FEES.get(cert_type, 0)
    delivery_fee = DELIVERY_METHOD_FEES.get(delivery_method, 0)
    total = translation_cost + cert_fee + delivery_fee

    return {
        "base_price": round(base, 2),
        "speed_multiplier": speed_mult,
        "translation_cost": round(translation_cost, 2),
        "cert_fee": round(cert_fee, 2),
        "delivery_fee": round(delivery_fee, 2),
        "total_price": round(total, 2),
        "per_page": tier["per_page"],
        "page_count": page_count,
    }


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(title="TRADUX API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@api.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "tradux",
        "stripe_configured": bool(stripe.api_key),
        "stripe_test_mode": STRIPE_TEST_MODE,
        "email_configured": bool(RESEND_API_KEY),
        "ai_configured": bool(ANTHROPIC_API_KEY),
        "mongodb_configured": bool(MONGO_URL),
    }


# ---------------------------------------------------------------------------
# Document Upload
# ---------------------------------------------------------------------------

@api.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):
    """Upload document, extract text via OCR, store in GridFS"""
    try:
        file_bytes = await file.read()
        if len(file_bytes) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 20MB)")

        # Extract text
        extraction = await extract_text_from_file(file_bytes, file.filename, file.content_type)

        # Store in GridFS
        doc_id = str(uuid.uuid4())
        gridfs_id = await store_file_gridfs(
            file_bytes, file.filename, file.content_type,
            metadata={"doc_id": doc_id, "word_count": extraction["word_count"]}
        )

        # Store document record
        doc_record = {
            "id": doc_id,
            "filename": file.filename,
            "content_type": file.content_type,
            "file_size": len(file_bytes),
            "gridfs_id": gridfs_id,
            "word_count": extraction["word_count"],
            "page_count": extraction["page_count"],
            "extraction_method": extraction["method"],
            "extracted_text": extraction["text"][:10000],  # Store first 10k chars
            "uploaded_at": datetime.utcnow(),
        }
        await db.documents.insert_one(doc_record)

        return {
            "document_id": doc_id,
            "filename": file.filename,
            "file_size": len(file_bytes),
            "word_count": extraction["word_count"],
            "page_count": extraction["page_count"],
            "extraction_method": extraction["method"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="Upload failed")


# ---------------------------------------------------------------------------
# Quote / Price Calculation
# ---------------------------------------------------------------------------

@api.post("/calculate-quote")
async def calculate_quote(order: OrderRequest):
    """Calculate price and create a quote record"""
    pricing = calculate_order_price(
        order.page_count, order.service_tier, order.cert_type,
        order.delivery_speed, order.delivery_method,
    )

    quote_id = str(uuid.uuid4())
    reference = f"TDX-{datetime.utcnow().strftime('%Y%m%d')}-{quote_id[:6].upper()}"

    quote = {
        "id": quote_id,
        "reference": reference,
        "service_tier": order.service_tier,
        "cert_type": order.cert_type,
        "delivery_speed": order.delivery_speed,
        "delivery_method": order.delivery_method,
        "source_language": order.source_language,
        "target_language": order.target_language,
        "document_type": order.document_type,
        "purpose": order.purpose,
        "page_count": order.page_count,
        "customer_name": order.full_name,
        "customer_email": order.email,
        "customer_phone": order.phone,
        "notes": order.notes,
        "document_ids": order.document_ids or [],
        **pricing,
        "status": "pending_payment",
        "created_at": datetime.utcnow(),
    }
    await db.quotes.insert_one(quote)

    return {
        "id": quote_id,
        "reference": reference,
        **pricing,
    }


# ---------------------------------------------------------------------------
# Stripe Payment
# ---------------------------------------------------------------------------

@api.post("/create-payment-checkout")
async def create_payment_checkout(req: PaymentCheckoutRequest):
    """Create Stripe checkout session (same pattern as Legacy)"""
    try:
        quote = await db.quotes.find_one({"id": req.quote_id})
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")

        currency = (req.currency or "usd").lower()
        if currency not in CURRENCY_CONFIG:
            currency = "usd"
        currency_info = CURRENCY_CONFIG[currency]

        amount = quote["total_price"]

        # Currency conversion for non-USD
        if currency != "usd":
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"https://api.exchangerate-api.com/v4/latest/USD", timeout=5)
                    rates = resp.json().get("rates", {})
                    rate = rates.get(currency.upper(), 1.0)
                    amount = quote["total_price"] * rate
            except Exception:
                # Fallback rates
                fallback = {"brl": 5.0, "eur": 0.92, "gbp": 0.79}
                amount = quote["total_price"] * fallback.get(currency, 1.0)

        customer_email = req.customer_email or quote.get("customer_email")
        stripe_locale_map = {"en": "en", "es": "es", "pt": "pt-BR"}

        tier_name = TIER_PRICING.get(quote.get("service_tier", "standard"), {}).get("name", "Standard")

        checkout_params = {
            "payment_method_types": currency_info["payment_methods"],
            "line_items": [{
                "price_data": {
                    "currency": currency,
                    "product_data": {
                        "name": f"TRADUX — {tier_name} Certified Translation",
                        "description": f"{quote.get('source_language', '')} → {quote.get('target_language', '')} | {quote.get('page_count', 1)} page(s) | {quote.get('cert_type', 'certified').title()}",
                    },
                    "unit_amount": int(amount * 100),
                },
                "quantity": 1,
            }],
            "mode": "payment",
            "allow_promotion_codes": True,
            "success_url": f"{req.origin_url}/success?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{req.origin_url}/cancel",
            "metadata": {
                "brand": "tradux",
                "quote_id": req.quote_id,
                "customer_email": customer_email or "",
                "customer_name": req.customer_name or quote.get("customer_name", ""),
                "original_amount_usd": str(quote["total_price"]),
                "charged_currency": currency,
            },
        }
        if customer_email:
            checkout_params["customer_email"] = customer_email

        session = stripe.checkout.Session.create(**checkout_params)

        # Store payment transaction
        await db.payment_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "quote_id": req.quote_id,
            "amount": round(amount, 2),
            "currency": currency,
            "payment_status": "pending",
            "brand": "tradux",
            "created_at": datetime.utcnow(),
        })

        return {
            "status": "success",
            "checkout_url": session.url,
            "session_id": session.id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout")


@api.post("/stripe-webhook")
async def stripe_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Stripe webhook — only process TRADUX orders (metadata.brand == 'tradux')"""
    try:
        payload = await request.body()
        sig = request.headers.get("stripe-signature")

        if STRIPE_WEBHOOK_SECRET:
            if not sig:
                raise HTTPException(status_code=400, detail="Missing signature")
            try:
                event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
            except stripe.error.SignatureVerificationError:
                raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            event = stripe.Event.construct_from(json.loads(payload.decode("utf-8")), stripe.api_key)

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            metadata = session.get("metadata", {})

            # IMPORTANT: Only process TRADUX orders, skip Legacy orders
            if metadata.get("brand") != "tradux":
                return {"status": "skipped", "reason": "not a tradux order"}

            session_id = session["id"]
            quote_id = metadata.get("quote_id")

            # Update payment transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.utcnow()}}
            )

            # Create the order
            background_tasks.add_task(create_order_from_payment, session_id, quote_id, metadata)

        return {"status": "success", "received": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail="Webhook error")


async def create_order_from_payment(session_id: str, quote_id: str, metadata: dict):
    """Background task: create order after successful payment"""
    try:
        quote = await db.quotes.find_one({"id": quote_id})
        if not quote:
            logger.error(f"Quote {quote_id} not found for session {session_id}")
            return

        order_count = await db.orders.count_documents({})
        order_number = f"TDX-{order_count + 1001}"

        order = {
            "id": str(uuid.uuid4()),
            "order_number": order_number,
            "quote_id": quote_id,
            "stripe_session_id": session_id,
            "customer_name": quote.get("customer_name", metadata.get("customer_name", "")),
            "customer_email": quote.get("customer_email", metadata.get("customer_email", "")),
            "customer_phone": quote.get("customer_phone", ""),
            "service_tier": quote.get("service_tier", "standard"),
            "cert_type": quote.get("cert_type", "certified"),
            "delivery_speed": quote.get("delivery_speed", "standard"),
            "delivery_method": quote.get("delivery_method", "email"),
            "source_language": quote.get("source_language", "portuguese"),
            "target_language": quote.get("target_language", "english"),
            "document_type": quote.get("document_type", ""),
            "purpose": quote.get("purpose", ""),
            "page_count": quote.get("page_count", 1),
            "notes": quote.get("notes", ""),
            "document_ids": quote.get("document_ids", []),
            "base_price": quote.get("base_price", 0),
            "total_price": quote.get("total_price", 0),
            "payment_status": "paid",
            "payment_method": "stripe",

            # Translation pipeline status
            "translation_status": "received",  # received → ocr_processing → translating → proofreading → pm_review → client_review → corrections → completed
            "original_text": "",
            "translated_text": "",
            "proofread_text": "",
            "ai_corrections": "",
            "pm_approved": False,
            "client_approved": False,
            "correction_notes": "",
            "review_token": secrets.token_urlsafe(32),

            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        await db.orders.insert_one(order)

        # Update quote status
        await db.quotes.update_one(
            {"id": quote_id},
            {"$set": {"status": "paid", "order_id": order["id"], "order_number": order_number}}
        )

        # Send confirmation emails
        customer_email = order["customer_email"]
        if customer_email:
            await email_service.send(
                customer_email,
                f"Order Confirmed — {order_number} | TRADUX",
                email_service.order_confirmation(order),
            )
        await email_service.send(
            ADMIN_EMAIL,
            f"New Order — {order_number} | {order['customer_name']}",
            email_service.admin_new_order(order),
        )

        logger.info(f"Order {order_number} created from payment {session_id}")

    except Exception as e:
        logger.error(f"Error creating order from payment: {e}")


# ---------------------------------------------------------------------------
# Admin Endpoints
# ---------------------------------------------------------------------------

@api.get("/admin/orders")
async def list_orders(status: Optional[str] = None, limit: int = 50, skip: int = 0):
    """List all orders (admin)"""
    query = {}
    if status:
        query["translation_status"] = status
    cursor = db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit)
    orders = []
    async for doc in cursor:
        doc.pop("_id", None)
        orders.append(doc)
    total = await db.orders.count_documents(query)
    return {"orders": orders, "total": total}


@api.get("/admin/orders/{order_id}")
async def get_order(order_id: str):
    """Get single order detail"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.pop("_id", None)

    # Include document info
    docs = []
    for doc_id in order.get("document_ids", []):
        doc = await db.documents.find_one({"id": doc_id})
        if doc:
            doc.pop("_id", None)
            doc.pop("extracted_text", None)  # Don't send full text in list
            docs.append(doc)
    order["documents"] = docs
    return order


@api.get("/admin/orders/{order_id}/document-text")
async def get_document_text(order_id: str):
    """Get extracted text from order documents"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    texts = []
    for doc_id in order.get("document_ids", []):
        doc = await db.documents.find_one({"id": doc_id})
        if doc:
            texts.append({
                "document_id": doc_id,
                "filename": doc.get("filename", ""),
                "text": doc.get("extracted_text", ""),
                "word_count": doc.get("word_count", 0),
                "page_count": doc.get("page_count", 1),
            })
    return {"order_id": order_id, "documents": texts}


@api.post("/admin/start-translation")
async def start_translation(req: TranslationStartRequest, background_tasks: BackgroundTasks):
    """Admin clicks 'Start Translation' — triggers AI pipeline"""
    order = await db.orders.find_one({"id": req.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Gather all extracted text from documents
    full_text = ""
    for doc_id in order.get("document_ids", []):
        doc = await db.documents.find_one({"id": doc_id})
        if doc:
            full_text += doc.get("extracted_text", "") + "\n\n"

    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No text found in documents. Run OCR first.")

    # Update status
    await db.orders.update_one(
        {"id": req.order_id},
        {"$set": {
            "translation_status": "translating",
            "original_text": full_text.strip(),
            "updated_at": datetime.utcnow(),
        }}
    )

    # Run AI pipeline in background
    background_tasks.add_task(
        run_translation_pipeline,
        req.order_id,
        full_text.strip(),
        order.get("source_language", "portuguese"),
        order.get("target_language", "english"),
        order.get("document_type", ""),
        order.get("service_tier", "standard"),
        req.ai_commands or "",
    )

    return {"status": "started", "order_id": req.order_id, "message": "Translation pipeline started"}


async def run_translation_pipeline(
    order_id: str, text: str, source_lang: str, target_lang: str,
    document_type: str, service_tier: str, ai_commands: str
):
    """Background: OCR text → AI Translate → AI Proofread → Ready for PM"""
    try:
        # Step 1: AI Translation
        logger.info(f"[{order_id}] Starting AI translation...")
        translation_result = await translation_pipeline.translate(
            text, source_lang, target_lang, document_type, service_tier, ai_commands
        )

        if translation_result.get("error"):
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {
                    "translation_status": "translation_error",
                    "error_message": translation_result["error"],
                    "updated_at": datetime.utcnow(),
                }}
            )
            return

        translated_text = translation_result["translated_text"]

        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "translated_text": translated_text,
                "translation_status": "proofreading",
                "updated_at": datetime.utcnow(),
            }}
        )

        # Step 2: AI Proofreading
        logger.info(f"[{order_id}] Starting AI proofreading...")
        proofread_result = await translation_pipeline.proofread(
            text, translated_text, source_lang, target_lang, document_type
        )

        proofread_text = proofread_result.get("proofread_text", translated_text)
        corrections = proofread_result.get("corrections", "")

        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "proofread_text": proofread_text,
                "ai_corrections": corrections,
                "translation_status": "pm_review",
                "updated_at": datetime.utcnow(),
            }}
        )

        # Notify admin that translation is ready for PM review
        order = await db.orders.find_one({"id": order_id})
        if order:
            await email_service.send(
                ADMIN_EMAIL,
                f"Translation Ready for PM Review — {order.get('order_number', '')}",
                email_service._base_template(f"""
                    <h2 style="color:#1a365d;">Translation Ready for Review</h2>
                    <p>Order <strong>{order.get('order_number', '')}</strong> has been translated and proofread by AI.</p>
                    <div class="info-box">
                        <p><strong>Customer:</strong> {order.get('customer_name', '')}</p>
                        <p><strong>Languages:</strong> {order.get('source_language', '')} → {order.get('target_language', '')}</p>
                        <p><strong>AI Corrections:</strong> {corrections or 'None'}</p>
                    </div>
                    <p style="text-align:center;">
                        <a href="https://tradux.online/admin" class="btn">Review Translation</a>
                    </p>
                """),
            )

        logger.info(f"[{order_id}] Pipeline complete — ready for PM review")

    except Exception as e:
        logger.error(f"[{order_id}] Pipeline error: {e}")
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "translation_status": "translation_error",
                "error_message": str(e),
                "updated_at": datetime.utcnow(),
            }}
        )


@api.post("/admin/approve-pm")
async def approve_pm(req: AdminActionRequest, background_tasks: BackgroundTasks):
    """PM approves translation and sends to client for review"""
    order = await db.orders.find_one({"id": req.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    review_token = order.get("review_token", secrets.token_urlsafe(32))
    review_url = f"https://tradux.online/review/{order['id']}?token={review_token}"

    await db.orders.update_one(
        {"id": req.order_id},
        {"$set": {
            "translation_status": "client_review",
            "pm_approved": True,
            "pm_notes": req.notes or "",
            "review_token": review_token,
            "updated_at": datetime.utcnow(),
        }}
    )

    # Send email to client with review link
    customer_email = order.get("customer_email")
    if customer_email:
        await email_service.send(
            customer_email,
            f"Your Translation is Ready — {order.get('order_number', '')} | TRADUX",
            email_service.translation_ready(order, review_url),
        )

    return {"status": "sent_to_client", "review_url": review_url}


@api.post("/admin/update-translation")
async def update_translation(order_id: str = Body(...), proofread_text: str = Body(...)):
    """PM edits the translation text before sending to client"""
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"proofread_text": proofread_text, "updated_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"status": "updated"}


@api.post("/admin/mark-complete")
async def mark_complete(req: AdminActionRequest):
    """Admin marks order as completed"""
    order = await db.orders.find_one({"id": req.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await db.orders.update_one(
        {"id": req.order_id},
        {"$set": {
            "translation_status": "completed",
            "completed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }}
    )

    # Send final delivery email with attachment
    customer_email = order.get("customer_email")
    if customer_email:
        await email_service.send(
            customer_email,
            f"Translation Delivered — {order.get('order_number', '')} | TRADUX",
            email_service.client_approved(order),
        )

    return {"status": "completed", "order_number": order.get("order_number")}


# ---------------------------------------------------------------------------
# PM Upload External Translation
# ---------------------------------------------------------------------------

@api.post("/admin/upload-pm-translation")
async def upload_pm_translation(order_id: str = Form(...), file: UploadFile = File(...)):
    """PM uploads a final external translation file for an order"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")

    # Store file in GridFS
    gridfs_id = await store_file_gridfs(
        file_bytes, file.filename, file.content_type,
        metadata={"order_id": order_id, "type": "pm_upload_translation"}
    )

    # Update order with PM upload info and set status to READY
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "translation_status": "pm_upload_ready",
            "pm_upload_file_id": gridfs_id,
            "pm_upload_filename": file.filename,
            "pm_upload_content_type": file.content_type,
            "pm_upload_file_size": len(file_bytes),
            "pm_uploaded_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }}
    )

    # Notify admin that PM uploaded a translation
    await email_service.send(
        ADMIN_EMAIL,
        f"Translation Uploaded (READY) — {order.get('order_number', '')}",
        email_service._base_template(f"""
            <h2 style="color:#38a169;">Translation Ready for Review</h2>
            <p>The PM has uploaded the final translation for order <strong>{order.get('order_number', '')}</strong>.</p>
            <div class="info-box">
                <p><strong>Customer:</strong> {order.get('customer_name', '')}</p>
                <p><strong>Languages:</strong> {order.get('source_language', '')} → {order.get('target_language', '')}</p>
                <p><strong>File:</strong> {file.filename}</p>
            </div>
            <p style="text-align:center;">
                <a href="https://tradux.online/admin" class="btn">Open Admin Dashboard</a>
            </p>
        """),
    )

    return {
        "status": "uploaded",
        "order_id": order_id,
        "filename": file.filename,
        "message": "Translation uploaded and marked as READY for admin",
    }


@api.post("/admin/accept-pm-upload")
async def accept_pm_upload(req: AdminActionRequest):
    """Admin accepts PM uploaded translation and sends to client — sets status to FINAL"""
    order = await db.orders.find_one({"id": req.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not order.get("pm_upload_file_id"):
        raise HTTPException(status_code=400, detail="No uploaded translation found")

    # Set status to FINAL regardless of current phase
    await db.orders.update_one(
        {"id": req.order_id},
        {"$set": {
            "translation_status": "final",
            "pm_approved": True,
            "client_approved": True,
            "completed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }}
    )

    # Send delivery email to client
    customer_email = order.get("customer_email")
    if customer_email:
        # Retrieve the uploaded file to attach
        try:
            file_bytes, filename, content_type = await retrieve_file_gridfs(order["pm_upload_file_id"])
            await email_service.send_with_attachments(
                customer_email,
                f"Your Certified Translation — {order.get('order_number', '')} | TRADUX",
                email_service.client_approved(order),
                [{"filename": order.get("pm_upload_filename", filename), "content": file_bytes}],
            )
        except Exception as e:
            logger.error(f"Failed to send translation with attachment: {e}")
            # Fallback: send without attachment
            await email_service.send(
                customer_email,
                f"Your Certified Translation — {order.get('order_number', '')} | TRADUX",
                email_service.client_approved(order),
            )

    return {"status": "final", "order_number": order.get("order_number"), "message": "Translation sent to client. Status set to FINAL."}


@api.get("/admin/orders/{order_id}/pm-translation-download")
async def download_pm_translation(order_id: str):
    """Download the PM uploaded translation file"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    file_id = order.get("pm_upload_file_id")
    if not file_id:
        raise HTTPException(status_code=404, detail="No uploaded translation found")

    file_bytes, filename, content_type = await retrieve_file_gridfs(file_id)
    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{order.get("pm_upload_filename", filename)}"'},
    )


# ---------------------------------------------------------------------------
# Client Review Endpoints
# ---------------------------------------------------------------------------

@api.get("/review/{order_id}")
async def get_review(order_id: str, token: str = Query(...)):
    """Client views their translation for review"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("review_token") != token:
        raise HTTPException(status_code=403, detail="Invalid review token")

    return {
        "order_number": order.get("order_number"),
        "customer_name": order.get("customer_name"),
        "source_language": order.get("source_language"),
        "target_language": order.get("target_language"),
        "document_type": order.get("document_type"),
        "service_tier": order.get("service_tier"),
        "cert_type": order.get("cert_type"),
        "translation_status": order.get("translation_status"),
        "proofread_text": order.get("proofread_text", ""),
        "original_text": order.get("original_text", ""),
    }


@api.post("/review/{order_id}")
async def submit_review(order_id: str, token: str = Query(...), review: TranslationReviewRequest = Body(...)):
    """Client approves or requests corrections"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("review_token") != token:
        raise HTTPException(status_code=403, detail="Invalid review token")

    if review.action == "approve":
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "translation_status": "approved",
                "client_approved": True,
                "approved_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }}
        )

        # Notify admin
        await email_service.send(
            ADMIN_EMAIL,
            f"Client Approved — {order.get('order_number', '')}",
            email_service._base_template(f"""
                <h2 style="color:#10b981;">Client Approved Translation ✓</h2>
                <p><strong>{order.get('customer_name', '')}</strong> approved their translation for order <strong>{order.get('order_number', '')}</strong>.</p>
                <p>You can now finalize and deliver the certified document.</p>
                <p style="text-align:center;"><a href="https://tradux.online/admin" class="btn">Open Admin</a></p>
            """),
        )

        return {"status": "approved", "message": "Thank you! Your translation has been approved."}

    elif review.action == "request_correction":
        notes = review.correction_notes or "No specific notes provided"
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "translation_status": "corrections",
                "correction_notes": notes,
                "client_approved": False,
                "updated_at": datetime.utcnow(),
            }}
        )

        # Notify client
        await email_service.send(
            order.get("customer_email", ""),
            f"Correction Request Received — {order.get('order_number', '')} | TRADUX",
            email_service.correction_requested(order, notes),
        )

        # Notify admin
        await email_service.send(
            ADMIN_EMAIL,
            f"Correction Requested — {order.get('order_number', '')}",
            email_service._base_template(f"""
                <h2 style="color:#f59e0b;">Client Requested Corrections</h2>
                <p><strong>{order.get('customer_name', '')}</strong> requested corrections for order <strong>{order.get('order_number', '')}</strong>.</p>
                <div class="info-box"><p><strong>Notes:</strong> {notes}</p></div>
                <p style="text-align:center;"><a href="https://tradux.online/admin" class="btn">Review & Correct</a></p>
            """),
        )

        return {"status": "correction_requested", "message": "Your correction request has been submitted. We'll update your translation shortly."}

    raise HTTPException(status_code=400, detail="Invalid action")


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@api.get("/admin/stats")
async def admin_stats():
    total = await db.orders.count_documents({})
    paid = await db.orders.count_documents({"payment_status": "paid"})
    completed = await db.orders.count_documents({"translation_status": {"$in": ["completed", "final"]}})
    in_progress = await db.orders.count_documents({"translation_status": {"$in": ["translating", "proofreading", "pm_review", "client_review", "pm_upload_ready"]}})
    pending_review = await db.orders.count_documents({"translation_status": "pm_review"})
    corrections = await db.orders.count_documents({"translation_status": "corrections"})

    # Revenue
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$total_price"}}},
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0

    return {
        "total_orders": total,
        "paid_orders": paid,
        "completed": completed,
        "in_progress": in_progress,
        "pending_pm_review": pending_review,
        "corrections_requested": corrections,
        "total_revenue": round(total_revenue, 2),
    }


# ---------------------------------------------------------------------------
# File download
# ---------------------------------------------------------------------------

@api.get("/documents/{doc_id}/download")
async def download_document(doc_id: str):
    """Download original uploaded document"""
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    gridfs_id = doc.get("gridfs_id")
    if not gridfs_id:
        raise HTTPException(status_code=404, detail="File not in storage")

    file_bytes, filename, content_type = await retrieve_file_gridfs(gridfs_id)
    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Mount router
# ---------------------------------------------------------------------------

app.include_router(api)


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"service": "TRADUX API", "version": "1.0.0", "docs": "/docs"}
