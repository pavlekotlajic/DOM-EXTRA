from django.db import models

class Settings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True)
    firm = models.CharField(max_length=180)
    address = models.CharField(max_length=220)
    city = models.CharField(max_length=120)
    pib = models.CharField(max_length=32)
    mb = models.CharField(max_length=32)
    account = models.CharField(max_length=64)
    official_mail = models.CharField(max_length=180)
    invoice_prefix = models.CharField(max_length=20, default='DE')
    payment_days = models.IntegerField(default=5)
    phone = models.CharField(max_length=50)
    second_phone = models.CharField(max_length=50, blank=True, null=True)
    working_hours = models.CharField(max_length=180, blank=True, null=True)
    order_seq = models.IntegerField(default=1001)
    invoice_seq = models.IntegerField(default=1001)
    class Meta: db_table = 'settings'

class Admin(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    username = models.CharField(max_length=120, unique=True)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=50, default='admin')
    created_at = models.DateTimeField()
    class Meta: db_table = 'admins'

class Buyer(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    company = models.CharField(max_length=180)
    email = models.CharField(max_length=180)
    address = models.CharField(max_length=220)
    city = models.CharField(max_length=120)
    pib = models.CharField(max_length=32)
    mb = models.CharField(max_length=32)
    account = models.CharField(max_length=64)
    class_name = models.CharField(max_length=2, db_column='class', default='A')
    payment_days = models.IntegerField(default=30)
    special_discount = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    username = models.CharField(max_length=120, unique=True)
    password_hash = models.CharField(max_length=255)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)
    class Meta: db_table = 'buyers'

class Brand(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=120, unique=True)
    category = models.CharField(max_length=120, blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    class Meta:
        db_table = 'brands'
        ordering = ['name']

class ProductGroup(models.Model):
    name = models.CharField(max_length=120, primary_key=True)
    class Meta: db_table = 'product_groups'

class Product(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=220)
    description = models.TextField(blank=True, null=True)
    group = models.ForeignKey(ProductGroup, db_column='group_name', to_field='name', on_delete=models.PROTECT, related_name='products')
    sku = models.CharField(max_length=80, unique=True)
    barcode = models.CharField(max_length=50, blank=True, null=True)
    unit = models.CharField(max_length=30, default='kom')
    pack_qty = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    pack_name = models.CharField(max_length=40, default='kom')
    vp_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    mp_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    old_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sale_until = models.DateTimeField(blank=True, null=True)
    brand = models.CharField(max_length=120, blank=True, null=True)
    is_new = models.BooleanField(default=False)
    long_desc = models.TextField(blank=True, null=True)
    gallery = models.JSONField(default=list, blank=True, db_column='gallery_json')
    specs = models.JSONField(default=list, blank=True, db_column='specs_json')
    stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    action_discount = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    special_discount = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    advance_discount = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    logistics_discount = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    rating = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    image = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=30, default='📦')
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)
    class Meta:
        db_table = 'products'

class Coupon(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    code = models.CharField(max_length=60, unique=True)
    description = models.CharField(max_length=255, blank=True, null=True)
    type = models.CharField(max_length=10)
    value = models.DecimalField(max_digits=14, decimal_places=2)
    min_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    max_uses = models.IntegerField(default=100)
    used = models.IntegerField(default=0)
    valid_until = models.DateField(blank=True, null=True)
    class Meta: db_table = 'coupons'

class CourierSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True)
    free_from = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    def_weight = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    class Meta: db_table = 'courier_settings'

class CourierZone(models.Model):
    kg = models.DecimalField(max_digits=12, decimal_places=3, primary_key=True)
    price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    class Meta: db_table = 'courier_zones'

class SaleBanner(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True)
    active = models.BooleanField(default=True)
    title = models.CharField(max_length=255)
    text = models.CharField(max_length=500)
    cta = models.CharField(max_length=120)
    bg = models.CharField(max_length=30)
    class Meta: db_table = 'sale_banner'

class Location(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=180)
    phone = models.CharField(max_length=80, blank=True, null=True)
    address = models.CharField(max_length=255)
    hours = models.CharField(max_length=255, blank=True, null=True)
    lat = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    lng = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    class Meta: db_table = 'locations'

class Order(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    number = models.CharField(max_length=80, unique=True)
    invoice_number = models.CharField(max_length=80, unique=True)
    channel = models.CharField(max_length=20)
    buyer = models.ForeignKey(Buyer, null=True, blank=True, on_delete=models.SET_NULL, db_column='buyer_id', related_name='orders')
    buyer_name = models.CharField(max_length=180, null=True, blank=True)
    created_at = models.DateTimeField()
    status = models.CharField(max_length=40)
    customer = models.JSONField(blank=True, null=True, db_column='customer_json')
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    coupon_discount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    gross = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    shipping = models.JSONField(blank=True, null=True, db_column='shipping_json')
    base = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=80, null=True, blank=True)
    payment_due_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']

class OrderItem(models.Model):
    id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id', related_name='items')
    product_id = models.CharField(max_length=64, null=True, blank=True)
    sku = models.CharField(max_length=80, null=True, blank=True)
    name = models.CharField(max_length=220)
    qty = models.DecimalField(max_digits=14, decimal_places=3)
    unit = models.CharField(max_length=30, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    gross = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    red = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    pos = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    ak = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    av = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    log = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    net_unit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    net = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    class Meta: db_table = 'order_items'

class Review(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    product = models.ForeignKey(Product, db_column='product_id', on_delete=models.CASCADE, related_name='reviews')
    buyer = models.CharField(max_length=180)
    rating = models.DecimalField(max_digits=3, decimal_places=1)
    comment = models.TextField()
    date = models.DateField()
    verified = models.BooleanField(default=False)
    class Meta: db_table = 'reviews'

class QA(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    product = models.ForeignKey(Product, db_column='product_id', on_delete=models.CASCADE, related_name='qas')
    question = models.TextField()
    answer = models.TextField()
    date = models.DateField()
    class Meta: db_table = 'qa'

class Contact(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=120)
    email = models.CharField(max_length=180)
    phone = models.CharField(max_length=50, null=True, blank=True)
    topic = models.CharField(max_length=120, null=True, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField()
    class Meta: db_table = 'contacts'
