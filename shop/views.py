import json
import mimetypes
import secrets
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from django.conf import settings
from django.core import signing
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.mail import EmailMessage
from django.db import transaction, connection
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.contrib.auth.hashers import check_password, make_password

try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    REPORTLAB_AVAILABLE = True
except Exception:
    REPORTLAB_AVAILABLE = False

from .models import (
    Admin, Brand, Buyer, Contact, Coupon, CourierSettings, CourierZone, Location,
    Order, OrderItem, Product, ProductGroup, QA, Review, SaleBanner, Settings,
)

TOKEN_SALT = 'domextra-auth-v1'
TOKEN_MAX_AGE = 30 * 24 * 60 * 60


def uid(prefix):
    return f'{prefix}_{uuid.uuid4().hex}'


def dec(v, default=Decimal('0')):
    try:
        return Decimal(str(v))
    except Exception:
        return default


def money_round(v):
    return dec(v).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def iso(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        if timezone.is_naive(v):
            v = timezone.make_aware(v, timezone.get_current_timezone())
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return str(v)


def text(v, max_len=5000):
    return str(v or '').strip()[:max_len]


def json_body(request):
    try:
        raw = request.body.decode('utf-8')
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


def make_token(kind, subject):
    return signing.dumps({'kind': kind, 'sub': str(subject)}, salt=TOKEN_SALT)


def check_any_password(password, stored):
    stored = str(stored or '')
    if stored.startswith('scrypt$'):
        try:
            import hashlib
            _, salt_hex, hash_hex = stored.split('$', 2)
            calculated = hashlib.scrypt(str(password).encode(), salt=bytes.fromhex(salt_hex), n=16384, r=8, p=1, dklen=64)
            return secrets.compare_digest(calculated.hex(), hash_hex)
        except Exception:
            return False
    return check_password(password, stored)


def _decode_token(token):
    if not token:
        return None
    try:
        return signing.loads(token, salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE)
    except signing.BadSignature:
        return None


def auth(request, preferred_kind=None):
    # 1) Persistent signed Django session. This survives refreshes and does not
    # depend on localStorage.
    sess = getattr(request, 'session', None)
    if sess is not None:
        keys = []
        if preferred_kind:
            keys.append(f'domextra_auth_{preferred_kind}')
        keys.append('domextra_auth')
        for key in keys:
            session_auth = sess.get(key)
            if session_auth and (preferred_kind is None or session_auth.get('kind') == preferred_kind):
                return session_auth

    # 2) Bearer token. An expired/stale localStorage token must NOT block the
    # cookie/session fallback, otherwise a refresh can incorrectly show login.
    header = request.headers.get('Authorization', '')
    if header.startswith('Bearer '):
        decoded = _decode_token(header[7:])
        if decoded and (preferred_kind is None or decoded.get('kind') == preferred_kind):
            return decoded

    # 3) Persistent HttpOnly cookies are another fallback used after refresh.
    cookie_names = []
    if preferred_kind == 'admin':
        cookie_names = ['domextra_admin_token']
    elif preferred_kind == 'buyer':
        cookie_names = ['domextra_b2b_token']
    elif preferred_kind == 'shop':
        cookie_names = ['domextra_shop_token']
    else:
        cookie_names = ['domextra_admin_token', 'domextra_b2b_token', 'domextra_shop_token']

    for name in cookie_names:
        decoded = _decode_token(request.COOKIES.get(name))
        if decoded:
            if preferred_kind is None or decoded.get('kind') == preferred_kind:
                return decoded
    return None


def require_kind(request, kind):
    a = auth(request, preferred_kind=kind)
    if not a or a.get('kind') != kind:
        return None
    return a


def class_discount(c):
    return Decimal('25') if c == 'A' else Decimal('20') if c == 'B' else Decimal('15')




def ensure_shop_users_table():
    with connection.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shop_users (
                id VARCHAR(64) PRIMARY KEY,
                name VARCHAR(180) NOT NULL,
                email VARCHAR(180) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NULL,
                address VARCHAR(220) NULL,
                city VARCHAR(120) NULL,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)


def ensure_shop_wishlist_table():
    with connection.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shop_wishlist (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                product_id VARCHAR(64) NOT NULL,
                created_at DATETIME NOT NULL,
                UNIQUE KEY uq_shop_wishlist_user_product (user_id, product_id),
                KEY idx_shop_wishlist_user (user_id),
                KEY idx_shop_wishlist_product (product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)


def shop_history_payload(email):
    orders = Order.objects.filter(channel='SHOP').filter(customer__email__iexact=email).prefetch_related('items').order_by('-created_at')
    out = []
    for o in orders:
        out.append({
            'id': o.id, 'num': o.number, 'date': iso(o.created_at)[:10] if o.created_at else '',
            'pay': o.payment_method or '', 'ship': (o.shipping or {}).get('method', ''),
            'total': f'{float(o.total):,.2f} RSD'.replace(',', 'X').replace('.', ',').replace('X','.'),
            'status': o.status or 'Novo', 'invoiceNumber': o.invoice_number,
            'items': [{'productId': x.product_id, 'qty': float(x.qty), 'name': x.name, 'unitPrice': float(x.unit_price), 'lineTotal': float(x.line_total)} for x in o.items.all()],
            'orderId': o.id, 'pdfUrl': f'/api/orders/{o.id}/invoice.pdf'
        })
    return out


def wishlist_ids_for_user(user_id):
    ensure_shop_wishlist_table()
    with connection.cursor() as cursor:
        cursor.execute('SELECT product_id FROM shop_wishlist WHERE user_id=%s ORDER BY id DESC', [user_id])
        return [str(r[0]) for r in cursor.fetchall()]


def shop_user_public_row(row):
    return {
        'id': row[0], 'name': row[1], 'email': row[2], 'phone': row[4] or '',
        'address': row[5] or '', 'city': row[6] or '', 'active': bool(row[7]),
        'createdAt': row[8].isoformat() if row[8] else None,
        'updatedAt': row[9].isoformat() if row[9] else None,
        'history': [], 'wishlist': [], 'savedSearches': [],
    }


def public_product(p):
    return {
        'id': p.id, 'name': p.name, 'description': p.description or '',
        'group': p.group_id, 'sku': p.sku, 'barcode': p.barcode or '',
        'unit': p.unit, 'packQty': float(p.pack_qty), 'packName': p.pack_name,
        'vpPrice': float(p.vp_price), 'mpPrice': float(p.mp_price),
        'oldPrice': float(p.old_price), 'saleUntil': iso(p.sale_until),
        'brand': p.brand or '', 'isNew': bool(p.is_new), 'longDesc': p.long_desc or '',
        'gallery': p.gallery or [], 'specs': p.specs or [], 'stock': float(p.stock),
        'weightKg': float(p.weight_kg), 'actionDiscount': float(p.action_discount),
        'specialDiscount': float(p.special_discount), 'advanceDiscount': float(p.advance_discount),
        'logisticsDiscount': float(p.logistics_discount), 'rating': float(p.rating),
        'image': p.image or '', 'icon': p.icon or '📦',
        'createdAt': iso(p.created_at), 'updatedAt': iso(p.updated_at),
    }


def buyer_public(b):
    return {
        'id': b.id, 'company': b.company, 'email': b.email, 'address': b.address,
        'city': b.city, 'pib': b.pib, 'mb': b.mb, 'account': b.account,
        'class': b.class_name, 'paymentDays': b.payment_days,
        'specialDiscount': float(b.special_discount), 'username': b.username,
        'active': bool(b.active), 'createdAt': iso(b.created_at), 'updatedAt': iso(b.updated_at),
    }


def order_payload(order):
    items = []
    for i in order.items.all():
        items.append({
            'id': i.id, 'productId': i.product_id, 'sku': i.sku or '', 'name': i.name,
            'qty': float(i.qty), 'unit': i.unit or '', 'unitPrice': float(i.unit_price),
            'lineTotal': float(i.line_total), 'gross': float(i.gross), 'red': float(i.red),
            'pos': float(i.pos), 'ak': float(i.ak), 'av': float(i.av), 'log': float(i.log),
            'netUnit': float(i.net_unit), 'net': float(i.net),
        })
    return {
        'id': order.id, 'number': order.number, 'invoiceNumber': order.invoice_number,
        'channel': order.channel, 'buyerId': order.buyer_id, 'buyer': order.buyer_name,
        'createdAt': iso(order.created_at), 'status': order.status,
        'customer': order.customer or {}, 'items': items, 'subtotal': float(order.subtotal),
        'couponDiscount': float(order.coupon_discount), 'gross': float(order.gross),
        'shipping': order.shipping or {}, 'base': float(order.base), 'vat': float(order.vat),
        'total': float(order.total), 'paymentMethod': order.payment_method or '',
        'paymentDueDate': iso(order.payment_due_date), 'updatedAt': iso(order.updated_at), 'pdfUrl': f'/api/orders/{order.id}/invoice.pdf',
    }


def settings_payload(s):
    return {
        'firm': s.firm, 'address': s.address, 'city': s.city, 'pib': s.pib, 'mb': s.mb,
        'account': s.account, 'officialMail': s.official_mail, 'invoicePrefix': s.invoice_prefix,
        'paymentDays': s.payment_days, 'phone': s.phone, 'secondPhone': s.second_phone or '',
        'workingHours': s.working_hours or '',
    }


def sale_banner_payload(s):
    if not s:
        return {'active': False, 'title': '', 'text': '', 'cta': '', 'bg': '#0c0c0c'}
    return {'active': bool(s.active), 'title': s.title, 'text': s.text, 'cta': s.cta, 'bg': s.bg}


def courier_payload():
    s = CourierSettings.objects.first()
    return {
        'freeFrom': float(s.free_from) if s else 0,
        'defWeight': float(s.def_weight) if s else 1,
        'zones': [{'kg': float(z.kg), 'price': float(z.price)} for z in CourierZone.objects.all().order_by('kg')],
    }


def calc_courier(weight, amount):
    c = CourierSettings.objects.first()
    if c and c.free_from > 0 and amount >= c.free_from:
        return Decimal('0')
    zones = list(CourierZone.objects.all().order_by('kg'))
    for z in zones:
        if weight <= z.kg:
            return z.price
    return zones[-1].price if zones else Decimal('0')


def next_order_numbers(channel):
    s = Settings.objects.select_for_update().get(pk=1)
    seq = s.order_seq
    inv_seq = s.invoice_seq
    s.order_seq = seq + 1
    s.invoice_seq = inv_seq + 1
    s.save(update_fields=['order_seq', 'invoice_seq'])
    prefix = 'B2B' if channel == 'B2B' else 'WEB'
    invoice_prefix = s.invoice_prefix or 'DE'
    year = timezone.localdate().year
    return f'{prefix}-{seq:06d}', f'{invoice_prefix}-{year}-{inv_seq:06d}', s


def order_html(order, s):
    rows = ''.join(
        f'<tr><td>{i.name}<br><small>{i.sku or ""}</small></td><td>{i.qty}</td>'
        f'<td>{i.unit_price:.2f} RSD</td><td>{i.line_total:.2f} RSD</td></tr>'
        for i in order.items.all()
    )
    return (
        f'<div style="font-family:Arial,sans-serif;max-width:760px;margin:auto">'
        f'<h1>{s.firm}</h1><p>{s.address}, {s.city} · PIB {s.pib} · MB {s.mb}</p><hr>'
        f'<h2>Predračun {order.invoice_number}</h2><p>Porudžbina: <b>{order.number}</b>'
        f'<br>Datum: {timezone.localtime(order.created_at).strftime("%d.%m.%Y %H:%M")}</p>'
        f'<table style="width:100%;border-collapse:collapse"><tr><th align="left">Artikal</th>'
        f'<th>Količina</th><th>Cena</th><th>Ukupno</th></tr>{rows}</table><hr>'
        f'<p>Za uplatu: <b>{order.total:.2f} RSD</b></p>'
        f'<p>Isporuka: {(order.shipping or {}).get("method", "-")}<br>'
        f'Plaćanje: {order.payment_method or "-"}</p></div>'
    )


def _smtp_ready():
    return bool(getattr(settings, 'EMAIL_HOST', '') and getattr(settings, 'EMAIL_HOST_USER', '') and getattr(settings, 'EMAIL_HOST_PASSWORD', ''))

def _pdf_font_name():
    if not REPORTLAB_AVAILABLE:
        return 'Helvetica'
    candidates = [
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                pdfmetrics.registerFont(TTFont('DomExtraSans', path))
                return 'DomExtraSans'
            except Exception:
                pass
    return 'Helvetica'

def invoice_pdf_bytes(order):
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError('PDF biblioteka nije instalirana. Pokrenite pip install -r requirements.txt.')
    font = _pdf_font_name()
    from io import BytesIO
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=16*mm, leftMargin=16*mm, topMargin=16*mm, bottomMargin=16*mm, title=f'Predračun {order.invoice_number}')
    styles = getSampleStyleSheet()
    base = ParagraphStyle('Base', parent=styles['Normal'], fontName=font, fontSize=9.5, leading=13)
    small = ParagraphStyle('Small', parent=base, fontSize=8, leading=10)
    title = ParagraphStyle('TitleX', parent=base, fontSize=18, leading=21, spaceAfter=6)
    story=[]
    s=Settings.objects.get(pk=1)
    story.append(Paragraph(str(s.firm), title))
    story.append(Paragraph(f'{s.address}, {s.city}<br/>PIB: {s.pib} · MB: {s.mb}<br/>Tekući račun: {s.account}<br/>E-mail: {s.official_mail}', base))
    story.append(Spacer(1,8))
    story.append(Paragraph(f'<b>PREDRAČUN</b> — {order.invoice_number}', title))
    story.append(Paragraph(f'Porudžbina: {order.number}<br/>Datum: {timezone.localtime(order.created_at).strftime("%d.%m.%Y %H:%M")}', base))
    cust=order.customer or {}
    customer_name=cust.get('company') or cust.get('name') or order.buyer_name or 'Kupac'
    customer_addr=cust.get('address','')
    customer_city=cust.get('city','')
    customer_email=cust.get('email','')
    story.append(Spacer(1,8))
    story.append(Paragraph(f'<b>Kupac:</b> {customer_name}<br/>{customer_addr}, {customer_city}<br/>{customer_email}', base))
    data=[[Paragraph('<b>Artikal</b>',small),Paragraph('<b>Količina</b>',small),Paragraph('<b>Cena</b>',small),Paragraph('<b>Ukupno</b>',small)]]
    for item in order.items.all():
        data.append([Paragraph(f'{item.name}<br/><font size="7">{item.sku or ""}</font>',small), str(item.qty), f'{item.unit_price:.2f} RSD', f'{item.line_total:.2f} RSD'])
    table=Table(data,colWidths=[90*mm,25*mm,32*mm,33*mm],repeatRows=1)
    table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.4,colors.HexColor('#dddddd')),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#f2f4f7')),('VALIGN',(0,0),(-1,-1),'TOP'),('FONTNAME',(0,0),(-1,-1),font),('FONTSIZE',(0,0),(-1,-1),8.5),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story.append(Spacer(1,8)); story.append(table); story.append(Spacer(1,10))
    story.append(Paragraph(f'Osnovica: {order.base:.2f} RSD',base))
    story.append(Paragraph(f'PDV 20%: {order.vat:.2f} RSD',base))
    story.append(Paragraph(f'<b>Za uplatu: {order.total:.2f} RSD</b>',ParagraphStyle('Total',parent=base,fontSize=12,leading=15,spaceBefore=5)))
    ship=(order.shipping or {}).get('method','-')
    story.append(Spacer(1,8)); story.append(Paragraph(f'Isporuka: {ship}<br/>Plaćanje: {order.payment_method or "-"}<br/><br/>Predračun nije fiskalni račun.',small))
    doc.build(story)
    return buf.getvalue()

def send_order_email(order, recipients):
    recipients=[x for x in (recipients or []) if x]
    if not recipients:
        return False, 'Nema e-mail adrese.'
    if not _smtp_ready():
        return False, 'SMTP nije podešen u .env fajlu.'
    pdf=invoice_pdf_bytes(order)
    email=EmailMessage(subject=f'{order.invoice_number} — DOM EXTRA', body=f'Poštovani, u prilogu je predračun {order.invoice_number}.', from_email=settings.DEFAULT_FROM_EMAIL, to=recipients)
    email.attach(f'{order.invoice_number}.pdf', pdf, 'application/pdf')
    email.send(fail_silently=False)
    return True, None

def send_mail_demo(subject, to):
    print(f'[MAIL DEMO] {subject} -> {to or "n/a"}')


def model_payload_list(queryset, fn):
    return [fn(x) for x in queryset]


@csrf_exempt
def api_dispatch(request, subpath=''):
    path = '/' + subpath.strip('/')
    method = request.method
    try:
        if method == 'GET' and path == '/health':
            return JsonResponse({'ok': True, 'time': timezone.now().isoformat()})

        if method == 'GET' and path == '/public':
            s = Settings.objects.get(pk=1)
            groups = list(ProductGroup.objects.order_by('name').values_list('name', flat=True))
            brands = [{'id': b.id, 'name': b.name, 'category': b.category or '', 'active': bool(b.active)} for b in Brand.objects.filter(active=True).order_by('name')]
            products = [public_product(p) for p in Product.objects.select_related('group').all()]
            banner = sale_banner_payload(SaleBanner.objects.first())
            locations = [dict(id=x.id, name=x.name, phone=x.phone or '', address=x.address, hours=x.hours or '', lat=float(x.lat) if x.lat is not None else None, lng=float(x.lng) if x.lng is not None else None) for x in Location.objects.all()]
            reviews = [dict(id=x.id, productId=x.product_id, buyer=x.buyer, rating=float(x.rating), comment=x.comment, date=iso(x.date), verified=bool(x.verified)) for x in Review.objects.all()]
            qa = [dict(id=x.id, productId=x.product_id, question=x.question, answer=x.answer, date=iso(x.date)) for x in QA.objects.all()]
            return JsonResponse({'settings': settings_payload(s), 'groups': groups, 'brands': brands, 'products': products, 'courier': courier_payload(), 'saleBanner': banner, 'locations': locations, 'reviews': reviews, 'qa': qa})

        if method == 'GET' and path == '/products':
            qs = Product.objects.select_related('group').all()
            q = text(request.GET.get('q')).lower()
            g = text(request.GET.get('group'))
            b = text(request.GET.get('brand'))
            if q:
                qs = [p for p in qs if q in ' '.join([p.name, p.sku, p.barcode or '', p.description or '', p.brand or '']).lower()]
            if g:
                qs = [p for p in qs if p.group_id == g]
            if b:
                qs = [p for p in qs if p.brand == b]
            return JsonResponse([public_product(p) for p in qs], safe=False)

        if method == 'GET' and path.startswith('/products/'):
            pid = path.rsplit('/', 1)[-1]
            try:
                return JsonResponse(public_product(Product.objects.select_related('group').get(pk=pid)))
            except Product.DoesNotExist:
                return JsonResponse({'error': 'Artikal nije pronađen.'}, status=404)

        if method == 'GET' and path == '/coupons/validate':
            code = text(request.GET.get('code')).upper()
            amount = dec(request.GET.get('amount'))
            try:
                c = Coupon.objects.get(code=code)
            except Coupon.DoesNotExist:
                return JsonResponse({'valid': False, 'error': 'Promo kod ne postoji.'}, status=404)
            today = timezone.localdate()
            if c.valid_until and c.valid_until < today:
                return JsonResponse({'valid': False, 'error': 'Promo kod je istekao.'}, status=400)
            if c.max_uses and c.used >= c.max_uses:
                return JsonResponse({'valid': False, 'error': 'Promo kod je iskorišćen u maksimalnom broju slučajeva.'}, status=400)
            if amount < c.min_amount:
                return JsonResponse({'valid': False, 'error': f'Minimalna vrednost porudžbine je {c.min_amount:.2f} RSD.'}, status=400)
            discount = money_round(amount * c.value / Decimal('100')) if c.type == '%' else min(amount, c.value)
            return JsonResponse({'valid': True, 'coupon': {'id': c.id, 'code': c.code, 'description': c.description or '', 'type': c.type, 'value': float(c.value), 'minAmount': float(c.min_amount), 'maxUses': c.max_uses, 'used': c.used, 'validUntil': iso(c.valid_until)}, 'discount': float(discount)})

        if method == 'POST' and path == '/contact':
            b = json_body(request)
            name, email, message = text(b.get('name'), 120), text(b.get('email'), 180), text(b.get('message'), 5000)
            if not name or not email or not message:
                return JsonResponse({'error': 'Ime, email i poruka su obavezni.'}, status=400)
            c = Contact.objects.create(id=uid('contact'), name=name, email=email, phone=text(b.get('phone'), 50), topic=text(b.get('topic'), 120), message=message, created_at=timezone.now())
            return JsonResponse({'ok': True, 'contact': {'id': c.id, 'name': c.name, 'email': c.email, 'phone': c.phone or '', 'topic': c.topic or '', 'message': c.message, 'createdAt': iso(c.created_at)}} , status=201)

        if method == 'POST' and path == '/auth/shop/register':
            ensure_shop_users_table()
            b = json_body(request)
            name = text(b.get('name'), 180)
            email = text(b.get('email'), 180).lower()
            password = text(b.get('password'), 255)
            phone = text(b.get('phone'), 50)
            address = text(b.get('address'), 220)
            city = text(b.get('city'), 120)
            if not name or not email or not password:
                return JsonResponse({'error': 'Ime, e-mail i lozinka su obavezni.'}, status=400)
            if '@' not in email or '.' not in email.split('@')[-1]:
                return JsonResponse({'error': 'Unesite ispravan e-mail.'}, status=400)
            if len(password) < 6:
                return JsonResponse({'error': 'Lozinka mora imati najmanje 6 karaktera.'}, status=400)
            with connection.cursor() as cursor:
                cursor.execute('SELECT id FROM shop_users WHERE LOWER(email)=LOWER(%s) LIMIT 1', [email])
                if cursor.fetchone():
                    return JsonResponse({'error': 'Nalog sa ovim e-mailom već postoji.'}, status=409)
                sid = uid('shop')
                now = timezone.now().replace(tzinfo=None)
                cursor.execute(
                    'INSERT INTO shop_users (id,name,email,password_hash,phone,address,city,active,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,1,%s,%s)',
                    [sid, name, email, make_password(password), phone, address, city, now, now]
                )
            token = make_token('shop', sid)
            request.session['domextra_auth'] = {'kind': 'shop', 'sub': sid}
            request.session['domextra_auth_shop'] = {'kind': 'shop', 'sub': sid}
            request.session.modified = True
            ensure_shop_wishlist_table()
            response = JsonResponse({'token': token, 'user': {'id': sid, 'name': name, 'email': email, 'phone': phone, 'address': address, 'city': city, 'history': [], 'wishlist': [], 'savedSearches': []}}, status=201)
            response.set_cookie('domextra_shop_token', token, max_age=TOKEN_MAX_AGE, httponly=True, samesite='Lax', path='/')
            return response

        if method == 'POST' and path == '/auth/shop/login':
            ensure_shop_users_table()
            b = json_body(request)
            email = text(b.get('email'), 180).lower()
            password = text(b.get('password'), 255)
            with connection.cursor() as cursor:
                cursor.execute('SELECT id,name,email,password_hash,phone,address,city,active,created_at,updated_at FROM shop_users WHERE LOWER(email)=LOWER(%s) LIMIT 1', [email])
                row = cursor.fetchone()
            if not row or not bool(row[7]) or not check_any_password(password, row[3]):
                return JsonResponse({'error': 'Pogrešan e-mail ili lozinka.'}, status=401)
            token = make_token('shop', row[0])
            request.session['domextra_auth'] = {'kind': 'shop', 'sub': row[0]}
            request.session['domextra_auth_shop'] = {'kind': 'shop', 'sub': row[0]}
            request.session.modified = True
            ensure_shop_wishlist_table()
            user_payload = shop_user_public_row(row)
            user_payload['history'] = shop_history_payload(row[2])
            user_payload['wishlist'] = wishlist_ids_for_user(row[0])
            user_payload['savedSearches'] = []
            response = JsonResponse({'token': token, 'user': user_payload})
            response.set_cookie('domextra_shop_token', token, max_age=TOKEN_MAX_AGE, httponly=True, samesite='Lax', path='/')
            return response

        if method == 'POST' and path == '/auth/shop/logout':
            response = JsonResponse({'ok': True})
            request.session.pop('domextra_auth_shop', None)
            request.session.pop('domextra_auth', None)
            request.session.modified = True
            response.delete_cookie('domextra_shop_token', path='/')
            return response

        if method == 'GET' and path == '/auth/admin/me':
            a = require_kind(request, 'admin')
            if not a:
                return JsonResponse({'error': 'Niste prijavljeni.'}, status=401)
            try:
                u = Admin.objects.get(pk=a['sub'])
            except Admin.DoesNotExist:
                return JsonResponse({'error': 'Administrator ne postoji.'}, status=401)
            return JsonResponse({'kind': 'admin', 'user': {'id': u.id, 'username': u.username, 'role': u.role}})

        if method == 'GET' and path == '/auth/shop/me':
            a = require_kind(request, 'shop')
            if not a:
                return JsonResponse({'error': 'Niste prijavljeni.'}, status=401)
            ensure_shop_users_table()
            with connection.cursor() as cursor:
                cursor.execute('SELECT id,name,email,password_hash,phone,address,city,active,created_at,updated_at FROM shop_users WHERE id=%s LIMIT 1', [a['sub']])
                row = cursor.fetchone()
            if not row or not bool(row[7]):
                return JsonResponse({'error': 'Korisnik ne postoji.'}, status=401)
            ensure_shop_wishlist_table()
            user_payload = shop_user_public_row(row)
            user_payload['history'] = shop_history_payload(row[2])
            user_payload['wishlist'] = wishlist_ids_for_user(row[0])
            user_payload['savedSearches'] = []
            return JsonResponse({'user': user_payload})

        if method == 'GET' and path == '/wishlist':
            a = require_kind(request, 'shop')
            if not a:
                return JsonResponse({'error': 'Niste prijavljeni.'}, status=401)
            return JsonResponse({'items': wishlist_ids_for_user(a['sub'])})

        if method == 'POST' and path == '/wishlist':
            a = require_kind(request, 'shop')
            if not a:
                return JsonResponse({'error': 'Niste prijavljeni.'}, status=401)
            ensure_shop_wishlist_table()
            pid = text(json_body(request).get('productId'), 64)
            if not pid or not Product.objects.filter(pk=pid).exists():
                return JsonResponse({'error': 'Artikal nije pronađen.'}, status=404)
            with connection.cursor() as cursor:
                cursor.execute('INSERT IGNORE INTO shop_wishlist (user_id, product_id, created_at) VALUES (%s,%s,%s)', [a['sub'], pid, timezone.now().replace(tzinfo=None)])
            return JsonResponse({'ok': True, 'items': wishlist_ids_for_user(a['sub'])})

        if method == 'DELETE' and path.startswith('/wishlist/'):
            a = require_kind(request, 'shop')
            if not a:
                return JsonResponse({'error': 'Niste prijavljeni.'}, status=401)
            ensure_shop_wishlist_table()
            pid = text(path.rsplit('/',1)[-1], 64)
            with connection.cursor() as cursor:
                cursor.execute('DELETE FROM shop_wishlist WHERE user_id=%s AND product_id=%s', [a['sub'], pid])
            return JsonResponse({'ok': True, 'items': wishlist_ids_for_user(a['sub'])})

        if method == 'GET' and path == '/shop/orders':
            a = require_kind(request, 'shop')
            if not a:
                return JsonResponse({'error': 'Niste prijavljeni.'}, status=401)
            with connection.cursor() as cursor:
                cursor.execute('SELECT email FROM shop_users WHERE id=%s LIMIT 1', [a['sub']])
                row = cursor.fetchone()
            if not row:
                return JsonResponse({'error': 'Korisnik ne postoji.'}, status=401)
            return JsonResponse(shop_history_payload(row[0]), safe=False)

        if method == 'POST' and path == '/auth/admin/login':
            b = json_body(request)
            try:
                a = Admin.objects.get(username=text(b.get('username')))
            except Admin.DoesNotExist:
                a = None
            if not a or not check_any_password(text(b.get('password')), a.password_hash):
                return JsonResponse({'error': 'Pogrešno korisničko ime ili lozinka.'}, status=401)
            token = make_token('admin', a.id)
            response = JsonResponse({'token': token, 'user': {'id': a.id, 'username': a.username, 'role': a.role}})
            request.session['domextra_auth'] = {'kind': 'admin', 'sub': str(a.id)}
            request.session['domextra_auth_admin'] = {'kind': 'admin', 'sub': str(a.id)}
            request.session.modified = True
            response.set_cookie('domextra_admin_token', token, max_age=TOKEN_MAX_AGE, httponly=True, samesite='Lax', path='/')
            return response

        if method == 'POST' and path == '/auth/admin/logout':
            response = JsonResponse({'ok': True})
            request.session.pop('domextra_auth_admin', None)
            request.session.pop('domextra_auth', None)
            request.session.modified = True
            response.delete_cookie('domextra_admin_token', path='/')
            return response

        if method == 'POST' and path == '/auth/b2b/login':
            b = json_body(request)
            try:
                u = Buyer.objects.get(username=text(b.get('username')), active=True)
            except Buyer.DoesNotExist:
                u = None
            if not u or not check_any_password(text(b.get('password')), u.password_hash):
                return JsonResponse({'error': 'Pogrešno korisničko ime ili lozinka.'}, status=401)
            token = make_token('buyer', u.id)
            response = JsonResponse({'token': token, 'buyer': buyer_public(u)})
            request.session['domextra_auth'] = {'kind': 'buyer', 'sub': str(u.id)}
            request.session['domextra_auth_buyer'] = {'kind': 'buyer', 'sub': str(u.id)}
            request.session.modified = True
            response.set_cookie('domextra_b2b_token', token, max_age=TOKEN_MAX_AGE, httponly=True, samesite='Lax', path='/')
            return response

        if method == 'POST' and path == '/auth/b2b/logout':
            response = JsonResponse({'ok': True})
            request.session.pop('domextra_auth_buyer', None)
            request.session.pop('domextra_auth', None)
            request.session.modified = True
            response.delete_cookie('domextra_b2b_token', path='/')
            return response

        if method == 'GET' and path == '/auth/me':
            a = auth(request)
            if not a:
                return JsonResponse({'error': 'Niste prijavljeni.'}, status=401)
            if a.get('kind') == 'admin':
                try:
                    u = Admin.objects.get(pk=a['sub'])
                except Admin.DoesNotExist:
                    return JsonResponse({'error': 'Korisnik ne postoji.'}, status=401)
                return JsonResponse({'kind': 'admin', 'user': {'id': u.id, 'username': u.username, 'role': u.role}})
            try:
                u = Buyer.objects.get(pk=a['sub'])
            except Buyer.DoesNotExist:
                return JsonResponse({'error': 'Korisnik ne postoji.'}, status=401)
            return JsonResponse({'kind': 'buyer', 'buyer': buyer_public(u)})

        if method == 'GET' and path == '/b2b/products':
            if not require_kind(request, 'buyer'):
                return JsonResponse({'error': 'Niste prijavljeni kao B2B kupac.'}, status=401)
            return JsonResponse([public_product(p) for p in Product.objects.select_related('group').all()], safe=False)

        if method == 'GET' and path == '/b2b/orders':
            a = require_kind(request, 'buyer')
            if not a:
                return JsonResponse({'error': 'Niste prijavljeni kao B2B kupac.'}, status=401)
            return JsonResponse([order_payload(o) for o in Order.objects.filter(channel='B2B', buyer_id=a['sub']).prefetch_related('items')], safe=False)

        if method == 'POST' and path in ('/orders/shop', '/orders/b2b'):
            is_b2b = path == '/orders/b2b'
            if is_b2b:
                a = require_kind(request, 'buyer')
                if not a:
                    return JsonResponse({'error': 'Niste prijavljeni kao B2B kupac.'}, status=401)
            b = json_body(request)
            if not isinstance(b.get('items'), list) or not b['items']:
                return JsonResponse({'error': 'Nema stavki.' if is_b2b else 'Korpa je prazna.'}, status=400)
            buyer = Buyer.objects.get(pk=a['sub']) if is_b2b else None
            customer = b.get('customer') or {}
            if not is_b2b and (not text(customer.get('name')) or not text(customer.get('email')) or not text(customer.get('address'))):
                return JsonResponse({'error': 'Podaci kupca nisu kompletni.'}, status=400)

            with transaction.atomic():
                # Lock settings and products so stock/invoice counters remain consistent.
                settings_obj = Settings.objects.select_for_update().get(pk=1)
                items_payload = []
                subtotal = Decimal('0')
                gross = Decimal('0')
                net = Decimal('0')
                weight = Decimal('0')
                product_ids = [str(it.get('productId')) for it in b['items']]
                products = {p.id: p for p in Product.objects.select_for_update().select_related('group').filter(id__in=product_ids)}
                courier_default = CourierSettings.objects.first()
                default_weight = courier_default.def_weight if courier_default else Decimal('1')
                for it in b['items']:
                    pid = str(it.get('productId'))
                    product = products.get(pid)
                    qty = max(Decimal('1'), dec(it.get('qty')))
                    if not product:
                        return JsonResponse({'error': 'Artikal nije pronađen.'}, status=400)
                    if product.stock < qty:
                        return JsonResponse({
                            'error': f'Nema dovoljno artikla na stanju: {product.name}. Traženo: {qty:g} {product.unit or "kom"}, dostupno: {product.stock:g} {product.unit or "kom"}.'
                        }, status=400)
                    if is_b2b:
                        unit = product.vp_price
                        discounts = [class_discount(buyer.class_name), product.special_discount or buyer.special_discount, product.action_discount, product.advance_discount if b.get('avans') else Decimal('0'), product.logistics_discount if (b.get('shippingMethod') != 'licno') else Decimal('0')]
                        for d in discounts:
                            unit *= (Decimal('1') - dec(d) / Decimal('100'))
                        line = money_round(unit * qty)
                        gross_line = money_round(product.vp_price * qty)
                        items_payload.append({'productId': product.id, 'sku': product.sku, 'name': product.name, 'qty': qty, 'unit': product.unit, 'gross': gross_line, 'red': discounts[0], 'pos': discounts[1], 'ak': discounts[2], 'av': discounts[3], 'log': discounts[4], 'netUnit': money_round(unit), 'net': line})
                        gross += gross_line
                        net += line
                    else:
                        # Web Shop: MP cena + aktivni akcijski rabat proizvoda.
                        # Akcijski rabat je serverski obračunat da se cena ne može
                        # zaobići izmenom JavaScript-a u browseru.
                        shop_unit = product.mp_price
                        action_discount = dec(product.action_discount)
                        if action_discount > 0 and product.sale_until:
                            try:
                                sale_until = product.sale_until
                                if timezone.is_naive(sale_until):
                                    sale_until = timezone.make_aware(sale_until)
                                if sale_until < timezone.now():
                                    action_discount = Decimal('0')
                            except Exception:
                                pass
                        if action_discount > 0:
                            shop_unit *= (Decimal('1') - action_discount / Decimal('100'))
                        shop_unit = money_round(shop_unit)
                        line = money_round(shop_unit * qty)
                        items_payload.append({'productId': product.id, 'sku': product.sku, 'name': product.name, 'qty': qty, 'unitPrice': shop_unit, 'lineTotal': line, 'ak': action_discount})
                        subtotal += line
                    weight += (product.weight_kg or default_weight) * qty

                discount = Decimal('0')
                coupon = None
                if not is_b2b and b.get('couponCode'):
                    coupon_code = text(b.get('couponCode')).upper()
                    try:
                        coupon = Coupon.objects.select_for_update().get(code=coupon_code)
                    except Coupon.DoesNotExist:
                        return JsonResponse({'error': 'Promo kod ne postoji.'}, status=400)
                    today = timezone.localdate()
                    if coupon.valid_until and coupon.valid_until < today:
                        return JsonResponse({'error': 'Promo kod je istekao.'}, status=400)
                    if coupon.max_uses and coupon.used >= coupon.max_uses:
                        return JsonResponse({'error': 'Promo kod je iskorišćen u maksimalnom broju slučajeva.'}, status=400)
                    if subtotal < coupon.min_amount:
                        return JsonResponse({'error': f'Minimalna vrednost porudžbine za ovaj kupon je {coupon.min_amount:.2f} RSD.'}, status=400)
                    discount = money_round(subtotal * coupon.value / Decimal('100')) if coupon.type == '%' else min(subtotal, coupon.value)

                if is_b2b:
                    ship_method = text(b.get('shippingMethod')) or 'dostava'
                    shipping_cost = calc_courier(weight, net) if ship_method in ('kurir', 'dostava') else Decimal('0')
                    base = money_round(net + shipping_cost)
                else:
                    ship_method = text(b.get('shippingMethod')) or 'lično'
                    shipping_cost = calc_courier(weight, max(Decimal('0'), subtotal - discount)) if ship_method in ('kurir', 'dostava') else Decimal('0')
                    base = money_round(subtotal - discount + shipping_cost)
                vat = money_round(base * Decimal('0.20'))
                total = money_round(base + vat)
                seq = settings_obj.order_seq
                inv_seq = settings_obj.invoice_seq
                settings_obj.order_seq += 1
                settings_obj.invoice_seq += 1
                settings_obj.save(update_fields=['order_seq', 'invoice_seq'])
                channel = 'B2B' if is_b2b else 'SHOP'
                number = f"{channel if is_b2b else 'WEB'}-{seq:06d}"
                invoice = f"{settings_obj.invoice_prefix or 'DE'}-{timezone.localdate().year}-{inv_seq:06d}"
                due = timezone.localdate() + timedelta(days=(settings_obj.payment_days if b.get('avans') else (buyer.payment_days if buyer else 0))) if is_b2b else None
                order = Order.objects.create(id=uid('ord'), number=number, invoice_number=invoice, channel=channel, buyer=buyer,
                    buyer_name=buyer.company if buyer else None, created_at=timezone.now(), status='Novo', customer=(buyer_public(buyer) if buyer else customer),
                    subtotal=(net if is_b2b else subtotal), coupon_discount=(Decimal('0') if is_b2b else discount), gross=gross,
                    shipping={'method': ship_method, 'cost': float(shipping_cost), 'weightKg': float(money_round(weight))}, base=base, vat=vat,
                    total=total, payment_method=('avans' if b.get('avans') else 'po dogovoru') if is_b2b else (text(b.get('paymentMethod')) or 'pouzećem'), payment_due_date=due)
                for x in items_payload:
                    p = products[x['productId']]
                    p.stock -= x['qty']
                    p.save(update_fields=['stock'])
                    if is_b2b:
                        OrderItem.objects.create(order=order, product_id=p.id, sku=p.sku, name=p.name, qty=x['qty'], unit=x['unit'], gross=x['gross'], red=x['red'], pos=x['pos'], ak=x['ak'], av=x['av'], log=x['log'], net_unit=x['netUnit'], net=x['net'], unit_price=x['netUnit'], line_total=x['net'])
                    else:
                        OrderItem.objects.create(order=order, product_id=p.id, sku=p.sku, name=p.name, qty=x['qty'], unit=p.unit, unit_price=x['unitPrice'], line_total=x['lineTotal'], ak=x.get('ak', Decimal('0')), net_unit=x['unitPrice'], net=x['lineTotal'])
                if coupon:
                    coupon.used += 1
                    coupon.save(update_fields=['used'])
                # Reload items for document generation and optionally send e-mail automatically.
                order.refresh_from_db()
                order_html_value = order_html(order, settings_obj)
                recipients=[settings_obj.official_mail]
                if is_b2b:
                    if buyer and buyer.email: recipients.append(buyer.email)
                elif customer.get('email'):
                    recipients.append(text(customer.get('email')))
                email_sent=False; email_error=None
                try:
                    email_sent, email_error = send_order_email(order, recipients)
                except Exception as exc:
                    email_error=str(exc)
                payload=order_payload(order)
                payload['couponCode'] = coupon.code if coupon else ''
                payload['couponUsed'] = coupon.used if coupon else None
                payload['emailSent']=email_sent; payload['emailError']=email_error
                return JsonResponse({'ok': True, 'order': payload, 'html': order_html_value}, status=201)

        if method == 'GET' and path.startswith('/orders/') and path.endswith('/invoice.pdf'):
            oid=path.split('/')[2]
            try:
                order=Order.objects.get(pk=oid)
            except Order.DoesNotExist:
                return JsonResponse({'error':'Porudžbina nije pronađena.'}, status=404)

            # Dokument porudžbine može da vidi samo administrator ili vlasnik
            # konkretne porudžbine. Ovo važi i kada se dokument otvori u novom tabu.
            a = auth(request)
            allowed = False
            if a:
                if a.get('kind') == 'admin':
                    allowed = True
                elif a.get('kind') == 'buyer' and order.channel == 'B2B' and str(order.buyer_id) == str(a.get('sub')):
                    allowed = True
                elif a.get('kind') == 'shop' and order.channel == 'SHOP':
                    try:
                        with connection.cursor() as cursor:
                            cursor.execute('SELECT email FROM shop_users WHERE id=%s LIMIT 1', [a.get('sub')])
                            user_row = cursor.fetchone()
                        owner_email = (user_row[0] if user_row else '') or ''
                        order_email = ((order.customer or {}).get('email') or '').strip()
                        allowed = bool(owner_email and order_email and owner_email.lower() == order_email.lower())
                    except Exception:
                        allowed = False
            if not allowed:
                return JsonResponse({'error':'Nemate pristup dokumentu ove porudžbine.'}, status=403)

            try:
                pdf=invoice_pdf_bytes(order)
            except Exception as exc:
                return JsonResponse({'error':str(exc)}, status=500)
            resp=HttpResponse(pdf, content_type='application/pdf')
            inline = str(request.GET.get('view', '')).lower() in {'1','true','yes'}
            disposition = 'inline' if inline else 'attachment'
            resp['Content-Disposition']=f'{disposition}; filename="{order.invoice_number}.pdf"'
            return resp

        if method == 'POST' and path.startswith('/orders/') and path.endswith('/send-email'):
            oid=path.split('/')[2]
            try:
                order=Order.objects.get(pk=oid)
            except Order.DoesNotExist:
                return JsonResponse({'error':'Porudžbina nije pronađena.'}, status=404)

            a = auth(request)
            allowed = False
            if a:
                if a.get('kind') == 'admin':
                    allowed = True
                elif a.get('kind') == 'buyer' and order.channel == 'B2B' and str(order.buyer_id) == str(a.get('sub')):
                    allowed = True
                elif a.get('kind') == 'shop' and order.channel == 'SHOP':
                    with connection.cursor() as cursor:
                        cursor.execute('SELECT email FROM shop_users WHERE id=%s LIMIT 1', [a.get('sub')])
                        user_row = cursor.fetchone()
                    owner_email = (user_row[0] if user_row else '') or ''
                    order_email = ((order.customer or {}).get('email') or '').strip()
                    allowed = bool(owner_email and order_email and owner_email.lower() == order_email.lower())
            if not allowed:
                return JsonResponse({'error':'Nemate pristup ovoj porudžbini.'}, status=403)

            b=json_body(request); recipients=b.get('recipients') or []
            if isinstance(recipients,str): recipients=[x.strip() for x in recipients.split(',') if x.strip()]
            if not recipients:
                s=Settings.objects.get(pk=1); recipients=[s.official_mail]
                if order.channel=='SHOP' and (order.customer or {}).get('email'): recipients.append(order.customer.get('email'))
                if order.channel=='B2B' and order.buyer and order.buyer.email: recipients.append(order.buyer.email)
            try:
                sent,err=send_order_email(order,recipients)
            except Exception as exc:
                return JsonResponse({'ok':False,'error':str(exc)}, status=500)
            if not sent: return JsonResponse({'ok':False,'error':err}, status=503)
            return JsonResponse({'ok':True,'sentTo':recipients})

        # Admin API
        admin_auth = require_kind(request, 'admin')
        if method == 'GET' and path.startswith('/admin/') and not admin_auth:
            return JsonResponse({'error': 'Niste prijavljeni kao administrator.'}, status=401)
        if method in {'POST', 'PATCH', 'PUT', 'DELETE'} and path.startswith('/admin/') and not admin_auth:
            return JsonResponse({'error': 'Niste prijavljeni kao administrator.'}, status=401)

        if method == 'POST' and path == '/admin/product-image':
            f = request.FILES.get('file')
            if not f:
                return JsonResponse({'error': 'Nije poslata slika.'}, status=400)
            allowed = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}
            ext = allowed.get(f.content_type)
            if not ext:
                return JsonResponse({'error': 'Dozvoljene su JPG, PNG, WEBP ili GIF slike.'}, status=400)
            if f.size > 10 * 1024 * 1024:
                return JsonResponse({'error': 'Slika može imati najviše 10 MB.'}, status=400)
            name = f'products/{uuid.uuid4().hex}.{ext}'
            saved = default_storage.save(name, ContentFile(f.read()))
            return JsonResponse({'ok': True, 'url': f'{settings.MEDIA_URL}{saved}'}, status=201)

        if method == 'GET' and path == '/admin/dashboard':
            orders = list(Order.objects.all())
            active_status = {'Plaćeno', 'Realizovano', 'Stornirano'}
            revenue = sum((o.total for o in orders if o.status != 'Stornirano'), Decimal('0'))
            unpaid = sum((o.total for o in orders if o.status not in active_status), Decimal('0'))
            today = timezone.localdate()
            overdue = sum(1 for o in orders if o.payment_due_date and o.payment_due_date < today and o.status not in active_status)
            return JsonResponse({'buyers': Buyer.objects.count(), 'products': Product.objects.count(), 'orders': len(orders), 'revenue': float(revenue), 'unpaid': float(unpaid), 'overdue': overdue, 'lowStock': Product.objects.filter(stock__lte=10).count()})

        if method == 'GET' and path == '/admin/buyers':
            return JsonResponse([buyer_public(b) for b in Buyer.objects.all()], safe=False)

        if method == 'GET' and path == '/admin/bootstrap':
            # Single reliable admin bootstrap used after login and browser refresh.
            # It keeps the dashboard in sync even when one secondary admin request fails.
            buyers_payload = [buyer_public(b) for b in Buyer.objects.all()]
            products_payload = [public_product(p) for p in Product.objects.select_related('group').all()]
            orders_payload = [order_payload(o) for o in Order.objects.prefetch_related('items').all()]
            coupons_payload = [{'id':c.id,'code':c.code,'description':c.description or '', 'type':c.type,
                                'value':float(c.value),'minAmount':float(c.min_amount),'maxUses':c.max_uses,
                                'used':c.used,'validUntil':iso(c.valid_until)} for c in Coupon.objects.all()]
            return JsonResponse({
                'buyers': buyers_payload,
                'products': products_payload,
                'orders': orders_payload,
                'coupons': coupons_payload,
            })

        if method == 'POST' and path == '/admin/buyers':
            b = json_body(request)
            company = text(b.get('company'), 180)
            email = text(b.get('email'), 180)
            if not company or not email:
                return JsonResponse({'error': 'Naziv firme i email su obavezni.'}, status=400)
            username = text(b.get('username')) or company.lower().replace(' ', '.')
            base = username
            n = 2
            while Buyer.objects.filter(username=username).exists():
                username = f'{base}.{n:02d}'
                n += 1
            password = text(b.get('password')) or secrets.token_hex(4)
            buyer = Buyer.objects.create(id=uid('buyer'), company=company, email=email, address=text(b.get('address'), 220), city=text(b.get('city'), 120), pib=text(b.get('pib'), 32), mb=text(b.get('mb'), 32), account=text(b.get('account'), 64), class_name=text(b.get('class')) or 'A', payment_days=int(dec(b.get('paymentDays'), 30)), special_discount=dec(b.get('specialDiscount')), username=username, password_hash=make_password(password), active=True, created_at=timezone.now())
            return JsonResponse({**buyer_public(buyer), 'generatedPassword': password}, status=201)

        if path.startswith('/admin/buyers/') and method == 'PATCH':
            bid = path.rsplit('/', 1)[-1]
            try:
                buyer = Buyer.objects.get(pk=bid)
            except Buyer.DoesNotExist:
                return JsonResponse({'error': 'Kupac nije pronađen.'}, status=404)
            b = json_body(request)
            allowed = {'company','email','address','city','pib','mb','account','class','paymentDays','specialDiscount','active'}
            for k, v in b.items():
                if k not in allowed: continue
                attr = 'class_name' if k == 'class' else {'paymentDays': 'payment_days', 'specialDiscount': 'special_discount'}.get(k, k)
                if attr == 'payment_days': v = int(dec(v, buyer.payment_days))
                elif attr == 'special_discount': v = dec(v)
                setattr(buyer, attr, v)
            buyer.updated_at = timezone.now(); buyer.save()
            return JsonResponse(buyer_public(buyer))

        if method == 'GET' and path == '/admin/brands':
            return JsonResponse([{'id': b.id, 'name': b.name, 'category': b.category or '', 'active': bool(b.active)} for b in Brand.objects.all()], safe=False)

        if method == 'POST' and path == '/admin/brands':
            b = json_body(request); name = text(b.get('name'), 120)
            if not name: return JsonResponse({'error': 'Naziv brenda je obavezan.'}, status=400)
            obj, created = Brand.objects.get_or_create(name=name, defaults={'id': uid('brand'), 'category': text(b.get('category'),120), 'active': True, 'created_at': timezone.now()})
            if not created:
                obj.category = text(b.get('category'),120) or obj.category
                obj.active = bool(b.get('active', obj.active)); obj.save()
            return JsonResponse({'id':obj.id,'name':obj.name,'category':obj.category or '','active':bool(obj.active)}, status=201 if created else 200)

        if method == 'PATCH' and path.startswith('/admin/brands/'):
            bid = path.rsplit('/',1)[-1]
            try: obj = Brand.objects.get(pk=bid)
            except Brand.DoesNotExist: return JsonResponse({'error':'Brend nije pronađen.'}, status=404)
            b=json_body(request)
            if 'name' in b: obj.name=text(b.get('name'),120)
            if 'category' in b: obj.category=text(b.get('category'),120)
            if 'active' in b: obj.active=bool(b.get('active'))
            obj.save(); return JsonResponse({'id':obj.id,'name':obj.name,'category':obj.category or '','active':bool(obj.active)})

        if method == 'DELETE' and path.startswith('/admin/brands/'):
            Brand.objects.filter(pk=path.rsplit('/',1)[-1]).delete(); return JsonResponse({'ok': True})

        if method == 'GET' and path == '/admin/categories':
            return JsonResponse([{'name':g.name} for g in ProductGroup.objects.order_by('name')], safe=False)

        if method == 'POST' and path == '/admin/categories':
            b=json_body(request); name=text(b.get('name'),120)
            if not name: return JsonResponse({'error':'Naziv kategorije je obavezan.'}, status=400)
            g, created=ProductGroup.objects.get_or_create(name=name)
            return JsonResponse({'name':g.name}, status=201 if created else 200)

        if method == 'DELETE' and path.startswith('/admin/categories/'):
            name=path.rsplit('/',1)[-1]
            if Product.objects.filter(group_id=name).exists(): return JsonResponse({'error':'Kategorija ima proizvode i ne može biti obrisana.'}, status=400)
            ProductGroup.objects.filter(pk=name).delete(); return JsonResponse({'ok': True})

        if method == 'GET' and path == '/admin/products':
            return JsonResponse([public_product(p) for p in Product.objects.select_related('group').all()], safe=False)

        if method == 'POST' and path == '/admin/products':
            b = json_body(request)
            group_name = text(b.get('group')) or 'Ostalo'
            ProductGroup.objects.get_or_create(name=group_name)
            brand_name = text(b.get('brand'),120)
            if brand_name:
                Brand.objects.get_or_create(name=brand_name, defaults={'id': uid('brand'), 'created_at': timezone.now(), 'active': True})
            requested_sku = text(b.get('sku'), 80)
            if requested_sku:
                if Product.objects.filter(sku=requested_sku).exists():
                    return JsonResponse({'error': f'SKU već postoji: {requested_sku}. Unesite drugu šifru.'}, status=409)
                final_sku = requested_sku
            else:
                final_sku = f'ART-{uuid.uuid4().hex[:10].upper()}'
            p = Product.objects.create(id=uid('p'), name=text(b.get('name'), 220), description=text(b.get('description')), group_id=group_name,
                sku=final_sku, barcode=text(b.get('barcode'), 50), unit=text(b.get('unit')) or 'kom', pack_qty=dec(b.get('packQty'), 1), pack_name=text(b.get('packName')) or 'kom',
                vp_price=dec(b.get('vpPrice')), mp_price=dec(b.get('mpPrice')), old_price=dec(b.get('oldPrice')), sale_until=b.get('saleUntil') or None, brand=text(b.get('brand')), is_new=bool(b.get('isNew')),
                long_desc=text(b.get('longDesc'), 10000), gallery=b.get('gallery') if isinstance(b.get('gallery'), list) else [x.strip() for x in text(b.get('gallery')).split(',') if x.strip()], specs=b.get('specs') if isinstance(b.get('specs'), list) else [],
                stock=dec(b.get('stock')), weight_kg=dec(b.get('weightKg'), 1), action_discount=dec(b.get('actionDiscount')), special_discount=dec(b.get('specialDiscount')), advance_discount=dec(b.get('advanceDiscount'), 3), logistics_discount=dec(b.get('logisticsDiscount'), 2), image=text(b.get('image')), icon=text(b.get('icon')) or '📦', rating=dec(b.get('rating')), created_at=timezone.now())
            return JsonResponse(public_product(p), status=201)

        if path.startswith('/admin/products/') and method in {'PUT', 'DELETE'}:
            pid = path.rsplit('/', 1)[-1]
            try:
                p = Product.objects.select_related('group').get(pk=pid)
            except Product.DoesNotExist:
                return JsonResponse({'error': 'Artikal nije pronađen.'}, status=404)
            if method == 'DELETE':
                p.delete(); return JsonResponse({'ok': True})
            b = json_body(request)
            mapping = {'name':'name','description':'description','group':'group','sku':'sku','barcode':'barcode','unit':'unit','packQty':'pack_qty','packName':'pack_name','vpPrice':'vp_price','mpPrice':'mp_price','oldPrice':'old_price','saleUntil':'sale_until','brand':'brand','isNew':'is_new','longDesc':'long_desc','gallery':'gallery','specs':'specs','stock':'stock','weightKg':'weight_kg','actionDiscount':'action_discount','specialDiscount':'special_discount','advanceDiscount':'advance_discount','logisticsDiscount':'logistics_discount','image':'image','icon':'icon'}
            for k, attr in mapping.items():
                if k not in b: continue
                v = b[k]
                if attr in {'pack_qty','vp_price','mp_price','old_price','stock','weight_kg','action_discount','special_discount','advance_discount','logistics_discount'}: v = dec(v)
                if attr == 'group': ProductGroup.objects.get_or_create(name=text(v)); p.group_id = text(v); continue
                if attr == 'brand':
                    bv=text(v,120)
                    if bv: Brand.objects.get_or_create(name=bv, defaults={'id': uid('brand'), 'created_at': timezone.now(), 'active': True})
                    p.brand=bv; continue
                setattr(p, attr, v)
            p.updated_at = timezone.now(); p.save()
            return JsonResponse(public_product(p))

        if method == 'POST' and path == '/admin/products/group-discount':
            b = json_body(request)
            qs = Product.objects.filter(group_id=text(b.get('group')))
            updates = {}
            if 'actionDiscount' in b and b.get('actionDiscount') != '': updates['action_discount'] = dec(b.get('actionDiscount'))
            if 'specialDiscount' in b and b.get('specialDiscount') != '': updates['special_discount'] = dec(b.get('specialDiscount'))
            if updates: qs.update(**updates)
            return JsonResponse({'ok': True})

        if method == 'GET' and path == '/admin/orders':
            return JsonResponse([order_payload(o) for o in Order.objects.prefetch_related('items').all()], safe=False)

        if method == 'PATCH' and path.startswith('/admin/orders/') and path.endswith('/status'):
            oid = path.split('/')[3]
            try:
                o = Order.objects.get(pk=oid)
            except Order.DoesNotExist:
                return JsonResponse({'error': 'Porudžbina nije pronađena.'}, status=404)
            b = json_body(request); o.status = text(b.get('status')); o.updated_at = timezone.now(); o.save(update_fields=['status','updated_at'])
            return JsonResponse(order_payload(o))

        if method == 'GET' and path == '/admin/coupons':
            return JsonResponse([{'id':c.id,'code':c.code,'description':c.description or '', 'type':c.type,'value':float(c.value),'minAmount':float(c.min_amount),'maxUses':c.max_uses,'used':c.used,'validUntil':iso(c.valid_until)} for c in Coupon.objects.all()], safe=False)

        if method == 'POST' and path == '/admin/coupons':
            b = json_body(request); code = text(b.get('code')).upper()
            if not code or dec(b.get('value')) == 0: return JsonResponse({'error':'Kod i vrednost su obavezni.'}, status=400)
            if Coupon.objects.filter(code=code).exists(): return JsonResponse({'error':'Kod već postoji.'}, status=409)
            c = Coupon.objects.create(id=uid('cp'), code=code, description=text(b.get('description'),255), type='RSD' if b.get('type') == 'RSD' else '%', value=dec(b.get('value')), min_amount=dec(b.get('minAmount')), max_uses=int(dec(b.get('maxUses'),100)), used=0, valid_until=b.get('validUntil') or None)
            return JsonResponse({'id':c.id,'code':c.code,'description':c.description or '','type':c.type,'value':float(c.value),'minAmount':float(c.min_amount),'maxUses':c.max_uses,'used':c.used,'validUntil':iso(c.valid_until)}, status=201)

        if method == 'DELETE' and path.startswith('/admin/coupons/'):
            cid = path.rsplit('/',1)[-1]
            deleted, _ = Coupon.objects.filter(pk=cid).delete()
            if not deleted:
                return JsonResponse({'error':'Promo kod nije pronađen.'}, status=404)
            return JsonResponse({'ok': True})

        if method == 'GET' and path == '/admin/courier':
            return JsonResponse(courier_payload())

        if method == 'POST' and path == '/admin/courier/zones':
            b = json_body(request); kg = dec(b.get('kg'))
            if kg <= 0: return JsonResponse({'error':'Kg mora biti > 0.'}, status=400)
            z, _ = CourierZone.objects.update_or_create(kg=kg, defaults={'price':dec(b.get('price'))})
            return JsonResponse(courier_payload(), status=201)

        if method == 'DELETE' and path.startswith('/admin/courier/zones/by-kg/'):
            try:
                kg=dec(path.rsplit('/',1)[-1])
                CourierZone.objects.filter(kg=kg).delete()
            except Exception:
                pass
            return JsonResponse({'ok': True})

        if method == 'DELETE' and path.startswith('/admin/courier/zones/'):
            try: CourierZone.objects.filter(pk=dec(path.rsplit('/',1)[-1])).delete()
            except Exception: pass
            return JsonResponse({'ok': True})

        if method == 'PATCH' and path == '/admin/courier':
            b = json_body(request); c = CourierSettings.objects.first() or CourierSettings.objects.create(id=1)
            if 'freeFrom' in b: c.free_from = dec(b.get('freeFrom'))
            if 'defWeight' in b: c.def_weight = dec(b.get('defWeight'),1)
            c.save()
            return JsonResponse(courier_payload())

        if method == 'GET' and path == '/admin/marketing':
            return JsonResponse(marketing_payload())

        if method == 'GET' and path == '/admin/qa':
            return JsonResponse([
                {
                    'id': x.id,
                    'productId': x.product_id,
                    'question': x.question,
                    'answer': x.answer or '',
                    'date': iso(x.date)
                }
                for x in QA.objects.select_related('product').order_by('-date', '-id')
            ], safe=False)

        if method == 'POST' and path == '/qa':
            b = json_body(request)
            product_id = text(b.get('productId'))
            question = text(b.get('question'), 5000).strip()
            if not product_id or not question:
                return JsonResponse({'error': 'Proizvod i pitanje su obavezni.'}, status=400)
            try:
                product = Product.objects.get(pk=product_id)
            except Product.DoesNotExist:
                return JsonResponse({'error': 'Proizvod nije pronađen.'}, status=404)
            q = QA.objects.create(
                id=uid('qa'),
                product=product,
                question=question,
                answer='',
                date=timezone.localdate(),
            )
            return JsonResponse({
                'id': q.id,
                'productId': q.product_id,
                'question': q.question,
                'answer': q.answer or '',
                'date': iso(q.date),
            }, status=201)

        if method == 'PATCH' and path.startswith('/admin/qa/'):
            qa_id = path.rsplit('/', 1)[-1]
            try:
                q = QA.objects.get(pk=qa_id)
            except QA.DoesNotExist:
                return JsonResponse({'error': 'Pitanje nije pronađeno.'}, status=404)
            b = json_body(request)
            if 'answer' in b:
                q.answer = text(b.get('answer'), 5000).strip()
            q.save(update_fields=['answer'])
            return JsonResponse({
                'id': q.id,
                'productId': q.product_id,
                'question': q.question,
                'answer': q.answer or '',
                'date': iso(q.date),
            })

        if method == 'PATCH' and path == '/admin/banner':
            s = SaleBanner.objects.first() or SaleBanner(id=1, active=True, title='', text='', cta='', bg='#0c0c0c')
            b = json_body(request)
            for k in ('active','title','text','cta','bg'):
                if k in b: setattr(s, k, b[k])
            s.save()
            return JsonResponse(sale_banner_payload(s))

        if method == 'POST' and path == '/admin/locations':
            b = json_body(request)
            name, address = text(b.get('name')), text(b.get('address'))
            if not name or not address: return JsonResponse({'error':'Naziv i adresa su obavezni.'}, status=400)
            l = Location.objects.create(id=uid('loc'), name=name, phone=text(b.get('phone')), address=address, hours=text(b.get('hours')), lat=dec(b.get('lat')) if b.get('lat') else None, lng=dec(b.get('lng')) if b.get('lng') else None)
            return JsonResponse({'id':l.id,'name':l.name,'phone':l.phone or '', 'address':l.address,'hours':l.hours or '', 'lat':float(l.lat) if l.lat is not None else None,'lng':float(l.lng) if l.lng is not None else None}, status=201)

        for prefix, model in [('/admin/locations/', Location),('/admin/reviews/', Review),('/admin/qa/', QA)]:
            if method == 'DELETE' and path.startswith(prefix):
                model.objects.filter(pk=path.rsplit('/',1)[-1]).delete(); return JsonResponse({'ok': True})

        if method == 'GET' and path == '/admin/settings':
            return JsonResponse(settings_payload(Settings.objects.get(pk=1)))

        if method == 'PATCH' and path == '/admin/settings':
            s = Settings.objects.get(pk=1); b = json_body(request)
            mapping = {'firm':'firm','address':'address','city':'city','pib':'pib','mb':'mb','account':'account','officialMail':'official_mail','invoicePrefix':'invoice_prefix','paymentDays':'payment_days','phone':'phone','secondPhone':'second_phone','workingHours':'working_hours'}
            for k, attr in mapping.items():
                if k in b: setattr(s, attr, int(dec(b[k])) if attr == 'payment_days' else b[k])
            s.save(); return JsonResponse(settings_payload(s))

        if method == 'GET' and path == '/admin/contacts':
            return JsonResponse([{'id':c.id,'name':c.name,'email':c.email,'phone':c.phone or '', 'topic':c.topic or '', 'message':c.message, 'createdAt':iso(c.created_at)} for c in Contact.objects.all().order_by('-created_at')], safe=False)

        if method == 'POST' and path.startswith('/orders/') and path.endswith('/resend'):
            oid = path.split('/')[2]
            try: o = Order.objects.get(pk=oid)
            except Order.DoesNotExist: return JsonResponse({'error':'Porudžbina nije pronađena.'}, status=404)
            s = Settings.objects.get(pk=1); send_mail_demo(f'{o.invoice_number} — resend', s.official_mail)
            return JsonResponse({'ok':True,'sent':False,'mode':'console'})

        if method == 'GET' and path.startswith('/legal/'):
            legal = {
                'uslovi': {'title':'Uslovi prodaje','body':'Porudžbina postaje obavezujuća nakon potvrde. Cene su iskazane u RSD sa jasno prikazanim PDV-om.'},
                'reklamacije': {'title':'Reklamacije i povraćaj','body':'Reklamacije se podnose uz broj porudžbine i opis problema. Za oštećenja u transportu sačuvajte ambalažu i fotografije.'},
                'privatnost': {'title':'Politika privatnosti','body':'Podaci kupca koriste se za realizaciju porudžbine, komunikaciju i zakonske obaveze. Podaci kartice se ne čuvaju u aplikaciji.'},
                'faq': {'title':'Često postavljana pitanja','body':'Za dostupnost, rok isporuke, B2B uslove i reklamacije kontaktirajte prodaju putem podataka sa stranice Kontakt.'},
            }
            key = path.rsplit('/',1)[-1]
            return JsonResponse(legal[key]) if key in legal else JsonResponse({'error':'Dokument nije pronađen.'}, status=404)

        return JsonResponse({'error':'Ruta nije pronađena.'}, status=404)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(exc)}, status=500)


