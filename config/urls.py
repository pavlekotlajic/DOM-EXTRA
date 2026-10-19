from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from shop import views

modern = views.frontend_page('modern-app.html')
urlpatterns = [
    path('', modern),
    # Preserve existing Django shop checkout/auth/order flows.
    path('web-shop/', views.frontend_page('web-shop.html')),
    path('web-shop', views.frontend_page('web-shop.html')),
    # Dedicated cart/checkout page, using the same live cart and checkout logic.
    path('korpa/', views.frontend_page('korpa.html')),
    path('korpa', views.frontend_page('korpa.html')),
    path('katalog-preview/', views.frontend_page('modern-products.html')),
    path('b2b-legacy/', views.frontend_page('b2b.html')),
    path('b2b-legacy', views.frontend_page('b2b.html')),
    path('admin/', views.frontend_page('admin.html')),
    path('admin', views.frontend_page('admin.html')),
    path('administracija/', views.frontend_page('admin.html')),
    # New frontend routes; all use one shell so old pages cannot shadow it.
    path('kontakt/', modern), path('kontakt', modern),
    path('o-nama/', modern), path('o-nama', modern),
    path('brendovi/', modern), path('brendovi', modern),
    path('proizvodi/', modern), path('proizvodi', modern),
    path('kategorije/', modern), path('kategorije/<path:rest>', lambda request, rest: modern(request)),
    path('proizvod/<path:rest>', lambda request, rest: modern(request)),
    path('katalozi/', modern), path('katalozi', modern),
    path('b2b/', modern), path('b2b', modern),
    path('privatnost/', modern), path('privatnost', modern),
    path('api/<path:subpath>', views.api_dispatch), path('api/', views.api_dispatch),
    re_path(r'^(?P<filepath>assets/.*)$', views.frontend_file),
    re_path(r'^(?P<filepath>favicon\.svg|robots\.txt|sitemap\.xml)$', views.frontend_file),
    path('index.html', views.redirect_home), path('web-shop.html', views.redirect_shop),
    path('b2b.html', views.redirect_b2b), path('admin.html', views.redirect_admin),
    path('kontakt.html', views.redirect_kontakt), path('o-nama.html', views.redirect_onama),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
