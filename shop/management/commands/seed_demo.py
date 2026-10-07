from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from shop.models import Admin, Buyer

class Command(BaseCommand):
    help = 'Kreira demo admin i B2B nalog ako ne postoje.'

    def handle(self, *args, **options):
        now = timezone.now()
        a, created = Admin.objects.get_or_create(username='admin', defaults={
            'id':'adm_1','password_hash':make_password('admin2026'),'role':'admin','created_at':now
        })
        if not created:
            a.password_hash = make_password('admin2026'); a.role='admin'; a.save(update_fields=['password_hash','role'])
        b, created = Buyer.objects.get_or_create(username='gradnja.komerc', defaults={
            'id':'buyer_1','company':'Gradnja Komerc','email':'nabavka@gradnjakomerc.rs','address':'Vojvode Stepe 10','city':'11000 Beograd',
            'pib':'100200300','mb':'21003001','account':'205-1234567890123-11','class_name':'B','payment_days':30,'special_discount':2,
            'password_hash':make_password('gradnja2026'),'active':True,'created_at':now
        })
        if not created:
            b.password_hash = make_password('gradnja2026'); b.active=True; b.save(update_fields=['password_hash','active'])
        self.stdout.write(self.style.SUCCESS('Demo nalozi: admin/admin2026 i gradnja.komerc/gradnja2026'))