def marketing_payload():
    return {
        'saleBanner': sale_banner_payload(SaleBanner.objects.first()),
        'coupons': [{'id': c.id, 'code': c.code, 'description': c.description or '', 'type': c.type, 'value': float(c.value), 'minAmount': float(c.min_amount), 'maxUses': c.max_uses, 'used': c.used, 'validUntil': iso(c.valid_until)} for c in Coupon.objects.all()],
        'locations': [dict(id=x.id, name=x.name, phone=x.phone or '', address=x.address, hours=x.hours or '', lat=float(x.lat) if x.lat is not None else None, lng=float(x.lng) if x.lng is not None else None) for x in Location.objects.all()],
        'reviews': [dict(id=x.id, productId=x.product_id, buyer=x.buyer, rating=float(x.rating), comment=x.comment, date=iso(x.date), verified=bool(x.verified)) for x in Review.objects.all()],
        'qa': [dict(id=x.id, productId=x.product_id, question=x.question, answer=x.answer, date=iso(x.date)) for x in QA.objects.all()],
    }


def redirect_home(request): return HttpResponseRedirect('/')
def redirect_shop(request): return HttpResponseRedirect('/web-shop/')
def redirect_b2b(request): return HttpResponseRedirect('/b2b/')
def redirect_admin(request): return HttpResponseRedirect('/admin/')
def redirect_kontakt(request): return HttpResponseRedirect('/kontakt/')
def redirect_onama(request): return HttpResponseRedirect('/o-nama/')

def frontend_page(filename):
    def view(request):
        return frontend_file(request, filename)
    return view


def frontend_file(request, filepath=''):
    rel = filepath or 'index.html'
    if rel == '': rel = 'index.html'
    base = Path(settings.STATIC_SITE_ROOT).resolve()
    candidate = (base / rel).resolve()
    if not str(candidate).startswith(str(base)):
        return HttpResponse(status=404)
    if not candidate.exists() or not candidate.is_file():
        return HttpResponse('Not Found', status=404)
    content_type, _ = mimetypes.guess_type(str(candidate))
    content_type = content_type or 'application/octet-stream'
    return HttpResponse(candidate.read_bytes(), content_type=content_type)
